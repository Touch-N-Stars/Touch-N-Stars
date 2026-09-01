import { defineStore } from 'pinia';

// Persists across leaving/re-entering the Perihelion tab -- the app has no <KeepAlive> on its
// router-view (see App.vue), so a plain component-local ref() resets on every remount. Same
// pattern as observationPlanerStore.js / telescopiusStore.js for the same reason.
export const usePerihelionStore = defineStore('perihelion', {
  state: () => ({
    activeTab: 'browse',
    selectedId: null,
    filter: 'all',
    searchQuery: '',
    exposureFilter: '',
    exposureSeconds: 30,
    frameCount: 60,
    guiding: true,
    meridianFlip: true,
    autofocus: false,
    autofocusMinutes: 30,
    // Reflects what's actually running on the mount, not just this view's own lifetime -- if
    // Quick Track is active and the user navigates away and back, the Track tab should still
    // show it running rather than resetting to Idle.
    trackingMode: 'idle',
  }),
});
