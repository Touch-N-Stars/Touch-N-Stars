import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import apiService from '@/services/apiService';
import { timeSync } from '@/utils/timeSync';
import { mergeEvents, mergeGuideSteps, guideCursor, parseTime } from '@/utils/sessionTimelineUtils';

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
    // The backend holds more steps than we do: reload instead of continuing
    needsFullResync: false,
    // Steps the backend counts but never delivers (same-millisecond duplicates)
    resyncTolerance: 0,
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
     * Fetches the steps after the newest known one. If the backend then still
     * counts more steps than we hold, some were missed (a response lost to a
     * reset) and the next poll reloads the whole history.
     */
    async fetchGuideHistory() {
      if (this.guideHistorySupported === false) return;
      const since = this.needsFullResync ? null : guideCursor(this.guideSteps);
      const response = await this.request(() => apiService.guiderHistory(since));
      if (response?.StatusCode === 404) this.guideHistorySupported = false;
      if (!response?.Success || !response.Response) return;

      const { PixelScale, Steps, Count, MaxSize } = response.Response;
      if (PixelScale > 0) this.pixelScale = PixelScale;
      // markRaw: tens of thousands of steps must not become reactive proxies
      const limit = MaxSize > 0 ? MaxSize : MAX_GUIDE_STEPS;
      const merged = mergeGuideSteps(since ? this.guideSteps : [], Steps, limit);
      if (merged !== this.guideSteps) this.guideSteps = markRaw(merged);
      this.guideHistorySupported = true;

      const missing = Number(Count) - this.guideSteps.length;
      if (since === null) {
        this.needsFullResync = false;
        this.resyncTolerance = Math.max(0, missing || 0);
      } else if (missing > this.resyncTolerance) {
        this.needsFullResync = true;
      }
    },
  },
});
