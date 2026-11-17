import { defineStore } from 'pinia';
import { watch } from 'vue';
import { createPoller } from '@/utils/poller';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import api from '../api';

// The status poll lives here, not in the view: while a session runs it must go on when the user
// opens the camera or mount page (the backend stops a daytime move after 20 s without polls). It
// runs while the panel is open or a session is active, and pauses while the app is backgrounded.
let poller = null;
let openViews = 0;
let polls = 0;
// Settings saves run one after another (a −/+ tap fires one each); only the last response counts.
let settingsQueue = Promise.resolve();
let settingsSaves = 0;

function wantPolling(store) {
  return !isAppBackgrounded.value && (openViews > 0 || store.active);
}

function ensurePoller(store) {
  if (!poller) {
    poller = createPoller(async () => {
      await store.loadStatus();
      polls++;
      if (openViews > 0 && !store.active && polls % 5 === 0) {
        await store.loadPreconditions();
      }
      if (!wantPolling(store)) poller.stop();
    }, 2000);
    watch(isAppBackgrounded, () => {
      if (wantPolling(store)) poller.start();
      else poller.stop();
    });
  }
  if (wantPolling(store)) poller.start();
}

const FINISHED = ['Complete', 'Failed', 'Aborted'];

export const useConeErrorStore = defineStore('coneError', {
  state: () => ({
    status: null,
    preconditions: null,
    settings: null,
    results: [],
    autoPlan: null,
    movePlan: null,
    estimate: null,
    // the result the user put away with "New measurement"; kept here so a tab switch keeps it away
    dismissedResultId: null,
    loading: false,
    pending: false,
    error: null,
    // a failed poll's error is cleared by the next successful poll; an action's error is not
    errorFromPoll: false,
  }),

  getters: {
    mode: (state) => state.status?.mode ?? 'none',
    phase: (state) => state.status?.phase ?? 'Idle',
    active: (state) => state.status?.active === true,
    autoRunning: (state) => state.status?.mode === 'auto' && state.status?.active === true,
    manualActive: (state) => state.status?.mode === 'manual' && state.status?.active === true,
    moving: (state) =>
      state.status?.active === true && ['Slewing', 'Moving'].includes(state.status?.phase),
    finished: (state) => FINISHED.includes(state.status?.phase),
  },

  actions: {
    setError(error, fromPoll = false) {
      if (error.cancelled) return;
      this.error = error;
      this.errorFromPoll = fromPoll;
    },

    clearPollError() {
      if (!this.errorFromPoll) return;
      this.error = null;
      this.errorFromPoll = false;
    },

    async run(action) {
      this.pending = true;
      this.error = null;
      try {
        return await action();
      } catch (error) {
        this.setError(error);
        throw error;
      } finally {
        this.pending = false;
      }
    },

    /** The panel was opened: poll (and keep polling while a session runs after it is closed). */
    attachView() {
      openViews++;
      ensurePoller(this);
    },

    detachView() {
      openViews = Math.max(0, openViews - 1);
    },

    async loadStatus() {
      try {
        this.status = await api.getStatus();
        this.clearPollError();
      } catch (error) {
        this.setError(error, true);
      }
    },

    async loadAll() {
      this.loading = true;
      try {
        const [status, preconditions, settings, results] = await Promise.all([
          api.getStatus(),
          api.getPreconditions(),
          api.getSettings(),
          api.getResults(),
        ]);
        this.status = status;
        this.preconditions = preconditions;
        this.settings = settings;
        this.results = results ?? [];
        this.error = null;
      } catch (error) {
        this.setError(error);
      } finally {
        this.loading = false;
      }
    },

    async loadPreconditions() {
      try {
        this.preconditions = await api.getPreconditions();
        this.clearPollError();
      } catch (error) {
        this.setError(error, true);
      }
    },

    async loadResults() {
      try {
        this.results = (await api.getResults()) ?? [];
      } catch (error) {
        this.setError(error);
      }
    },

    /** Sends only the changed fields, after any save still under way. */
    async saveSettings(changes) {
      const save = ++settingsSaves;
      const request = settingsQueue.then(() => this.run(() => api.saveSettings(changes)));
      settingsQueue = request.catch(() => {});
      const settings = await request;
      if (save === settingsSaves) this.settings = settings;
    },

    async planAuto(request) {
      this.autoPlan = null;
      const plan = await this.run(() => api.planAuto(request));
      // the countdown runs from the moment the plan arrived, not on the phone's clock vs the Pi's
      this.autoPlan = plan ? { ...plan, receivedAt: Date.now() } : null;
      return this.autoPlan;
    },

    async startAuto(acknowledgePointingModel) {
      const planId = this.autoPlan?.planId;
      this.autoPlan = null;
      this.status = await this.run(() => api.startAuto(planId, acknowledgePointingModel));
      ensurePoller(this);
    },

    async answer(id, yes) {
      this.status = await this.run(() => api.answer(id, yes));
    },

    /** Never behind a confirmation: stopping the mount must be one tap. */
    async abort() {
      try {
        this.status = await api.abort();
      } catch (error) {
        // a second try: a lost request must not leave the mount moving
        this.status = await api.abort();
        if (!this.status) throw error;
      }
    },

    async restore() {
      this.status = await this.run(() => api.restore());
      await this.loadPreconditions();
    },

    async manualBegin() {
      this.estimate = null;
      this.movePlan = null;
      this.status = await this.run(() => api.manualBegin());
      ensurePoller(this);
    },

    async manualCapture() {
      this.estimate = null;
      this.movePlan = null;
      this.status = await this.run(() => api.manualCapture());
    },

    async manualPlanMove(side, overrideSunPath = false) {
      this.movePlan = null;
      const plan = await this.run(() => api.manualPlanMove(side, overrideSunPath));
      this.movePlan = plan ? { ...plan, receivedAt: Date.now() } : null;
      return this.movePlan;
    },

    async manualPierLabels(counterweightWest) {
      this.status = await this.run(() => api.manualPierLabels(counterweightWest));
    },

    async manualMove() {
      const planId = this.movePlan?.planId;
      this.movePlan = null;
      this.status = await this.run(() => api.manualMove(planId));
    },

    async manualStop() {
      try {
        this.status = await api.manualStop();
      } catch (error) {
        this.status = await api.abort();
        if (!this.status) throw error;
      }
    },

    async manualRecenterDone(axisOffsetMm, landmarkDistanceMeters) {
      this.estimate = await this.run(() =>
        api.manualRecenterDone(axisOffsetMm, landmarkDistanceMeters)
      );
      return this.estimate;
    },

    async manualEnd() {
      this.movePlan = null;
      this.status = await this.run(() => api.manualEnd());
      await this.loadPreconditions();
    },
  },
});
