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
        await apiService.sequenceRemove(id);
      } catch (e) {
        console.error('sequenceRemove:', e);
      }
      await this.refresh();
    },

    async duplicate(id) {
      if (this._isControlsLocked()) return;

      try {
        await apiService.sequenceDuplicate(id);
      } catch (e) {
        console.error('sequenceDuplicate:', e);
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
        await apiService.sequenceEnable(id, enabled);
      } catch (e) {
        console.error('sequenceEnable:', e);
      }
      await this.refresh();
    },

    async resetStatus(id) {
      if (this._isControlsLocked()) return;
      if (this._isItemRunning(id)) return;

      try {
        await apiService.sequenceResetStatus(id);
      } catch (e) {
        console.error('sequenceResetStatus:', e);
      }
      await this.refresh();
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
  },
});
