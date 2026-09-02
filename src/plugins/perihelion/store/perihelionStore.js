import { defineStore } from 'pinia';

// Persists across leaving/re-entering the Perihelion tab -- the app has no <KeepAlive> on its
// router-view (see App.vue), so a plain component-local ref() resets on every remount. Same
// pattern as observationPlanerStore.js / telescopiusStore.js for the same reason.
export const usePerihelionStore = defineStore('perihelion', {
  state: () => ({
    activeTab: 'browse',
    selectedId: null,
    filter: 'all',
    // 'brightness' | 'name' -- within the "all" filter, comets are always listed before
    // asteroids regardless of this (see PerihelionView.vue's own filteredObjects comment for
    // why), this only controls the ordering within each of those two groups.
    sortMode: 'brightness',
    searchQuery: '',
    exposureFilter: '',
    exposureSeconds: 30,
    frameCount: 60,
    guiding: true,
    meridianFlip: true,
    autofocus: false,
    autofocusMinutes: 30,
    // Quick Track only (not Add to Sequence -- a sequence just runs SetPerihelionTrackingRate
    // once at that point in the sequence, there's no ongoing loop to re-apply on). Fixed at 15
    // min per the original design, not a configurable interval.
    autoReapply: false,
    // Reflects what's actually running on the mount, not just this view's own lifetime -- if
    // Quick Track is active and the user navigates away and back, the Track tab should still
    // show it running rather than resetting to Idle.
    trackingMode: 'idle',
    // { raDeg, decDeg } | null -- captured once via FramingOffsetView's "Use this Framing".
    // Was a plain component-local ref() until it was noticed that navigating away from the
    // Perihelion tab and back (no <KeepAlive>, see this store's own header comment) silently
    // lost it, forcing the offset to be re-applied. Reset to null on target change by the same
    // watcher in PerihelionView.vue that always did this -- an offset captured for one object
    // has no meaning for a different one.
    framingOffset: null,
    // null = not checked yet, true/false = the result of a real GET /perihelion/api/status call
    // on mount. Perihelion's own backend is a separate standalone server, not reachable via
    // ninaAPI's own aggregator, so this can't use nightsummaryStore.js's own
    // apiService.nightsummary.getStatus() pattern directly -- but the intent is identical:
    // without this, anyone with the Touch-N-Stars panel but not the Perihelion NINA plugin
    // installed (including real Windows NINA users, if this panel ever lands upstream) would
    // just see confusing connection-refused errors instead of a clear "not installed" message.
    pluginInstalled: null,
  }),
});
