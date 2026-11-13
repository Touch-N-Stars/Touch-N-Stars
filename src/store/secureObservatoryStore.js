import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useToastStore } from '@/store/toastStore';
import i18n from '@/i18n';

const POLL_MS = 2000;

// The step ids the plugin reports, in the order it runs them.
export const SECURE_STEPS = [
  'stop_sequence',
  'abort_exposure',
  'stop_guiding',
  'park_mount',
  'close_dome',
  'close_cover',
  'warm_camera',
  'disconnect',
];

// The steps the user can switch off, with the request field each one maps to. Stopping the
// sequence, the exposure and guiding always happens.
export const SECURE_OPTIONS = [
  { step: 'park_mount', field: 'park' },
  { step: 'close_dome', field: 'closeDome' },
  { step: 'close_cover', field: 'closeCover' },
  { step: 'warm_camera', field: 'warmCamera' },
  { step: 'disconnect', field: 'disconnect' },
];

/** The message for a finished run: "nothing was connected" when every step was skipped. */
export function doneMessageKey(status) {
  const steps = status?.steps ?? [];
  return steps.length > 0 && steps.every((step) => step.state === 'skipped')
    ? 'components.secureObservatory.result.nothing'
    : 'components.secureObservatory.result.done';
}

/**
 * The end-of-night shutdown ("End night"). The plugin runs it; this store starts it, polls its
 * progress while it runs (also with the dialog closed) and tells the user how it ended.
 */
export const useSecureObservatoryStore = defineStore('secureObservatory', {
  state: () => ({
    // null = not asked yet, false = the plugin has no endpoint (too old).
    supported: null,
    status: null,
    showDialog: false,
    // Open the dialog on the result of the last run instead of on the choice of steps.
    showResultOnOpen: false,
    busy: false,
    error: null,
    pollTimer: null,
    // The run whose end was already reported, so a later poll does not report it again.
    reportedStart: null,
  }),

  getters: {
    running: (state) => state.status?.state === 'running',
  },

  actions: {
    openDialog({ showResult = false } = {}) {
      this.showResultOnOpen = showResult;
      this.showDialog = true;
      this.refresh();
    },

    closeDialog() {
      this.showDialog = false;
    },

    async refresh() {
      const result = await apiService.secureObservatoryStatus();
      this.apply(result);
      return result;
    },

    async start(options) {
      this.busy = true;
      this.error = null;
      try {
        const result = await apiService.secureObservatoryStart(options);
        this.apply(result);
        if (result.supported && !result.status) {
          this.error = result.error || i18n.global.t('components.secureObservatory.startFailed');
        }
      } finally {
        this.busy = false;
      }
    },

    async cancel() {
      this.busy = true;
      try {
        this.apply(await apiService.secureObservatoryCancel());
      } finally {
        this.busy = false;
      }
    },

    apply(result) {
      if (!result) return;
      this.supported = result.supported;
      if (!result.status) return;

      const wasRunning = this.running;
      this.status = result.status;

      if (this.running) {
        this.schedulePoll();
      } else {
        this.stopPolling();
        if (wasRunning) this.reportEnd();
      }
    },

    schedulePoll() {
      if (this.pollTimer) return;
      this.pollTimer = setTimeout(async () => {
        this.pollTimer = null;
        try {
          await this.refresh();
        } catch (error) {
          console.warn('[secureObservatory] status poll failed', error);
          // Keep polling: the phone may just be off Wi-Fi for a moment.
          if (this.running) this.schedulePoll();
        }
      }, POLL_MS);
    },

    stopPolling() {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    },

    // With the dialog open the user sees the result there; otherwise a toast says how it ended.
    reportEnd() {
      const status = this.status;
      if (!status || this.reportedStart === status.startedAt) return;
      this.reportedStart = status.startedAt;
      if (this.showDialog) return;

      const t = i18n.global.t;
      const toast = useToastStore();
      if (status.state === 'done') {
        toast.showToast({
          type: 'success',
          title: t('components.secureObservatory.title'),
          message: t(doneMessageKey(status)),
        });
      } else {
        const failed = (status.steps ?? [])
          .filter((step) => step.state === 'failed')
          .map((step) => t(`components.secureObservatory.steps.${step.id}`))
          .join(', ');
        toast.showToast({
          type: 'error',
          title: t('components.secureObservatory.title'),
          message:
            status.state === 'cancelled'
              ? t('components.secureObservatory.result.cancelled')
              : t('components.secureObservatory.result.failed', { steps: failed }),
          autoClose: false,
          actionText: t('components.secureObservatory.showDetails'),
          onAction: () => this.openDialog({ showResult: true }),
        });
      }
    },
  },
});
