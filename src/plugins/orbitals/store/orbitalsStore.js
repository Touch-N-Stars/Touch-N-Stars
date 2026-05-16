import { defineStore } from 'pinia';

export const useOrbitalsStore = defineStore('orbitalsStore', {
  state: () => ({
    // Comets are small enough to persist in localStorage (~hundreds of entries).
    // Asteroids can be millions of rows — kept in memory only (loadedAsteroids).
    comets: [],
    lastUpdated: {
      mpcComets: null,
      jplComets: null,
    },
    // Session-only (not persisted)
    loadedAsteroids: [],
    asteroidsSource: null,
    filter: {
      search: '',
      objectType: 'all', // 'all' | 'comets' | 'asteroids'
    },
  }),

  getters: {
    allObjects(state) {
      if (state.filter.objectType === 'comets') return state.comets;
      if (state.filter.objectType === 'asteroids') return state.loadedAsteroids;
      return [...state.comets, ...state.loadedAsteroids];
    },

    filteredObjects(state) {
      const q = state.filter.search.trim().toLowerCase();
      const all = this.allObjects;
      if (!q) return all;
      return all.filter((o) => o.name.toLowerCase().includes(q));
    },

    cometCount: (state) => state.comets.length,
    asteroidCount: (state) => state.loadedAsteroids.length,
  },

  actions: {
    setComets(list, source) {
      this.comets = list;
      if (source === 'MPC') this.lastUpdated.mpcComets = new Date().toISOString();
      if (source === 'JPL') this.lastUpdated.jplComets = new Date().toISOString();
    },

    mergeComets(list, source) {
      // Replace entries from this source, keep others
      const other = this.comets.filter((c) => c.source !== source);
      this.comets = [...other, ...list];
      if (source === 'MPC') this.lastUpdated.mpcComets = new Date().toISOString();
      if (source === 'JPL') this.lastUpdated.jplComets = new Date().toISOString();
    },

    setAsteroids(list, source) {
      this.loadedAsteroids = list;
      this.asteroidsSource = source;
    },

    setFilter(patch) {
      Object.assign(this.filter, patch);
    },
  },

  persist: {
    enabled: true,
    strategies: [
      {
        key: 'orbitals-store',
        storage: localStorage,
        paths: ['comets', 'lastUpdated'],
      },
    ],
  },
});
