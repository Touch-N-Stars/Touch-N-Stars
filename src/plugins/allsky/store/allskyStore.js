import { defineStore } from 'pinia';

export const useallskyStore = defineStore('allskyStore', {
  state: () => ({
    // allsky connection settings
    snapshotUrl: '',
    refreshInterval: 60000, // in milliseconds (default 1 min)

    // Display settings
    autoRefresh: false,

    // Image settings
    imageQuality: 'medium', // low, medium, high
    imageWidth: 640,
    imageHeight: 480,

    // Status
    isConnected: false,
    lastUpdate: null,
    errorMessage: null,
    currentImageUrl: null,
    nextImageUrl: null,
    isLoading: false,
    isTransitioning: false,
    autoRefreshTimer: null,
  }),

  getters: {
    isValid: (state) => {
      return state.snapshotUrl && state.snapshotUrl.trim() !== '';
    },

    refreshIntervalSeconds: (state) => {
      return Math.round(state.refreshInterval / 1000);
    },

    refreshIntervalMinutes: (state) => {
      return Math.round(state.refreshInterval / 60000);
    },
  },

  actions: {
    updateSnapshotUrl(url) {
      this.snapshotUrl = url;
      this.saveToLocalStorage();
    },

    updateRefreshInterval(interval) {
      this.refreshInterval = Math.max(60000, interval); // minimum 1 minute
      this.saveToLocalStorage();

      // Restart auto refresh with new interval if it's currently active
      if (this.autoRefresh) {
        this.startAutoRefresh();
      }
    },

    updateDisplaySettings(settings) {
      if (settings.autoRefresh !== undefined) {
        this.autoRefresh = settings.autoRefresh;
      }
      this.saveToLocalStorage();
    },

    updateImageSettings(settings) {
      if (settings.imageQuality) {
        this.imageQuality = settings.imageQuality;
      }
      if (settings.imageWidth) {
        this.imageWidth = Math.max(320, settings.imageWidth);
      }
      if (settings.imageHeight) {
        this.imageHeight = Math.max(240, settings.imageHeight);
      }
      this.saveToLocalStorage();
    },

    setConnectionStatus(connected, errorMessage = null) {
      this.isConnected = connected;
      this.errorMessage = errorMessage;
      this.lastUpdate = connected ? new Date().toISOString() : null;
    },

    refreshSnapshot() {
      if (!this.isValid) {
        this.setConnectionStatus(false, 'No snapshot URL configured');
        return;
      }

      // Generate new timestamp-based URL to bypass cache
      const timestamp = new Date().getTime();
      const separator = this.snapshotUrl.includes('?') ? '&' : '?';
      const newImageUrl = `${this.snapshotUrl}${separator}t=${timestamp}`;

      if (this.currentImageUrl) {
        // Preload next image for seamless transition
        this.nextImageUrl = newImageUrl;
        this.isLoading = true;
        this.errorMessage = null;
      } else {
        // First image load
        this.currentImageUrl = newImageUrl;
        this.isLoading = true;
        this.errorMessage = null;
      }
    },

    onCurrentImageLoad() {
      this.isLoading = false;
      this.setConnectionStatus(true);

      // If we are doing the very first load and auto-refresh is on, start the cycle
      if (this.autoRefresh) {
        this.scheduleNextRefresh();
      }
    },

    onCurrentImageError(error) {
      this.isLoading = false;
      this.setConnectionStatus(false, 'Failed to load allsky image');
      console.error('allsky image load error:', error);

      // Even on error, if auto-refresh is on, try again after the interval
      if (this.autoRefresh) {
        this.scheduleNextRefresh();
      }
    },

    onNextImageLoad() {
      // Seamless transition: swap images
      this.isTransitioning = true;

      setTimeout(() => {
        this.currentImageUrl = this.nextImageUrl;
        this.nextImageUrl = null;
        this.isTransitioning = false;
        this.isLoading = false;
        this.setConnectionStatus(true);

        // Smart Polling: Schedule next refresh only AFTER successful load and swap
        if (this.autoRefresh) {
          this.scheduleNextRefresh();
        }
      }, 50); // Small delay for smooth transition
    },

    onNextImageError(error) {
      this.nextImageUrl = null;
      this.isLoading = false;
      // Keep connection status as connected if we have a current image
      if (!this.currentImageUrl) {
        this.setConnectionStatus(false, 'Failed to load next allsky image');
      }
      console.debug('Next allsky image load error (will retry on next refresh):', error);

      // Smart Polling: Schedule next attempt even after error
      if (this.autoRefresh) {
        this.scheduleNextRefresh();
      }
    },

    scheduleNextRefresh() {
      this.stopAutoRefresh(); // Clear any pending timeout

      if (this.autoRefresh && this.refreshInterval > 0) {
        this.autoRefreshTimer = setTimeout(() => {
          this.refreshSnapshot();
        }, this.refreshInterval);
      }
    },

    startAutoRefresh() {
      this.autoRefresh = true;
      this.refreshSnapshot(); // Trigger immediate first load/refresh
    },

    stopAutoRefresh() {
      if (this.autoRefreshTimer) {
        clearTimeout(this.autoRefreshTimer);
        this.autoRefreshTimer = null;
      }
    },

    loadFromLocalStorage() {
      const saved = localStorage.getItem('allsky-plugin-settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          this.snapshotUrl = settings.snapshotUrl || '';
          this.refreshInterval = settings.refreshInterval || 60000;
          this.autoRefresh = settings.autoRefresh !== undefined ? settings.autoRefresh : false;
          this.imageQuality = settings.imageQuality || 'medium';
          this.imageWidth = settings.imageWidth || 640;
          this.imageHeight = settings.imageHeight || 480;
        } catch (error) {
          console.error('Error loading allsky settings from localStorage:', error);
        }
      }
    },

    saveToLocalStorage() {
      const settings = {
        snapshotUrl: this.snapshotUrl,
        refreshInterval: this.refreshInterval,
        autoRefresh: this.autoRefresh,
        imageQuality: this.imageQuality,
        imageWidth: this.imageWidth,
        imageHeight: this.imageHeight,
      };

      try {
        localStorage.setItem('allsky-plugin-settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving allsky settings to localStorage:', error);
      }
    },

    resetSettings() {
      this.stopAutoRefresh();
      this.snapshotUrl = '';
      this.refreshInterval = 60000;
      this.autoRefresh = false;
      this.imageQuality = 'medium';
      this.imageWidth = 640;
      this.imageHeight = 480;
      this.isConnected = false;
      this.lastUpdate = null;
      this.errorMessage = null;
      this.currentImageUrl = null;
      this.nextImageUrl = null;
      this.isLoading = false;
      this.isTransitioning = false;
      this.autoRefreshTimer = null;

      localStorage.removeItem('allsky-plugin-settings');
    },

    resetImageState() {
      this.stopAutoRefresh();
      this.isLoading = false;
      this.isTransitioning = false;
      this.errorMessage = null;
      this.nextImageUrl = null;
    },
  },
});
