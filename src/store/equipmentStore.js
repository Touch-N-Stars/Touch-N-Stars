import { defineStore } from 'pinia';

export const useEquipmentStore = defineStore('equipmentStore', {
  state: () => ({
    reloadTrigger: 0,
    rescanTrigger: {
      camera: 0,
      guideCamera: 0,
      mount: 0,
      filter: 0,
      focus: 0,
      rotator: 0,
      guider: 0,
      safety: 0,
      flatdevice: 0,
      dome: 0,
      weather: 0,
      switch: 0,
    },
  }),
  actions: {
    triggerRescan(apiName) {
      this.rescanTrigger[apiName] = Date.now();
    },
    triggerReload() {
      this.reloadTrigger = Date.now();
    },
  },
});
