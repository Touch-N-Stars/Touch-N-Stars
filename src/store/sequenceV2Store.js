import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from './store';
import { useToastStore } from './toastStore';
import { useSequenceStore } from './sequenceStore';
import { createPoller } from '@/utils/poller';
import i18n from '@/i18n';
import {
  collectDsoContainers,
  findTargetAreaContainer,
  DSO_CONTAINER_TYPE,
} from '@/utils/sequenceTargets';
import {
  canKeepCurrentFilter,
  filterNameChoices,
  matchFilterName,
  nextUnusedFilter,
  switchFilterUpdate,
} from '@/utils/sequenceFilter';
import {
  collectSmartExposureDithers,
  darknessWait,
  findAreaContainer,
  findByType,
  insertionPoint,
  isActive,
  itemsToRearm,
  loopsToRestart,
  needsSingleRun,
  stepsToReopen,
  summarizeDsoContainer,
  AF_AFTER_FILTER_CHANGE_TYPE,
  AF_AFTER_TIME_TYPE,
  DITHER_AFTER_EXPOSURES_TYPE,
  END_AREA_TYPE,
  END_ORDER,
  LOOP_CONDITION_TYPE,
  SET_TRACKING_TYPE,
  SLEW_MODE_TYPES,
  SMART_EXPOSURE_TYPE,
  START_AREA_TYPE,
  START_GUIDING_TYPE,
  START_ORDER,
  TAKE_MANY_EXPOSURES_TYPE,
  TARGET_ORDER,
  UNPARK_SCOPE_TYPE,
  WAIT_FOR_SUN_TYPE,
} from '@/utils/sequenceSimple';

const RUNTIME_FIELDS = [
  'ExpectedTime',
  'ExpectedTimeStr',
  'CurrentAltitude',
  'CurrentIllumination',
  'TargetIllumination',
  'CurrentMoonIllumination',
  'UserMoonIllumination',
  'CompletedIterations',
  'RemainingTime',
  'TargetTime',
  'InterruptReason',
  'Progress',
];

// First plugin versions whose /sequence/move accepts a target in another container. PINS
// builds the plugin from its own branch with its own version line.
const CROSS_CONTAINER_MOVE_MIN_VERSION = { nina: '1.5.0.0', pins: '1.2.9.0' };

function isVersionAtLeast(version, minimum) {
  if (!version) return false;
  const current = String(version).split('.').map(Number);
  const required = minimum.split('.').map(Number);
  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const diff = (current[i] || 0) - (required[i] || 0);
    if (diff !== 0) return diff > 0;
  }
  return true;
}

export const useSequenceV2Store = defineStore('sequenceV2Store', {
  state: () => ({
    data: [],
    loaded: false,
    intervalId: null,
    // Bumped by every stopPolling(); startPolling() captures it before its await
    // and bails if it changed, so a stop during initialization can't be lost.
    pollGeneration: 0,
    availableItems: [],
    availableTriggers: [],
    availableConditions: [],
    // Structure hash from /sequence/status of the tree currently held in `data`.
    // null forces the next status update to reload the full tree.
    revision: null,
    // Whether the plugin serves /sequence/status. null = unknown; false = older plugin,
    // fall back to matching the ninaAPI sequence/json tree by position.
    statusEndpointSupported: null,
  }),
  getters: {
    globalTriggers: (s) => s.data[0]?.GlobalTriggers ?? [],
    // Older plugins reject a move into another container, so drag & drop stays inside the
    // own list there.
    canMoveAcrossContainers: () => {
      const main = apiStore();
      const minimum = main.isPINS
        ? CROSS_CONTAINER_MOVE_MIN_VERSION.pins
        : CROSS_CONTAINER_MOVE_MIN_VERSION.nina;
      return isVersionAtLeast(main.currentTnsPluginVersion, minimum);
    },
    containers: (s) => s.data.slice(1),
    findParentOf: (s) => (itemId) => {
      function search(items, parent) {
        for (const item of items ?? []) {
          if (item.Id === itemId) return parent;
          const found =
            search(item.Items, item) ??
            search(item.Triggers, item) ??
            search(item.Conditions, item);
          if (found !== undefined) return found;
        }
        return undefined;
      }
      return search(s.data, null);
    },
    // Unlike updateItemById this also descends into Triggers/Conditions/GlobalTriggers --
    // they carry a RUNNING status too and must be found by the running-item guard below.
    findById: (s) => (itemId) => {
      function search(items) {
        for (const item of items ?? []) {
          if (item.Id === itemId) return item;
          const found =
            search(item.Items) ??
            search(item.Triggers) ??
            search(item.Conditions) ??
            search(item.GlobalTriggers);
          if (found !== undefined) return found;
        }
        return undefined;
      }
      return search(s.data);
    },
  },
  actions: {
    _isControlsLocked() {
      return useSequenceStore().sequenceControlsLocked;
    },

    // The item the sequencer is currently executing must not be changed. The UI hides
    // those actions already, but the status comes from a 2s poll and can lag behind a
    // click, so every mutating action rejects it here as well.
    _isItemRunning(id) {
      return this.findById(id)?.Status === 'RUNNING';
    },

    // Returns whether a tree was loaded
    async loadCurrent() {
      const store = apiStore();
      if (!store.isBackendReachable) return false;
      try {
        const res = await apiService.fetchSequenceCurrent();
        const items = res?.Data?.Items ?? (Array.isArray(res) ? res : null);
        if (Array.isArray(items)) {
          this.data = items;
          this.loaded = true;
          return true;
        }
      } catch (e) {
        console.error('fetchSequenceCurrent:', e);
      }
      return false;
    },

    // Reloads the full tree and the runtime status, e.g. after an own edit.
    async refresh() {
      this.revision = null;
      if (this.statusEndpointSupported === false) await this.loadCurrent();
      await this.fetchStatusUpdate();
    },

    async fetchStatusUpdate() {
      const store = apiStore();
      if (!store.isBackendReachable) return;

      if (this.statusEndpointSupported !== false) {
        let res;
        try {
          res = await apiService.fetchSequenceStatus();
        } catch (e) {
          // A JSON error body comes from the endpoint itself (400 = no sequence loaded, or a
          // transient failure) - try again next tick. A 404 or any non-JSON answer means the
          // plugin has no such endpoint (older PINS images), so switch to the fallback.
          const body = e?.response?.data;
          const fromEndpoint = typeof body === 'object' && body !== null;
          if (!e?.response || (fromEndpoint && e.response.status !== 404)) {
            console.error('fetchSequenceStatus:', e);
            return;
          }
          this.statusEndpointSupported = false;
        }
        if (this.statusEndpointSupported !== false) {
          if (res && Array.isArray(res.Items)) {
            this.statusEndpointSupported = true;
            if (res.Revision !== this.revision || !this.loaded) {
              // If the structure changes again between both requests, the stored revision
              // is already outdated and the next tick simply reloads once more.
              if (await this.loadCurrent()) this.revision = res.Revision;
            }
            this.applyStatusById(res.Items);
            return;
          }
          // Success=false from the endpoint is transient; anything else (e.g. an HTML page
          // served for an unknown path) means the endpoint does not exist.
          if (typeof res === 'object' && res !== null && 'Error' in res) return;
          this.statusEndpointSupported = false;
        }
      }

      await this.fetchStatusUpdateLegacy();
    },

    // Merges the flat /sequence/status list into the held tree by Id. Only Status and the
    // runtime fields are written, onto the existing objects, so collapse and edit state in
    // the UI survive.
    applyStatusById(entries) {
      const byId = new Map();
      const index = (items) => {
        for (const item of items ?? []) {
          if (item?.Id) byId.set(item.Id, item);
          index(item?.Items);
          index(item?.Triggers);
          index(item?.Conditions);
          index(item?.GlobalTriggers);
        }
      };
      index(this.data);

      for (const entry of entries) {
        const node = byId.get(entry.Id);
        if (!node) continue;
        if (entry.Status !== undefined && node.Status !== entry.Status) node.Status = entry.Status;
        for (const field of RUNTIME_FIELDS) {
          if (entry[field] !== undefined && node[field] !== entry[field]) {
            node[field] = entry[field];
          }
        }
      }
    },

    // Older plugins (PINS images before /sequence/status existed): match the ninaAPI
    // sequence/json tree by position and fetch the running items' details one by one.
    async fetchStatusUpdateLegacy() {
      try {
        const res = await apiService.sequenceAction('json');
        const jsonItems = res?.Response;
        if (Array.isArray(jsonItems)) {
          const changed = this.applyStatusUpdates(this.data, jsonItems);
          if (changed) await this.loadCurrent();
          const runningIds = this.collectAllRunningIds(this.data);
          await Promise.all(
            runningIds.map(async (id) => {
              const info = await apiService.fetchSequenceInfo(id);
              if (info) this.updateItemById(this.data, id, info);
            })
          );
        }
      } catch (e) {
        console.error('fetchStatusUpdate:', e);
      }
    },

    applyStatusUpdates(currentItems, jsonItems) {
      let changed = false;
      if (!Array.isArray(currentItems) || !Array.isArray(jsonItems)) return changed;
      if (currentItems.length !== jsonItems.length) return true;
      jsonItems.forEach((jsonItem, i) => {
        if (!currentItems[i]) return;
        if (jsonItem.Status !== undefined && currentItems[i].Status !== jsonItem.Status) {
          currentItems[i].Status = jsonItem.Status;
          changed = true;
        }
        for (const field of RUNTIME_FIELDS) {
          if (jsonItem[field] === undefined) continue;
          if (currentItems[i][field] !== jsonItem[field]) {
            currentItems[i][field] = jsonItem[field];
          }
        }
        if (jsonItem.Items && currentItems[i].Items) {
          if (this.applyStatusUpdates(currentItems[i].Items, jsonItem.Items)) changed = true;
        }
        if (jsonItem.Triggers && currentItems[i].Triggers) {
          if (this.applyStatusUpdates(currentItems[i].Triggers, jsonItem.Triggers)) changed = true;
        }
        if (jsonItem.Conditions && currentItems[i].Conditions) {
          if (this.applyStatusUpdates(currentItems[i].Conditions, jsonItem.Conditions))
            changed = true;
        }
      });
      return changed;
    },

    collectAllRunningIds(items, result = []) {
      if (!Array.isArray(items)) return result;
      for (const item of items) {
        if (item.Status === 'RUNNING' && item.Id) result.push(item.Id);
        if (item.Items) this.collectAllRunningIds(item.Items, result);
      }
      return result;
    },

    updateItemById(items, id, newData) {
      if (!Array.isArray(items)) return false;
      for (const item of items) {
        if (item.Id === id) {
          Object.assign(item, newData);
          return true;
        }
        if (item.Items && this.updateItemById(item.Items, id, newData)) return true;
      }
      return false;
    },

    async startPolling() {
      this.stopPolling();
      const generation = this.pollGeneration;
      await this.refresh();
      // stopPolling() may have run during refresh() (e.g. app backgrounded
      // mid-initialization). It bumps pollGeneration, so bail out instead of
      // starting an interval that stopPolling already meant to prevent.
      if (generation !== this.pollGeneration) {
        return;
      }
      this.intervalId = createPoller(() => this.fetchStatusUpdate(), 2000);
      this.intervalId.start();
    },

    stopPolling() {
      this.pollGeneration++;
      this.intervalId?.stop();
      this.intervalId = null;
    },

    isFetching() {
      return this.intervalId?.isRunning() === true;
    },

    // insertAfter null moves into the container targetId
    async move(id, targetId, insertAfter) {
      if (this._isControlsLocked()) return;
      if (this._isItemRunning(id)) return;

      let error = null;
      try {
        const res = await apiService.sequenceMove(id, targetId, insertAfter);
        if (res?.Success === false) error = res.Error;
      } catch (e) {
        console.error('sequenceMove:', e);
        error = e?.response?.data?.Error ?? e?.message ?? String(e);
      }
      // A rejected move is reported; the refresh below puts the dragged row back.
      if (error) this._showError(error);
      await this.refresh();
    },

    // Handles vuedraggable's change event. vuedraggable has already moved the element in the
    // local lists; this sends the move to the plugin. list is the list that received the
    // element, containerId the container owning it (used when the list was empty before).
    async applyDrop(evt, list, containerId) {
      const change = evt.moved ?? evt.added;
      if (!change) return; // `removed` fires on the source list; the target handles the move
      if (evt.moved && change.oldIndex === change.newIndex) return;

      const newIndex = change.newIndex;
      const moved = list[newIndex];
      if (!moved) return;
      // The handle of a running item carries no .drag-handle class, so this should not
      // happen -- but vuedraggable has already changed the local lists. Reload to undo it.
      if (moved.Status === 'RUNNING') {
        await this.loadCurrent();
        return;
      }

      if (list.length === 1) {
        await this.move(moved.Id, containerId, null);
      } else if (newIndex === 0) {
        await this.move(moved.Id, list[1].Id, false);
      } else {
        await this.move(moved.Id, list[newIndex - 1].Id, true);
      }
    },

    async remove(id) {
      if (this._isControlsLocked()) return;
      if (this._isItemRunning(id)) return;

      try {
        const res = await apiService.sequenceRemove(id);
        if (res?.Success === false) this._showError(res.Error);
      } catch (e) {
        console.error('sequenceRemove:', e);
        this._showError(e?.response?.data?.Error ?? e?.message ?? String(e));
      }
      await this.refresh();
    },

    async duplicate(id) {
      if (this._isControlsLocked()) return;

      try {
        const res = await apiService.sequenceDuplicate(id);
        if (res?.Success === false) this._showError(res.Error);
      } catch (e) {
        console.error('sequenceDuplicate:', e);
        this._showError(e?.response?.data?.Error ?? e?.message ?? String(e));
      }
      await this.refresh();
    },

    // Returns whether NINA accepted the value. A rejected value (invalid choice, a property
    // that ignores its setter, ...) is reported to the user instead of silently reverting.
    async setProperty(id, propertyName, value) {
      if (this._isControlsLocked()) return false;
      if (this._isItemRunning(id)) return false;

      let error = null;
      try {
        const res = await apiService.sequenceSetProperty(id, propertyName, value);
        if (res?.Success === false) error = res.Error;
      } catch (e) {
        console.error('sequenceSetProperty:', e);
        error = e?.response?.data?.Error ?? e?.message ?? String(e);
      }
      if (error) this._showError(error);
      await this.refresh();
      return !error;
    },

    // Field metadata for the generic editor, or null when the plugin does not provide it
    async fetchEditableFields(id) {
      try {
        const res = await apiService.sequenceFetchFields(id);
        return Array.isArray(res?.Fields) ? res.Fields : null;
      } catch (e) {
        if (e?.response?.status !== 404) console.error('sequenceFetchFields:', e);
        return null;
      }
    },

    async enable(id, enabled) {
      if (this._isControlsLocked()) return;
      if (this._isItemRunning(id)) return;

      try {
        const res = await apiService.sequenceEnable(id, enabled);
        if (res?.Success === false) this._showError(res.Error);
      } catch (e) {
        console.error('sequenceEnable:', e);
        this._showError(e?.response?.data?.Error ?? e?.message ?? String(e));
      }
      await this.refresh();
    },

    async resetStatus(id) {
      if (this._isControlsLocked()) return;
      if (this._isItemRunning(id)) return;

      try {
        const res = await apiService.sequenceResetStatus(id);
        if (res?.Success === false) this._showError(res.Error);
      } catch (e) {
        console.error('sequenceResetStatus:', e);
        this._showError(e?.response?.data?.Error ?? e?.message ?? String(e));
      }
      await this.refresh();
    },

    // Before a plan that ran to its end or was stopped starts again, see itemsToRearm(),
    // stepsToReopen() and loopsToRestart(). Not bound to the controls lock: it belongs to the start, not to editing.
    // Returns whether the plan is ready; on false it must not start, it would take pictures
    // without its slew and guiding, or not park.
    async rearmPlan() {
      await this.loadCurrent();
      const rearm = itemsToRearm(this.data);
      const reopen = stepsToReopen(this.data, { start: rearm.length === 0 });
      const loops = loopsToRestart(this.data);
      if (!rearm.length && !reopen.length && !loops.length) return true;
      const accepted = (res) => {
        if (res?.Success === false) throw new Error(res.Error || 'refused');
      };
      let ok = true;
      try {
        for (const id of rearm) accepted(await apiService.sequenceResetStatus(id));
        // reset-status can take the following items along and drop the progress of the
        // exposures (it depends on the plugin), so these are switched off and on: the plugin only sets a disabled item
        // back to CREATED, and nothing around it changes.
        for (const id of reopen) {
          accepted(await apiService.sequenceEnable(id, false));
          accepted(await apiService.sequenceEnable(id, true));
        }
        for (const id of loops) {
          accepted(await apiService.sequenceSetProperty(id, 'CompletedIterations', 0));
        }
      } catch (e) {
        console.error('rearmPlan:', e);
        ok = false;
      }
      await this.refresh();
      return ok;
    },

    async fetchAvailableItems() {
      if (this.availableItems.length) return;
      try {
        const res = await apiService.sequenceFetchItemTypes();
        this.availableItems = Array.isArray(res) ? res : (res?.Items ?? res?.Response ?? []);
      } catch (e) {
        console.error('sequenceFetchItemTypes:', e);
      }
    },

    async fetchAvailableTriggers() {
      if (this.availableTriggers.length) return;
      try {
        const res = await apiService.sequenceFetchTriggerTypes();
        const allTriggers = Array.isArray(res) ? res : (res?.Items ?? res?.Response ?? []);
        const hiddenTriggers = new Set([
          'NINA.Sequencer.Trigger.MeridianFlip.ProgrammableMeridianFlipTrigger',
          'DaleGhent.NINA.GroundStation.TTS.FailuresToTTS',
          'DaleGhent.NINA.GroundStation.PlaySoundOnFailureTrigger.PlaySoundOnFailureTrigger',
        ]);
        this.availableTriggers = allTriggers.filter((t) => !hiddenTriggers.has(t.FullTypeName));
      } catch (e) {
        console.error('sequenceFetchTriggerTypes:', e);
      }
    },

    async fetchAvailableConditions() {
      if (this.availableConditions.length) return;
      try {
        const res = await apiService.sequenceFetchConditionTypes();
        this.availableConditions = Array.isArray(res) ? res : (res?.Items ?? res?.Response ?? []);
      } catch (e) {
        console.error('sequenceFetchConditionTypes:', e);
      }
    },

    _showError(message) {
      useToastStore().showToast({
        type: 'error',
        title: i18n.global.t('components.sequence.editFailed'),
        message,
        autoClose: true,
      });
    },

    async addItem(targetId, itemType, insertAfter = true) {
      if (this._isControlsLocked()) return;

      try {
        const res = await apiService.sequenceAddItem(targetId, itemType, insertAfter);
        if (res?.Success === false) {
          this._showError(res.Error);
          return;
        }
      } catch (e) {
        console.error('sequenceAddItem:', e);
      }
      await this.refresh();
      // A new Smart Exposure comes with its own dither trigger; with the global one on it
      // would dither every frame twice.
      if (itemType === SMART_EXPOSURE_TYPE && this._globalDitherActive()) {
        await this._zeroSmartExposureDithers();
      }
    },

    async addTrigger(itemId, triggerType, insertAfter = true) {
      if (this._isControlsLocked()) return;

      try {
        const res = await apiService.sequenceAddTrigger(itemId, triggerType, insertAfter);
        if (res?.Success === false) {
          this._showError(res.Error);
          return;
        }
      } catch (e) {
        console.error('sequenceAddTrigger:', e);
      }
      await this.refresh();
    },

    async addCondition(itemId, conditionType, insertAfter = true) {
      if (this._isControlsLocked()) return;

      try {
        const res = await apiService.sequenceAddCondition(itemId, conditionType, insertAfter);
        if (res?.Success === false) {
          this._showError(res.Error);
          return;
        }
      } catch (e) {
        console.error('sequenceAddCondition:', e);
      }
      await this.refresh();
    },

    // Returns { ok, locked, error } so callers outside the sequence editor -- the framing
    // assistant -- can report the failure. The editor's own callers ignore the result.
    async setDsoTarget(id, name, raDeg, decDeg, rotation) {
      if (this._isControlsLocked()) return { ok: false, locked: true };
      if (this._isItemRunning(id)) return { ok: false, locked: true };

      // set-target addresses the container by position. If the Id is not in the held tree
      // (e.g. it changed since the last load), falling back to index 0 would silently
      // overwrite the coordinates of the first target -- refuse instead.
      const index = collectDsoContainers(this.data).findIndex((c) => c.Id === id);
      if (index < 0) {
        await this.refresh();
        return { ok: false, error: i18n.global.t('components.sequence.targetNotFound') };
      }
      let result = { ok: true };
      try {
        const res = await apiService.sequnceTargetSet(
          name ?? '',
          raDeg,
          decDeg,
          rotation ?? 0,
          index
        );
        if (res?.Success === false) result = { ok: false, error: res.Error };
      } catch (e) {
        console.error('setDsoTarget:', e);
        result = { ok: false, error: e?.response?.data?.Error ?? e?.response?.data?.Message };
      }
      await this.refresh();
      return result;
    },

    // Adds an empty DSO container. afterId is the DSO container to insert behind; null
    // appends into the target area, which is the case when the sequence has no target yet.
    // Returns { ok, locked, error, id } with the Id of the container that appeared, so the
    // caller can fill it via setDsoTarget().
    async addDsoTarget(afterId) {
      if (this._isControlsLocked()) return { ok: false, locked: true };

      const knownIds = new Set(collectDsoContainers(this.data).map((c) => c.Id));
      let targetId = afterId;
      let insertAfter = true;
      if (!targetId) {
        const area = findTargetAreaContainer(this.data);
        if (!area) return { ok: false };
        targetId = area.Id;
        insertAfter = null;
      }

      try {
        const res = await apiService.sequenceAddItem(targetId, DSO_CONTAINER_TYPE, insertAfter);
        if (res?.Success === false) return { ok: false, error: res.Error };
      } catch (e) {
        console.error('addDsoTarget:', e);
        return { ok: false, error: e?.response?.data?.Error ?? e?.response?.data?.Message };
      }

      await this.refresh();

      const added = collectDsoContainers(this.data).find((c) => !knownIds.has(c.Id));
      if (!added) return { ok: false };
      return { ok: true, id: added.Id };
    },

    // Duplicates a DSO container with all its exposures; the plugin inserts the copy right
    // behind the source. Returns { ok, locked, error, id } like addDsoTarget(), so the caller
    // can give the copy its own target via setDsoTarget().
    async copyDsoTarget(sourceId) {
      if (this._isControlsLocked()) return { ok: false, locked: true };

      const knownIds = new Set(collectDsoContainers(this.data).map((c) => c.Id));
      try {
        const res = await apiService.sequenceDuplicate(sourceId);
        if (res?.Success === false) return { ok: false, error: res.Error };
      } catch (e) {
        console.error('copyDsoTarget:', e);
        return { ok: false, error: e?.response?.data?.Error ?? e?.response?.data?.Message };
      }

      await this.refresh();

      // Matched by "new Id" rather than the id in the response: older plugins do not return
      // one, and the tree's Ids are what setDsoTarget() addresses anyway.
      const added = collectDsoContainers(this.data).find((c) => !knownIds.has(c.Id));
      if (!added) return { ok: false };
      return { ok: true, id: added.Id };
    },

    // Switches an optional global trigger (meridian flip, dither) on or off. Off disables the
    // existing trigger instead of removing it, so its settings survive; on re-enables it, or
    // adds one at the end of the global triggers when the sequence has none.
    async setGlobalTriggerEnabled(fullTypeName, enabled) {
      if (this._isControlsLocked()) return;

      const existing = findByType(this.globalTriggers, fullTypeName);
      if (existing) {
        const isEnabled = existing.Status !== 'DISABLED';
        if (isEnabled !== enabled) await this.enable(existing.Id, enabled);
        return;
      }
      if (!enabled) return;

      const last = this.globalTriggers.at(-1);
      const targetId = last?.Id ?? this.data[0]?.Id;
      if (!targetId) return;
      await this.addTrigger(targetId, fullTypeName, last ? true : null);
    },

    // Simple mode: the plan refocuses every `minutes`, at all targets. A trigger that was only
    // switched off comes back with its own interval.
    async setRegularRefocus(enabled, minutes) {
      const existed = Boolean(findByType(this.globalTriggers, AF_AFTER_TIME_TYPE));
      await this.setGlobalTriggerEnabled(AF_AFTER_TIME_TYPE, enabled);
      if (!enabled || existed) return;
      const added = findByType(this.globalTriggers, AF_AFTER_TIME_TYPE);
      if (added) await this.setProperty(added.Id, 'Amount', minutes);
    },

    // Switches an optional item of a container on or off, like setGlobalTriggerEnabled():
    // off disables, on re-enables or adds one. A new item is placed by insertionPoint() with
    // `order` and `fallback` (see src/utils/sequenceSimple.js).
    async setContainerItemEnabled(containerId, fullTypeName, enabled, order, fallback) {
      if (this._isControlsLocked()) return;

      const container = this.findById(containerId);
      if (!container) return;
      const existing = findByType(container.Items, fullTypeName);
      if (existing) {
        const isEnabled = existing.Status !== 'DISABLED';
        if (isEnabled !== enabled) await this.enable(existing.Id, enabled);
        return;
      }
      if (!enabled) return;

      const { targetId, insertAfter } = insertionPoint(container, fullTypeName, order, fallback);
      await this.addItem(targetId, fullTypeName, insertAfter);
    },

    // Optional item of the start area (camera cooling, unpark). New ones go to the top:
    // they have to run before everything else.
    async setStartItemEnabled(fullTypeName, enabled) {
      const start = findAreaContainer(this.data, START_AREA_TYPE);
      if (!start) return;
      await this.setContainerItemEnabled(start.Id, fullTypeName, enabled, START_ORDER, 'top');
    },

    // Optional item of the end area (warm camera, park). New ones go to the bottom.
    async setEndItemEnabled(fullTypeName, enabled) {
      const end = findAreaContainer(this.data, END_AREA_TYPE);
      if (!end) return;
      await this.setContainerItemEnabled(end.Id, fullTypeName, enabled, END_ORDER, 'bottom');
    },

    // Simple mode: the plan waits until the sun is at or below sunAltitude before it unparks. The
    // mount does not track meanwhile, or a plan started in daylight would run it into the tripod.
    // Off disables the items, so a plan remembers that the user does not want to wait.
    async setDarknessWait(enabled, sunAltitude) {
      if (this._isControlsLocked()) return;
      const start = findAreaContainer(this.data, START_AREA_TYPE);
      if (!start) return;

      const parts = () => darknessWait(this.data);
      if (!enabled) {
        for (const item of Object.values(parts())) {
          if (isActive(item)) await this.enable(item.Id, false);
        }
        return;
      }
      if (this._isItemRunning(parts().wait?.Id)) return;

      // NINA's default (30 degrees) never waits, so the wait only counts once its value is set.
      await this.setStartItemEnabled(WAIT_FOR_SUN_TYPE, true);
      const { wait } = parts();
      if (!wait || !(await this.setProperty(wait.Id, 'Offset', sunAltitude))) return;

      if (!parts().stop) {
        const known = new Set(this.findById(start.Id).Items.map((i) => i.Id));
        await this.addItem(wait.Id, SET_TRACKING_TYPE, false);
        const added = this.findById(start.Id).Items.find((i) => !known.has(i.Id));
        // 5 = stopped. Left on sidereal it would be one more "tracking on", so it goes again.
        if (added && !(await this.setProperty(added.Id, 'TrackingMode', 5))) {
          await this.remove(added.Id);
        }
      }
      // Without the "off" nothing has to be switched back on
      if (parts().stop && !parts().resume) {
        const unpark = findByType(this.findById(start.Id).Items, UNPARK_SCOPE_TYPE);
        // A new one is sidereal. Behind the unparking: a parked mount refuses to track.
        await this.addItem(unpark?.Id ?? wait.Id, SET_TRACKING_TYPE, true);
      }
      const { stop, resume } = parts();
      for (const item of [resume, stop]) {
        if (item && !isActive(item)) await this.enable(item.Id, true);
      }
    },

    // Simple mode: a target ends when `conditionType` (sun or altitude condition) cuts it off, with
    // the pictures it has by then. See needsSingleRun() for the loop that comes with it. Returns
    // whether the limit is as asked for.
    async setTargetLimit(containerId, conditionType, enabled, offset) {
      if (this._isControlsLocked()) return false;
      const container = () => this.findById(containerId);
      if (!container()) return false;
      const existing = findByType(container().Conditions, conditionType);

      if (!enabled) {
        if (isActive(existing)) await this.enable(existing.Id, false);
        return true;
      }
      if (existing) {
        if (existing.Offset !== offset && !(await this.setProperty(existing.Id, 'Offset', offset)))
          return false;
        if (isActive(existing)) return true;
        if (!(await this._ensureSingleRun(containerId))) return false;
        await this.enable(existing.Id, true);
        return true;
      }
      if (!(await this._ensureSingleRun(containerId))) return false;
      await this.addCondition(containerId, conditionType, null);
      const added = findByType(container()?.Conditions, conditionType);
      if (!added) return false;
      if (await this.setProperty(added.Id, 'Offset', offset)) return true;
      // At its default (sun 0 degrees, target 30 degrees) it would cut off at the wrong moment
      await this.remove(added.Id);
      return false;
    },

    // The "loop once" a limited target needs. NINA creates the condition with 2 repetitions: it
    // must not stay when setting it to 1 fails, the target would be taken twice.
    async _ensureSingleRun(containerId) {
      const conditions = () => this.findById(containerId)?.Conditions ?? [];
      if (!needsSingleRun(this.findById(containerId))) return true;
      const known = new Set(conditions().map((c) => c.Id));
      await this.addCondition(containerId, LOOP_CONDITION_TYPE, null);
      const added = conditions().find((c) => !known.has(c.Id));
      if (!added) return false;
      if (await this.setProperty(added.Id, 'Iterations', 1)) return true;
      await this.remove(added.Id);
      return false;
    },

    // Optional step of a target (start guiding, autofocus at the start), placed before its
    // exposures.
    async setTargetItemEnabled(containerId, fullTypeName, enabled) {
      await this.setContainerItemEnabled(containerId, fullTypeName, enabled, TARGET_ORDER, 'top');
    },

    // How a target is approached: 'off', 'slew', 'center' or 'centerAndRotate'. The other two
    // approaches are disabled, not removed, so switching back keeps their settings.
    async setTargetSlewMode(containerId, mode) {
      if (this._isControlsLocked()) return;

      for (const [key, type] of Object.entries(SLEW_MODE_TYPES)) {
        if (key === mode) continue;
        const existing = findByType(this.findById(containerId)?.Items, type);
        if (isActive(existing)) await this.enable(existing.Id, false);
      }
      const type = SLEW_MODE_TYPES[mode];
      if (type) await this.setTargetItemEnabled(containerId, type, true);
    },

    // Simple mode: the plan slews to the target, starts guiding there and refocuses after a
    // filter change, so the user never does any of it by hand. `steps` comes from
    // simpleTargetSteps(). With `addExposure` a target without pictures also gets an exposure
    // row, filled in with `exposure` (see addExposureRow()).
    async applySimpleTargetSteps(
      containerId,
      steps,
      { addExposure = false, exposure = null } = {}
    ) {
      if (this._isControlsLocked()) return { ok: false, locked: true };
      if (!this.findById(containerId)) return { ok: false };

      await this.setTargetSlewMode(containerId, steps.slewMode);
      await this.setTargetItemEnabled(containerId, START_GUIDING_TYPE, steps.startGuiding);
      // Only ever switched on: without a filter wheel the trigger never fires, so a trigger
      // the user added by hand stays.
      if (steps.afOnFilterChange) {
        await this.setContainerTriggerEnabled(containerId, AF_AFTER_FILTER_CHANGE_TYPE, true);
      }

      const container = this.findById(containerId);
      const hasExposure = (container?.Items ?? []).some((i) =>
        [SMART_EXPOSURE_TYPE, TAKE_MANY_EXPOSURES_TYPE].includes(i?.FullTypeName)
      );
      if (addExposure && container && !hasExposure) {
        await this.addExposureRow(containerId, exposure);
      }
      return { ok: true };
    },

    // New rows go behind the last exposure row, or behind the target's steps when there is
    // none. With a filter wheel a new row starts with the next filter the target does not use
    // yet, the usual way to build an LRGB or narrowband plan. Without a filter left it is told
    // to keep the current one: untouched, PINS would move the wheel to its first slot.
    // `exposure` = { exposureTime, iterations } replaces NINA's values for a new row.
    async addExposureRow(containerId, exposure = null) {
      if (this._isControlsLocked()) return;
      const container = this.findById(containerId);
      if (!container) return;

      const before = summarizeDsoContainer(container).rows;
      const { targetId, insertAfter } = insertionPoint(
        container,
        SMART_EXPOSURE_TYPE,
        TARGET_ORDER,
        'bottom'
      );
      await this.addItem(targetId, SMART_EXPOSURE_TYPE, insertAfter);

      const knownIds = new Set(before.map((r) => r.id));
      const row = summarizeDsoContainer(this.findById(containerId)).rows.find(
        (r) => !knownIds.has(r.id)
      );
      if (row && exposure) {
        await this.setProperties(
          [
            {
              id: row.exposureItem?.Id,
              propertyName: 'ExposureTime',
              value: exposure.exposureTime,
            },
            {
              id: row.loopCondition?.Id,
              propertyName: 'Iterations',
              value: exposure.iterations,
            },
          ].filter((change) => change.id)
        );
      }
      if (!row?.filterItem?.Id || row.filterName) return;
      const { filterInfo, profileInfo } = apiStore();
      const names = filterNameChoices(row.filterItem, filterInfo, profileInfo);
      const used = before.map((r) => matchFilterName(names, r.filterName));
      const next = nextUnusedFilter(names, used);
      if (!next && !canKeepCurrentFilter(row.filterItem)) return;
      const { property, value } = switchFilterUpdate(row.filterItem, names, next ?? '');
      await this.setProperty(row.filterItem.Id, property, value);
    },

    // Optional trigger of a container (the autofocus triggers of a target). Off disables,
    // on re-enables or appends one.
    async setContainerTriggerEnabled(containerId, fullTypeName, enabled) {
      if (this._isControlsLocked()) return;

      const container = this.findById(containerId);
      if (!container) return;
      const existing = findByType(container.Triggers, fullTypeName);
      if (existing) {
        const isEnabled = existing.Status !== 'DISABLED';
        if (isEnabled !== enabled) await this.enable(existing.Id, enabled);
        return;
      }
      if (!enabled) return;

      const last = container.Triggers?.at(-1);
      await this.addTrigger(last?.Id ?? container.Id, fullTypeName, last ? true : null);
    },

    // Dithering of the whole plan. Every Smart Exposure brings its own dither trigger (NINA
    // creates it with "after 1 exposure"), so a plan dithers even without the global one.
    // On: the global trigger takes over and the built-in ones are zeroed -- otherwise those
    // frames would be dithered twice. Off: the built-in ones are zeroed too, or "off" would
    // change nothing. They are not restored when it is switched on again.
    async setGlobalDither(enabled) {
      if (this._isControlsLocked()) return;

      await this.setGlobalTriggerEnabled(DITHER_AFTER_EXPOSURES_TYPE, enabled);
      // Only when the global trigger really is active now -- after a rejected add the Smart
      // Exposures must keep dithering themselves.
      if (enabled && !this._globalDitherActive()) return;
      await this._zeroSmartExposureDithers();
    },

    _globalDitherActive() {
      return isActive(findByType(this.globalTriggers, DITHER_AFTER_EXPOSURES_TYPE));
    },

    _zeroSmartExposureDithers() {
      const changes = collectSmartExposureDithers(this.data)
        .filter((trigger) => !this._isItemRunning(trigger.Id))
        .map((trigger) => ({ id: trigger.Id, propertyName: 'AfterExposures', value: 0 }));
      return this.setProperties(changes);
    },

    // Like setProperty() for several values, with one refresh at the end instead of one per
    // value. Returns whether all were accepted; rejections are reported together.
    async setProperties(changes) {
      if (this._isControlsLocked()) return false;
      if (!changes.length) return true;

      const errors = [];
      for (const { id, propertyName, value } of changes) {
        if (this._isItemRunning(id)) continue;
        try {
          const res = await apiService.sequenceSetProperty(id, propertyName, value);
          if (res?.Success === false) errors.push(res.Error);
        } catch (e) {
          console.error('sequenceSetProperty:', e);
          errors.push(e?.response?.data?.Error ?? e?.message ?? String(e));
        }
      }
      if (errors.length) this._showError([...new Set(errors)].join('\n'));
      await this.refresh();
      return !errors.length;
    },

    // Moves a DSO container one place up (-1) or down (+1) among the DSO containers.
    async moveDsoTarget(id, direction) {
      const targets = collectDsoContainers(this.data);
      const index = targets.findIndex((c) => c.Id === id);
      const neighbour = targets[index + direction];
      if (index < 0 || !neighbour) return;
      await this.move(id, neighbour.Id, direction > 0);
    },
  },
});
