import { defineStore } from 'pinia';

// Runtime state of the status bar: which docked panel (camera, guider graph,
// mount, filter, progress, switch) is open. Only one can be open at a time,
// so a single id replaces the per-device show* flags. Not persisted.
export const useStatusBarStore = defineStore('statusBarStore', {
  state: () => ({
    activePanel: null,
  }),
  getters: {
    isPanelOpen: (state) => (id) => state.activePanel === id,
  },
  actions: {
    togglePanel(id) {
      this.activePanel = this.activePanel === id ? null : id;
    },
    openPanel(id) {
      this.activePanel = id;
    },
    closePanel() {
      this.activePanel = null;
    },
  },
});
