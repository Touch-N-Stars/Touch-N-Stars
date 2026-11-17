import { defineStore } from 'pinia';

export const usePinsStore = defineStore('pins', {
  state: () => ({
    timeSyncEnabled: false,
    suppressTimeWarning: false,
    stationaryMode: false,
    wifiList: [],
    selectedSsid: '',
    wifiPassword: '',
    selectedBand: 'auto',
    autoConnect: false,
    isScanning: false,
    wifiConnected: false,
    terminalLogs: [],
    terminalStatus: 'Idle',
    activeOperation: null,
    currentJobId: null,
  }),
  getters: {
    isUpgradeRunning(state) {
      return state.activeOperation === 'upgrade' && state.terminalStatus === 'Running';
    },
    isUpgradeWaitingForBackend(state) {
      return state.activeOperation === 'upgrade' && state.terminalStatus === 'Success';
    },
    shouldShowUpgradeOverlay() {
      return this.isUpgradeRunning || this.isUpgradeWaitingForBackend;
    },
    shouldSuppressConnectionToasts() {
      return this.shouldShowUpgradeOverlay;
    },
  },
  actions: {
    setTimeSync(enabled) {
      this.timeSyncEnabled = enabled;
    },
    setSuppressTimeWarning(value) {
      this.suppressTimeWarning = value;
    },
    clearTerminalLogs() {
      this.terminalLogs = [];
    },
    appendTerminalLog(message) {
      this.terminalLogs.push(message);
      // Keep memory bounded for long-running sessions.
      if (this.terminalLogs.length > 1000) {
        this.terminalLogs.splice(0, this.terminalLogs.length - 1000);
      }
    },
    setTerminalStatus(status) {
      this.terminalStatus = status;
    },
    setActiveOperation(operation) {
      this.activeOperation = operation;
    },
    setCurrentJobId(jobId) {
      this.currentJobId = jobId;
    },
    finalizeUpgradeRecovery() {
      if (!this.isUpgradeWaitingForBackend) {
        return;
      }

      this.activeOperation = null;
      this.currentJobId = null;
      this.terminalStatus = 'Idle';
    },
    resetUpgradeOverlay() {
      this.activeOperation = null;
      this.currentJobId = null;
      this.terminalStatus = 'Idle';
    },
  },
  persist: {
    enabled: true,
    strategies: [
      {
        // Legacy key name kept so persisted values survive the move out of the plugin.
        key: 'pins-plugin-store',
        storage: localStorage,
        paths: ['timeSyncEnabled', 'suppressTimeWarning'],
      },
    ],
  },
});
