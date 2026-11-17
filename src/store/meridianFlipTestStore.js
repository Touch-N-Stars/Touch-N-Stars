import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { isSequenceRunning } from '@/utils/meridianFlipDayTest';
import { isFlipTestSequenceState } from '@/utils/meridianFlipTestSequence';
import { readStoredJson, writeStored, writeStoredJson } from '@/utils/safeStorage';

// The meridian flip day test runs on in NINA when the page reloads. The modal lives at
// app level and a running test is remembered, so it comes back with its STOP button.
const RUN_KEY = 'tns.meridianFlipTest.run';

export const useMeridianFlipTestStore = defineStore('meridianFlipTest', {
  state: () => ({
    visible: false,
    // Run data of a test that was running before the reload, handed to the modal once.
    resumeRun: null,
    restoreChecked: false,
  }),
  actions: {
    open() {
      this.resumeRun = null;
      this.visible = true;
    },
    close() {
      this.visible = false;
      this.resumeRun = null;
    },
    saveRun(run) {
      writeStoredJson(RUN_KEY, run);
    },
    clearRun() {
      writeStored(RUN_KEY, '');
    },
    // Reopens the modal when the remembered test sequence is still running in NINA.
    async restore() {
      if (this.restoreChecked || this.visible) return;
      const run = readStoredJson(RUN_KEY, null);
      if (!run?.startedAt) return;
      this.restoreChecked = true;
      try {
        const response = await apiService.sequenceAction('state');
        const state = response?.Response;
        if (isFlipTestSequenceState(state) && isSequenceRunning(state)) {
          this.resumeRun = run;
          this.visible = true;
        } else {
          this.clearRun();
        }
      } catch (error) {
        // Try again on the next connect; the run stays remembered.
        this.restoreChecked = false;
        console.error('Could not check for a running meridian flip test:', error);
      }
    },
  },
});
