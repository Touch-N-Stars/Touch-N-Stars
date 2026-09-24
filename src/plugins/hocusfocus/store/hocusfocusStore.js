import { defineStore } from 'pinia';
import apiService from '@/services/apiService';

export const useHocusFocusStore = defineStore('hocusfocus', {
  state: () => ({
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
