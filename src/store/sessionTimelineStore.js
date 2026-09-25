import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';
import { mergeEvents, mergeGuideSteps, parseTime } from '@/utils/sessionTimelineUtils';

const MAX_GUIDE_STEPS = 50000;

/**
 * Mirror of the Advanced API's session buffers for the session timeline: the
 * event history and the guide step history (PINS fork). Not persisted; reset()
 * on connection loss or instance switch rebuilds it from the backend. The
 * image history stays with `apiStore.imageHistoryInfo`.
 */
export const useSessionTimelineStore = defineStore('sessionTimeline', {
  state: () => ({
    // Lower bound of the session. The backend replays its log file after a
    // restart, so log-derived events can be older than the running instance.
    applicationStart: null,
    events: [],
    guideSteps: [],
    pixelScale: 0,
    // null = unknown, false = the rig has no guide history route (older PINS)
    guideHistorySupported: null,
    // Server time of the last poll; ends the bars that are still open
    nowMs: 0,
    // reset() bumps it; a response for an older generation is dropped
    generation: 0,
    // Cursor into the guide history: the backend's Session and the Id of the
    // newest step received from it
    guideSession: null,
    guideAfter: null,
  }),

  actions: {
    reset() {
      const generation = this.generation + 1;
      this.$reset();
      this.generation = generation;
    },

    async poll() {
      await timeSync.ensureSync();
      if (this.applicationStart === null) await this.fetchApplicationStart();
      await Promise.all([this.fetchEvents(), this.fetchGuideHistory()]);
      this.nowMs = timeSync.getServerTime();
    },

    // The axios interceptor resolves HTTP errors as { Success: false, StatusCode }
    async request(call) {
      const generation = this.generation;
      try {
        const response = await call();
        return generation === this.generation ? response : null;
      } catch (error) {
        console.warn('[SessionTimeline] request failed:', error?.message || error);
        return null;
      }
    },

    async fetchApplicationStart() {
      const response = await this.request(() => apiService.fetchApplicationStart());
      const start = response?.Success ? parseTime(response.Response) : null;
      if (start === null) return;
      this.applicationStart = start;
      this.events = this.events.filter((event) => event.t >= start);
    },

    async fetchEvents() {
      const response = await this.request(() => apiService.getEventHistory());
      if (!response?.Success || !Array.isArray(response.Response)) return;
      const start = this.applicationStart ?? -Infinity;
      this.events = mergeEvents(this.events, response.Response).filter((event) => event.t >= start);
    },

    /**
     * Fetches the steps after the newest known one. A NINA restart starts the
     * step ids over under a new Session: that history is then read from its
     * start and appended to the steps of the old one.
     */
    async fetchGuideHistory() {
      if (this.guideHistorySupported === false) return;
      const after = this.guideAfter;
      const response = await this.request(() => apiService.guiderHistory(after));
      if (response?.StatusCode === 404) this.guideHistorySupported = false;
      // A cursor moved meanwhile means another fetch already delivered these steps
      if (!response?.Success || !response.Response || after !== this.guideAfter) return;

      const { PixelScale, Steps, Session, MaxSize } = response.Response;
      // Without a Session the rig predates the id cursor and would resend every step
      this.guideHistorySupported = Boolean(Session);
      if (!Session) return;
      if (Session !== this.guideSession) {
        this.guideSession = Session;
        this.guideAfter = null;
        if (after !== null) return this.fetchGuideHistory();
      }
      if (PixelScale > 0) this.pixelScale = PixelScale;
      // markRaw: tens of thousands of steps must not become reactive proxies
      const limit = MaxSize > 0 ? MaxSize : MAX_GUIDE_STEPS;
      const merged = mergeGuideSteps(this.guideSteps, Steps, limit);
      if (merged !== this.guideSteps) this.guideSteps = markRaw(merged);
      if (Steps?.length) this.guideAfter = Steps[Steps.length - 1].Id ?? null;
    },
  },
});
