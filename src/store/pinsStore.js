import { defineStore } from 'pinia';

export const usePinsStore = defineStore('pins', {
  state: () => ({
    timeSyncEnabled: false,
    // Set once the user switches automatic time sync on or off by hand. Until then a new
    // PINS profile switches it on (see enableTimeSyncForNewProfile).
    timeSyncChosen: false,
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
      this.timeSyncChosen = true;
    },
    // The Pi has no real-time clock, so PINS comes up with a wrong time after every power-up
    // and the time warning would greet the user on each start. A new profile gets automatic
    // sync instead; profiles set up before keep whatever the user runs with.
    // Returns whether it switched sync on.
    enableTimeSyncForNewProfile() {
      if (this.timeSyncChosen || this.timeSyncEnabled) return false;
      this.timeSyncEnabled = true;
      return true;
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
        paths: ['timeSyncEnabled', 'timeSyncChosen', 'suppressTimeWarning'],
      },
    ],
  },
});
