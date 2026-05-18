import { defineStore } from 'pinia';

export const useOrbitalsStore = defineStore('orbitalsStore', {
  state: () => ({
    comets: [],
    lastUpdated: { mpcComets: null, jplComets: null },
    jwst: null, // { ra, dec, dist, validUntil, fetchedAt }
    activeTab: 'orbital',
  }),

  getters: {
    cometCount: (state) => state.comets.length,
    jwstValid(state) {
      if (!state.jwst?.validUntil) return false;
      return new Date(state.jwst.validUntil) > new Date();
    },
  },

  actions: {
    mergeComets(list, source) {
      const other = this.comets.filter((c) => c.source !== source);
      this.comets = [...other, ...list];
      if (source === 'MPC') this.lastUpdated.mpcComets = new Date().toISOString();
      if (source === 'JPL') this.lastUpdated.jplComets = new Date().toISOString();
    },
    setJWST(pos) {
      this.jwst = { ...pos, fetchedAt: new Date().toISOString() };
    },
    setActiveTab(tab) {
      this.activeTab = tab;
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
