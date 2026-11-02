import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import i18n from '@/i18n';
import { createPoller } from '@/utils/poller';
import { flatMaxADU } from '@/utils/flatAdu';
import { useSettingsStore } from '@/store/settingsStore';
import {
  isServerWorkflowStatus,
  mapFilterResults,
  buildServerRunSummary,
} from '@/utils/flatServerRun';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The poller ticks every second, but with no run active the status only has to
// notice a run started elsewhere (NINA UI, sequence), so idle ticks are thinned out.
const IDLE_STATUS_INTERVAL_MS = 5000;

// A plugin without the plugin-side flat run is asked again this rarely, so an
// update of the plugin is picked up without reconnecting.
const SERVER_WORKFLOW_REPROBE_MS = 60000;

export const useFlatassistantStore = defineStore('flatassistantStore', {
  state: () => ({
    count: 20,
    darkCount: 0,
    ExposureTime: 2,
    minExposureTime: 0.01,
    maxExposureTime: 20,
    brightness: 100,
    minBrightness: 0,
    maxBrightness: 32000,
    histogramMean: 50,
    meanTolerance: 10,
    binning: '1x1',
    gain: 100,
    offset: 0,
    status: {
      State: '',
      TotalIterations: 0,
      CompletedIterations: -1,
      TotalFilters: 0,
      CompletedFilters: -1,
    },
    // Summary of the most recently completed run; null when no run has finished yet.
    // { type: 'flats'|'darks', completed: number, total: number, success: boolean, lastADU: number|null }
    lastRun: null,
    // ADU (Mean) of the most recently captured image during the current run
    currentADU: null,
    // Bit depth of the image currentADU was measured on, when the backend reports it
    // (BitDepth in /flats/status). RAW frames can be below the camera info's BitDepth.
    currentADUBitDepth: null,
    // Last human-readable status message received from NINA/PINS via SignalR progress hub.
    signalRStatus: null,
    // Locked outcome set once when a run completes — stays until the next run starts.
    // { type: 'success'|'warning'|'error'|'info', message: string }
    lastRunOutcome: null,
    currentRunType: 'flats',
    workflowStopRequested: false,
    // Per-filter run results for multi-mode; survives tab switches as store state.
    // { [filterId]: null | 'success' | 'failed' | 'dim' | 'bright' | 'stopped' }
    filterResults: {},
    // Name of the filter currently being processed in multi-mode, null otherwise.
    currentFilterName: null,
    // Whether the Touch'N'Stars plugin runs flat assistant runs itself (single and
    // multi filter, dark flats) so they survive the app being closed.
    // null = not probed yet, true/false = probed.
    serverWorkflow: null,
    // RunId of the plugin-side run the store currently tracks.
    serverRunId: null,
  }),
  getters: {
    // Full-scale ADU that currentADU is measured against (see flatMaxADU).
    maxADU(state) {
      return flatMaxADU(state.currentADUBitDepth, apiStore().cameraInfo?.BitDepth);
    },
  },
  actions: {
    async fetchFlatsInfos() {
      try {
        const store = apiStore();

        if (!store.isBackendReachable) {
          console.warn('Backend is not reachable flats');
          return;
        }

        if (await this.fetchServerRunStatus()) return;

        // Without the plugin-side run only PINS has a flat status worth polling here;
        // under NINA the legacy single-filter run is tracked by waitForCompletion.
        if (!store.isPINS) return;

        const prevState = this.status.State;

        const isIdle =
          prevState !== 'Running' &&
          !(this.currentRunType === 'flats-multi' && this.lastRun === null);
        const now = Date.now();
        if (isIdle && now - (this._lastIdleStatusFetch ?? 0) < IDLE_STATUS_INTERVAL_MS) return;
        this._lastIdleStatusFetch = now;

        // Check both TNS (multimode) and ninaAPI status in parallel.
        // TNS takes precedence when its task is running.
        const [tnsResult, ninaResult] = await Promise.allSettled([
          apiService.flatMultiStatus(),
          apiService.flatassistantAction('status'),
        ]);

        const tnsNext = tnsResult.status === 'fulfilled' ? tnsResult.value?.Response : null;
        const ninaNext = ninaResult.status === 'fulfilled' ? ninaResult.value?.Response : null;

        // During an active multi-mode run prefer tnsNext always — even during brief
        // inter-filter Finished transitions — to avoid flickering from ninaNext's stale ADU.
        const isActiveMultiRun = this.currentRunType === 'flats-multi' && this.lastRun === null;
        const next =
          tnsNext?.State === 'Running' || isActiveMultiRun
            ? (tnsNext ?? ninaNext ?? this.status)
            : (ninaNext ?? tnsNext ?? this.status);

        // A new run is starting — clear the previous result
        if (prevState !== 'Running' && next.State === 'Running') {
          this.lastRun = null;
          this.currentADU = null;
          this.currentADUBitDepth = null;
          this.lastRunOutcome = null;
        }

        // ADU: only update while a run is active (lastRun === null).
        // Once waitForCompletion sets lastRun, freeze currentADU at that value.
        if (this.lastRun === null && next.CurrentADU !== null && next.CurrentADU !== undefined) {
          this.currentADU = Math.round(next.CurrentADU);
          this.currentADUBitDepth = next.BitDepth ?? null;
        }

        this.status = next;

        // When the ninaAPI backend tells us it's in the dark phase, reflect that.
        if (
          ninaNext?.State === 'Running' &&
          ninaNext?.Type === 'darks' &&
          this.currentRunType === 'flats'
        ) {
          this.currentRunType = 'darks';
        }
      } catch (error) {
        console.error('Error fetching information:', error);
      }
    },

    // ── Plugin-side runs (/api/flats/*) ─────────────────────────────────────────

    /**
     * Polls the plugin-side run. Returns true when the plugin runs flat assistant
     * runs itself - the status was applied and the legacy path must be skipped.
     */
    async fetchServerRunStatus({ force = false } = {}) {
      const now = Date.now();
      if (
        this.serverWorkflow === false &&
        !force &&
        now - (this._serverWorkflowProbeAt ?? 0) < SERVER_WORKFLOW_REPROBE_MS
      ) {
        return false;
      }

      const serverActive = this.status.State === 'Running' || this.status.WaitingForCover;
      if (
        this.serverWorkflow === true &&
        !force &&
        !serverActive &&
        now - (this._lastIdleStatusFetch ?? 0) < IDLE_STATUS_INTERVAL_MS
      ) {
        return true;
      }
      this._lastIdleStatusFetch = now;

      let payload;
      try {
        payload = (await apiService.flatMultiStatus())?.Response;
      } catch (error) {
        // 404: plugin without flat runs. Anything else (timeout, offline) says nothing.
        if (error?.response?.status === 404) {
          this.serverWorkflow = false;
          this._serverWorkflowProbeAt = now;
        }
        return this.serverWorkflow === true;
      }

      if (!isServerWorkflowStatus(payload)) {
        // Older PINS plugin: its multi-mode endpoint has no dark flats and no per-filter results.
        this.serverWorkflow = false;
        this._serverWorkflowProbeAt = now;
        return false;
      }

      this.serverWorkflow = true;
      this.applyServerStatus(payload);
      return true;
    },

    /** Forgets the plugin-side run and its detection (instance switch). */
    resetServerRun() {
      this.serverWorkflow = null;
      this.serverRunId = null;
      this.filterResults = {};
      this.currentFilterName = null;
      this.status = {
        State: '',
        TotalIterations: 0,
        CompletedIterations: -1,
        TotalFilters: 0,
        CompletedFilters: -1,
      };
      this._coverPromptRunId = null;
      this._serverWorkflowProbeAt = 0;
    },

    /** Resolves whether the plugin-side run is available, probing once if unknown. */
    async detectServerWorkflow() {
      if (this.serverWorkflow === null) {
        await this.fetchServerRunStatus({ force: true });
      }
      return this.serverWorkflow === true;
    },

    applyServerStatus(s) {
      const isRunning = s.State === 'Running';

      // A run this store has not tracked yet (started here, on another device or before the
      // app was reopened): reset the per-run view state once.
      if (s.RunId && s.RunId !== this.serverRunId) {
        this.serverRunId = s.RunId;
        this.workflowStopRequested = Boolean(s.StopRequested);
        if (isRunning) {
          this.lastRun = null;
          this.lastRunOutcome = null;
          this.currentADU = null;
          this.currentADUBitDepth = null;
          this.workflowStopRequested = false;
        }
      }

      this.status = s;
      const multiFilter = (s.Filters?.length ?? 0) > 1;
      this.currentRunType = s.Type === 'darks' ? 'darks' : multiFilter ? 'flats-multi' : 'flats';
      this.currentFilterName = isRunning && multiFilter ? (s.CurrentFilterName ?? null) : null;
      if (s.StopRequested) this.workflowStopRequested = true;

      if (isRunning && s.CurrentADU !== null && s.CurrentADU !== undefined) {
        this.currentADU = Math.round(s.CurrentADU);
        this.currentADUBitDepth = s.BitDepth ?? null;
      }

      if (s.Filters?.length) {
        this.filterResults = { ...this.filterResults, ...mapFilterResults(s.Filters) };
      }

      if (isRunning && s.WaitingForCover) {
        this.promptCoverConfirmation(s.RunId);
      }

      if (s.State === 'Finished' && s.RunId) {
        const settingsStore = useSettingsStore();
        if (settingsStore.flats.lastSeenRunId !== s.RunId) {
          settingsStore.flats.lastSeenRunId = s.RunId;
          const summary = buildServerRunSummary(s, {
            dimLabel: i18n.global.t('components.flatassistant.result_dim'),
            brightLabel: i18n.global.t('components.flatassistant.result_bright'),
          });
          // The App.vue watcher shows the outcome toast, but only for a null -> run change;
          // a run that finished unseen while an older result was still shown is committed here.
          const replacesShownRun = this.lastRun !== null;
          this.lastRun = summary;
          if (replacesShownRun) this.commitRunOutcome(summary);
        }
      }
    },

    /**
     * The plugin waits for the user before its dark flats unless a flip-flat panel can
     * cover the telescope itself. Asked once per run; the answer goes back to the plugin.
     */
    async promptCoverConfirmation(runId) {
      if (!runId || this._coverPromptRunId === runId) return;
      this._coverPromptRunId = runId;

      const confirmed = await useToastStore().showConfirmation(
        i18n.global.t('components.flatassistant.cover_scope_title'),
        i18n.global.t('components.flatassistant.cover_scope_message'),
        i18n.global.t('components.flatassistant.cover_scope_confirm'),
        i18n.global.t('common.cancel')
      );

      try {
        await apiService.flatRunConfirmCover(confirmed);
      } catch (error) {
        // 409: answered elsewhere or the run was stopped meanwhile - nothing left to do.
        if (error?.response?.status !== 409) {
          // Ask again on the next poll so the run does not wait forever.
          this._coverPromptRunId = null;
        }
      }
      this._lastIdleStatusFetch = 0;
    },

    /**
     * Starts a plugin-side run. `filters` holds one config per filter in run order
     * (filterId null = keep the current filter); percentages are 0-100.
     */
    async startServerRun({ mode, keepClosed, darkCount, filters }) {
      const settingsStore = useSettingsStore();
      this.startManagedRun(filters.length > 1 ? 'flats-multi' : 'flats');
      for (const filter of filters) {
        if (filter.filterId !== null && filter.filterId !== undefined) {
          this.filterResults[filter.filterId] = null;
        }
      }

      // The plugin deserializes into non-nullable ints/doubles: a null there fails the whole
      // request, so every numeric field gets a concrete value (-1 = camera default).
      const num = (value, fallback) =>
        Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback;
      const int = (value, fallback) => Math.round(num(value, fallback));
      const payload = {
        mode,
        keepClosed: Boolean(keepClosed),
        darkCount: Math.max(0, int(darkCount, 0)),
        targetName: settingsStore.flats.targetNameEnabled ? settingsStore.flats.targetName : '',
        filters: filters.map((f) => ({
          filterId:
            f.filterId !== null && Number.isInteger(Number(f.filterId)) ? Number(f.filterId) : null,
          count: Math.max(1, int(f.count, 1)),
          gain: int(f.gain, -1),
          offset: int(f.offset, -1),
          binning: typeof f.binning === 'string' && f.binning ? f.binning : '1x1',
          histogramMean: num(f.histogramMean, 50),
          meanTolerance: num(f.meanTolerance, 10),
          minExposure: num(f.minExposure, 0.01),
          maxExposure: num(f.maxExposure, 20),
          brightness: int(f.brightness, 50),
          exposureTime: num(f.exposureTime, 2),
          minBrightness: int(f.minBrightness, 0),
          maxBrightness: int(f.maxBrightness, 32000),
        })),
      };

      try {
        const response = await apiService.flatMultiMode(payload);
        if (response?.Success === false) {
          this.notifyOperationIssue(response, 'warning');
          return false;
        }
      } catch (error) {
        this.notifyOperationIssue(error?.response?.data ?? error);
        return false;
      }

      // Pick the new run up right away instead of waiting for the next idle tick.
      await this.fetchServerRunStatus({ force: true });
      return true;
    },

    startManagedRun(type = 'flats') {
      this.currentRunType = type;
      this.workflowStopRequested = false;
      this.lastRun = null;
      this.currentADU = null;
      this.currentADUBitDepth = null;
      this.signalRStatus = null;
      this.lastRunOutcome = null;
    },

    updateSignalRStatus(message) {
      if (message && message.trim()) {
        this.signalRStatus = message.trim();
      }
    },

    didRunSucceed(status) {
      if (status?.State !== 'Finished') return false;
      const total = Number(status?.TotalIterations);
      const completed = Number(status?.CompletedIterations);
      // PINS / SkyFlat report -1 — outcome unknown from REST alone, don't claim success
      if (total < 0) return false;
      return total > 0 && completed >= total;
    },

    shouldOfferDarks(status) {
      return this.darkCount > 0 && this.didRunSucceed(status) && !this.workflowStopRequested;
    },

    formatOperationMessage(payload) {
      if (typeof payload?.Response === 'string' && payload.Response.trim()) {
        return payload.Response;
      }
      if (typeof payload?.Message === 'string' && payload.Message.trim()) {
        return payload.Message;
      }
      if (typeof payload?.message === 'string' && payload.message.trim()) {
        return payload.message;
      }
      if (typeof payload?.Error === 'string' && payload.Error.trim()) {
        return payload.Error;
      }
      return i18n.global.t('components.flatassistant.operation_failed');
    },

    notifyOperationIssue(payload, type = 'error') {
      useToastStore().showToast({
        type,
        title: i18n.global.t('components.flatassistant.operation_failed'),
        message: this.formatOperationMessage(payload),
        autoClose: true,
        autoCloseDelay: 5000,
      });
    },

    commitRunOutcome(run) {
      let type = 'info';
      let message;

      if (run.total <= 0) {
        if (this.workflowStopRequested) {
          type = 'info';
          message = i18n.global.t('components.flatassistant.status_completed_flats');
        } else {
          type = 'error';
          message = i18n.global.t('components.flatassistant.status_failed_flats');
        }
      } else if (run.success) {
        type = 'success';
        message = i18n.global.t(
          run.type === 'darks'
            ? 'components.flatassistant.status_success_darks'
            : 'components.flatassistant.status_success_flats',
          { count: run.total }
        );
      } else if (run.completed > 0 && this.workflowStopRequested) {
        // User explicitly stopped the run with some flats already taken
        type = 'warning';
        message = i18n.global.t(
          run.type === 'darks'
            ? 'components.flatassistant.status_stopped_darks'
            : 'components.flatassistant.status_stopped_flats',
          { completed: run.completed, total: run.total }
        );
      } else if (
        run.type === 'flats-multi' &&
        run.failedFilterNames?.length > 0 &&
        run.completed > 0
      ) {
        // Partial failure: some filters succeeded, some failed
        type = 'warning';
        message = i18n.global.t('components.flatassistant.status_partial_flats_multi', {
          filters: run.failedFilterNames.join(', '),
        });
      } else {
        type = 'error';
        message = i18n.global.t(
          run.type === 'darks'
            ? 'components.flatassistant.status_failed_darks'
            : run.type === 'flats-multi'
              ? 'components.flatassistant.status_failed_flats_multi'
              : 'components.flatassistant.status_failed_flats'
        );
      }

      // Plugin-side runs report their dark flats in the same outcome (one toast slot).
      let darksNote = null;
      if (run.darks?.skipped) {
        darksNote = i18n.global.t('components.flatassistant.status_darks_skipped');
      } else if (run.darks?.total > 0) {
        const { completed, total } = run.darks;
        if (completed >= total) {
          darksNote = i18n.global.t('components.flatassistant.status_darks_taken', {
            count: completed,
          });
        } else {
          darksNote = i18n.global.t('components.flatassistant.status_darks_incomplete', {
            completed,
            total,
          });
          if (type === 'success') type = 'warning';
        }
      }
      if (darksNote) {
        // The flat messages carry no closing punctuation of their own.
        const closed = /[.!?。！？]$/.test(message.trim());
        message = `${message.trim()}${closed ? '' : '.'} ${darksNote}`;
      }

      this.lastRunOutcome = { type, message };

      if (type !== 'info') {
        useToastStore().showToast({
          type,
          title: i18n.global.t('components.flatassistant.title'),
          message,
          autoClose: true,
          autoCloseDelay: 10000,
        });
      }
    },

    async waitForCompletion(statusLoader, pollMs = 1000, { gracePollLimit } = {}) {
      let seenRunning = false;
      let pollCount = 0;
      let consecutiveNonRunning = 0;
      let peakRunningCompleted = -1;
      let peakRunningTotal = 0;

      while (!this.workflowStopRequested) {
        const response = await statusLoader();
        const status = response?.Response ?? response;
        pollCount++;

        if (status) {
          this.status = status;

          if (status.CurrentADU !== null && status.CurrentADU !== undefined) {
            this.currentADU = Math.round(status.CurrentADU);
            this.currentADUBitDepth = status.BitDepth ?? null;
          }

          if (status.State === 'Running') {
            seenRunning = true;
            consecutiveNonRunning = 0;
            if (Number(status.TotalIterations) > 0) {
              peakRunningCompleted = Number(status.CompletedIterations);
              peakRunningTotal = Number(status.TotalIterations);
            }
          } else {
            consecutiveNonRunning++;
          }

          const isMultiMode = this.currentRunType === 'flats-multi';
          const effectiveGrace = gracePollLimit ?? (isMultiMode ? 30 : 5);
          const pastStartupGrace = seenRunning || pollCount >= effectiveGrace;
          const terminalState = isMultiMode
            ? consecutiveNonRunning >= 3
            : status.State === 'Finished' || consecutiveNonRunning >= 5;

          if (pastStartupGrace && terminalState) {
            let completed, total;
            if (peakRunningTotal > 0) {
              total = peakRunningTotal;
              const ninaFinishedNegative =
                status.State === 'Finished' && Number(status.TotalIterations) < 0;
              // Credit all when NINA's Finished state zeroes out the count (T=-1, C=-1)
              // and we had confirmed progress (C > 0) at the last Running poll.
              // C=0 is intentionally excluded: NINA reports T=N during the exposure-search
              // phase too, so C=0 + Finished could mean search failed, not capture succeeded.
              completed =
                ninaFinishedNegative &&
                peakRunningCompleted > 0 &&
                peakRunningCompleted < peakRunningTotal
                  ? peakRunningTotal
                  : peakRunningCompleted;
            } else {
              completed = Math.max(0, Number(status.CompletedIterations) || 0);
              total = Math.max(0, Number(status.TotalIterations) || 0);
            }
            return { status, completed, total };
          }
        }

        await wait(pollMs);
      }

      // Stopped by user — return whatever peak info we have
      const completed = peakRunningTotal > 0 ? peakRunningCompleted : 0;
      const total = peakRunningTotal > 0 ? peakRunningTotal : 0;
      return { status: this.status, completed, total };
    },

    async runFlatWorkflow({
      request,
      statusLoader = () => apiService.flatassistantAction('status'),
      runType = 'flats',
      darkCount = 0,
    }) {
      this.startManagedRun(runType);

      const connectedSimulator = darkCount > 0 ? await this.ensureFlatDeviceConnected() : false;

      const response = await request();
      if (response?.Success === false) {
        if (connectedSimulator) await this.disconnectFlatDevice();
        this.notifyOperationIssue(response, 'warning');
        return null;
      }

      const {
        status: finalStatus,
        completed,
        total,
      } = await this.waitForCompletion(statusLoader, 250);

      this.lastRun = {
        type: this.currentRunType,
        completed,
        total,
        success: total > 0 && completed >= total,
        lastADU: this.currentADU,
      };

      if (connectedSimulator) await this.disconnectFlatDevice();

      return finalStatus;
    },

    async stopWorkflow() {
      this.workflowStopRequested = true;
      return Promise.allSettled([
        apiService.flatassistantAction('stop'),
        apiService.flatMultiStop(),
      ]);
    },

    async ensureFlatDeviceConnected() {
      const store = apiStore();
      if (store.flatdeviceInfo?.Connected) {
        return false;
      }
      try {
        const connectResponse = await apiService.flatdeviceAction('connect?to=flip_flat_simulator');
        return connectResponse?.Success === true;
      } catch {
        return false;
      }
    },

    async disconnectFlatDevice() {
      try {
        await apiService.flatdeviceAction('disconnect');
      } catch {
        // best-effort cleanup
      }
    },

    async runDarkSeries(jobs, keepClosed = false) {
      const validJobs = jobs.filter((job) => Number(job?.count) > 0);
      if (!validJobs.length || this.workflowStopRequested) {
        return null;
      }

      const confirmed = await useToastStore().showConfirmation(
        i18n.global.t('components.flatassistant.cover_scope_title'),
        i18n.global.t('components.flatassistant.cover_scope_message'),
        i18n.global.t('components.flatassistant.cover_scope_confirm'),
        i18n.global.t('common.cancel')
      );

      if (!confirmed) {
        return null;
      }

      // Connect simulator flat device if none is connected (needed by trained-dark-flat API)
      const connectedSimulator = await this.ensureFlatDeviceConnected();

      let totalRequested = 0;
      let totalCompleted = 0;
      let allSucceeded = true;
      let lastADU = this.currentADU;

      for (const job of validJobs) {
        if (this.workflowStopRequested) {
          break;
        }

        totalRequested += Number(job.count) || 0;
        this.startManagedRun('darks');

        const response = await apiService.flatTrainedDarkFlat(
          job.count,
          job.binning,
          job.gain,
          job.offset,
          job.filterId,
          keepClosed
        );

        if (response?.Success === false) {
          allSucceeded = false;
          this.notifyOperationIssue(response, 'warning');
          continue;
        }

        const { completed: darkCompleted, total: darkTotal } = await this.waitForCompletion(
          () => apiService.flatassistantAction('status'),
          250
        );

        totalCompleted += darkCompleted;
        lastADU = this.currentADU;

        // Use waitForCompletion's resolved counts (handles NINA's T=-1 Finished state)
        // instead of didRunSucceed(finalStatus) which would always fail when T=-1.
        if (darkTotal <= 0 || darkCompleted < darkTotal) {
          allSucceeded = false;
        }
      }

      // Disconnect simulator if we connected it
      if (connectedSimulator) {
        await this.disconnectFlatDevice();
      }

      if (totalRequested > 0) {
        this.lastRun = {
          type: 'darks',
          completed: totalCompleted,
          total: totalRequested,
          success: allSucceeded && totalCompleted >= totalRequested,
          lastADU,
        };
      }

      return this.lastRun;
    },

    startFetchingFlats() {
      if (!this._flatsPoller) {
        this._flatsPoller = createPoller(() => this.fetchFlatsInfos(), 1000);
      }
      this._flatsPoller.start();
    },

    stopFetchingFlats() {
      this._flatsPoller?.stop();
    },
  },
});
