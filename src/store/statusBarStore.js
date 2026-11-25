import { defineStore } from 'pinia';

// Runtime state of the status bar: which docked panel (camera, guider graph,
// mount, filter, progress, switch) is open. Only one can be open at a time,
// so a single id replaces the per-device show* flags. Also which
// restart/shutdown dialog App.vue shows. Not persisted.
export const useStatusBarStore = defineStore('statusBarStore', {
  state: () => ({
    activePanel: null,
    // null | 'choose' | 'restart' | 'shutdown'
    powerDialog: null,
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
    openPowerDialog(action = 'choose') {
      this.powerDialog = action;
    },
    closePowerDialog() {
      this.powerDialog = null;
    },
  },
});
