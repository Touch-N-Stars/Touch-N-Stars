import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

export const useHocusFocusStore = defineStore('hocusfocus', {
  state: () => ({
    // Whether the Hocus Focus areas of the focus page are offered. null = not probed yet.
    // PINS only, like the plugin they replace: they read Hocus Focus v4 internals that a stock
    // NINA's Hocus Focus may not have. Within PINS the status route decides.
    available: null,

    // Response of GET hocusfocus/autofocus/last-run; null without a run in this NINA session.
    lastRun: null,

    // Connection status
    cameraConnected: false,
    focuserConnected: false,
    error: null,
    isLoading: false,

    // Detailed AutoFocus analysis state
    isCancelling: false,

    // Star Detection Options state
    starDetectionOptions: null,
    isLoadingDetectionOptions: false,
    detectionOptionsError: null,

    // AutoFocus Options state
    autoFocusOptions: null,
    autoFocusEnumOptions: {},
    isLoadingAutoFocusOptions: false,
    autoFocusOptionsError: null,

    // Which Aberration Inspector result sections are expanded. Remembered per device; the plots
    // start collapsed so slow devices neither fetch nor draw them unless asked.
    resultSections: {
      sensorModel: true,
      fwhmContour: false,
      eccentricity: false,
    },

    // Plugin Info
    pluginInfo: {
      name: 'HocusFocus',
      version: '',
      description: 'Improved Star Detection, Auto Focus, and Tilt Correction for NINA',
      installed: false,
    },
  }),

  actions: {
    // Initialize store
    async initialize() {
      try {
        this.isLoading = true;
        this.error = null;
        // Fetch equipment status on initialization
        await this.fetchEquipmentStatus();
      } catch (err) {
        this.error = err.message;
      } finally {
        this.isLoading = false;
      }
    },

    // Fetch equipment connection status
    async fetchEquipmentStatus() {
      try {
        // Try to get camera info which includes connection status
        const cameraInfo = await apiService.cameraAction('info');
        this.cameraConnected =
          cameraInfo?.Response?.Connected || cameraInfo?.data?.Connected || false;
      } catch (err) {
        console.warn('Failed to fetch camera status:', err);
        this.cameraConnected = false;
      }

      try {
        // Try to get focuser info which includes connection status
        const focuserInfo = await apiService.focusAction('info');
        this.focuserConnected =
          focuserInfo?.Response?.Connected || focuserInfo?.data?.Connected || false;
      } catch (err) {
        console.warn('Failed to fetch focuser status:', err);
        this.focuserConnected = false;
      }
    },

    async checkAvailability() {
      if (!apiStore().isPINS) {
        this.available = false;
        return false;
      }
      try {
        const data = await apiService.hocusfocus.getStatus();
        this.available = !!data?.Success;
      } catch {
        this.available = false;
      }
      return this.available;
    },

    async loadLastRun() {
      const data = await apiService.hocusfocus.getLastAutoFocusRun();
      this.lastRun = data?.Success ? data : null;
      return this.lastRun;
    },

    // Writes one star-detection option and re-reads the set: simple-mode presets are derived
    // server-side, so one change can move several values.
    async setStarDetectionOption(key, value) {
      const response = await apiService.hocusfocus.setStarDetectionOption(key, value);
      if (response && response.success === false) throw new Error(response.error);
      this.starDetectionOptions = await apiService.hocusfocus.getStarDetectionOptions();
    },

    async setAutoFocusOption(key, value) {
      const response = await apiService.hocusfocus.setAutoFocusOption(key, value);
      if (response && response.Success === false) throw new Error(response.Error);
      const { options, enumOptions } = await apiService.hocusfocus.getAutoFocusOptions();
      this.autoFocusOptions = options;
      this.autoFocusEnumOptions = enumOptions;
    },

    // Applies a fix from src/utils/hocusFocusAdvisor.js.
    async applyFix(fix) {
      if (!fix) return;
      if (fix.target === 'profile') {
        await apiService.profileChangeValue(fix.key, String(fix.value));
        await apiStore().fetchProfilInfos();
      } else if (fix.target === 'hf-sd') {
        await this.setStarDetectionOption(fix.key, fix.value);
      } else if (fix.target === 'hf-af') {
        await this.setAutoFocusOption(fix.key, fix.value);
      }
    },

    // Load Star Detection Options
    async loadStarDetectionOptions() {
      try {
        this.isLoadingDetectionOptions = true;
        this.detectionOptionsError = null;
        const options = await apiService.hocusfocus.getStarDetectionOptions();
        this.starDetectionOptions = options;
        return options;
      } catch (err) {
        this.detectionOptionsError = err.message || 'Failed to load Star Detection options';
        console.error('Error loading Star Detection options:', err);
        throw err;
      } finally {
        this.isLoadingDetectionOptions = false;
      }
    },

    // Save Star Detection Options
    async saveStarDetectionOptions(options) {
      try {
        this.isLoadingDetectionOptions = true;
        this.detectionOptionsError = null;
        const response = await apiService.hocusfocus.setStarDetectionOptions(options);
        // Reload options to sync with backend
        await this.loadStarDetectionOptions();
        return response;
      } catch (err) {
        this.detectionOptionsError = err.message || 'Failed to save Star Detection options';
        console.error('Error saving Star Detection options:', err);
        throw err;
      } finally {
        this.isLoadingDetectionOptions = false;
      }
    },

    // Reset Star Detection Options to defaults
    async resetStarDetectionDefaults() {
      try {
        this.isLoadingDetectionOptions = true;
        this.detectionOptionsError = null;
        const response = await apiService.hocusfocus.resetStarDetectionDefaults();
        // Reload options to sync with backend
        await this.loadStarDetectionOptions();
        return response;
      } catch (err) {
        this.detectionOptionsError = err.message || 'Failed to reset Star Detection options';
        console.error('Error resetting Star Detection options:', err);
        throw err;
      } finally {
        this.isLoadingDetectionOptions = false;
      }
    },

    // Clear detection options error message
    clearDetectionOptionsError() {
      this.detectionOptionsError = null;
    },

    // Load AutoFocus Options
    async loadAutoFocusOptions() {
      try {
        this.isLoadingAutoFocusOptions = true;
        this.autoFocusOptionsError = null;
        const { options, enumOptions } = await apiService.hocusfocus.getAutoFocusOptions();
        this.autoFocusOptions = options;
        this.autoFocusEnumOptions = enumOptions;
        return options;
      } catch (err) {
        this.autoFocusOptionsError = err.message || 'Failed to load AutoFocus options';
        console.error('Error loading AutoFocus options:', err);
        throw err;
      } finally {
        this.isLoadingAutoFocusOptions = false;
      }
    },

    // Save AutoFocus Options
    async saveAutoFocusOptions(options) {
      try {
        this.isLoadingAutoFocusOptions = true;
        this.autoFocusOptionsError = null;
        const response = await apiService.hocusfocus.setAutoFocusOptions(options);
        // Reload options to sync with backend
        await this.loadAutoFocusOptions();
        return response;
      } catch (err) {
        this.autoFocusOptionsError = err.message || 'Failed to save AutoFocus options';
        console.error('Error saving AutoFocus options:', err);
        throw err;
      } finally {
        this.isLoadingAutoFocusOptions = false;
      }
    },

    // Clear autofocus options error message
    clearAutoFocusOptionsError() {
      this.autoFocusOptionsError = null;
    },
  },

  // pinia-plugin-persistedstate v4: persist only the section toggles, never the fetched options.
  persist: {
    key: 'hocusfocus-ui',
    pick: ['resultSections'],
  },
});
