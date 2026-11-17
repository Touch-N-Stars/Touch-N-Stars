import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { isAppBackgrounded } from '@/utils/appLifecycle';

// Object URLs are only safe to revoke once no <img> still points at them.
const revokeObjectUrl = (url) => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

export const useWebcamStore = defineStore('webcamStore', {
  state: () => ({
    // Webcam connection settings
    snapshotUrl: '',
    refreshInterval: 1000, // in milliseconds

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
  },

  actions: {
    updateSnapshotUrl(url) {
      this.snapshotUrl = url;
      this.saveToLocalStorage();
    },

    updateRefreshInterval(interval) {
      this.refreshInterval = Math.max(500, interval); // minimum 500ms
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

    async refreshSnapshot() {
      if (!this.isValid) {
        this.setConnectionStatus(false, 'errors.noUrl');
        return;
      }

      // Timestamp bypasses camera-side caching
      const timestamp = new Date().getTime();
      const separator = this.snapshotUrl.includes('?') ? '&' : '?';
      const timedUrl = `${this.snapshotUrl}${separator}t=${timestamp}`;

      this.isLoading = true;
      this.errorMessage = null;

      // Fetch through the NINA backend proxy. apiService resolves the backend host from
      // the connection settings — window.location would point at the local app origin in
      // the native iOS/Android WebView. The blob: URL also sidesteps iOS ATS, which blocks
      // plain-HTTP image loads.
      let newImageUrl;
      try {
        const blob = await apiService.proxyRequest(timedUrl);
        newImageUrl = URL.createObjectURL(blob);
      } catch (error) {
        this.isLoading = false;
        // The last frame stays on screen, but the status has to tell the truth: the proxy
        // request failed, so the camera is not reachable right now.
        this.setConnectionStatus(false, 'errors.loadFailed');
        console.debug('Webcam snapshot request failed:', error);

        if (this.autoRefresh) {
          this.scheduleNextRefresh();
        }
        return;
      }

      if (this.currentImageUrl) {
        // Preload next image for seamless transition
        revokeObjectUrl(this.nextImageUrl);
        this.nextImageUrl = newImageUrl;
      } else {
        // First image load
        this.currentImageUrl = newImageUrl;
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
      this.setConnectionStatus(false, 'errors.loadFailed');
      console.error('Webcam image load error:', error);

      // Even on error, if auto-refresh is on, try again after the interval
      if (this.autoRefresh) {
        this.scheduleNextRefresh();
      }
    },

    onNextImageLoad() {
      // Seamless transition: swap images
      this.isTransitioning = true;

      setTimeout(() => {
        revokeObjectUrl(this.currentImageUrl);
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
      revokeObjectUrl(this.nextImageUrl);
      this.nextImageUrl = null;
      this.isLoading = false;
      // Keep connection status as connected if we have a current image
      if (!this.currentImageUrl) {
        this.setConnectionStatus(false, 'errors.nextLoadFailed');
      }
      console.debug('Next webcam image load error (will retry on next refresh):', error);

      // Smart Polling: Schedule next attempt even after error
      if (this.autoRefresh) {
        this.scheduleNextRefresh();
      }
    },

    scheduleNextRefresh() {
      this.stopAutoRefresh(); // Clear any pending timeout

      if (this.autoRefresh && this.refreshInterval > 0) {
        this.autoRefreshTimer = setTimeout(() => {
          if (isAppBackgrounded.value) this.scheduleNextRefresh();
          else this.refreshSnapshot();
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
      const saved = localStorage.getItem('webcam-plugin-settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          this.snapshotUrl = settings.snapshotUrl || '';
          this.refreshInterval = settings.refreshInterval || 1000;
          this.autoRefresh = settings.autoRefresh !== undefined ? settings.autoRefresh : false;
          this.imageQuality = settings.imageQuality || 'medium';
          this.imageWidth = settings.imageWidth || 640;
          this.imageHeight = settings.imageHeight || 480;
        } catch (error) {
          console.error('Error loading webcam settings from localStorage:', error);
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
        localStorage.setItem('webcam-plugin-settings', JSON.stringify(settings));
      } catch (error) {
        console.error('Error saving webcam settings to localStorage:', error);
      }
    },

    resetSettings() {
      this.stopAutoRefresh();
      this.releaseImageUrls();
      this.snapshotUrl = '';
      this.refreshInterval = 1000;
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

      localStorage.removeItem('webcam-plugin-settings');
    },

    resetImageState() {
      this.stopAutoRefresh();
      this.isLoading = false;
      this.isTransitioning = false;
      this.errorMessage = null;
      revokeObjectUrl(this.nextImageUrl);
      this.nextImageUrl = null;
    },

    // Frees both object URLs — call when leaving the page or resetting, otherwise the
    // refresh cycle leaks one blob per frame.
    releaseImageUrls() {
      revokeObjectUrl(this.currentImageUrl);
      revokeObjectUrl(this.nextImageUrl);
      this.currentImageUrl = null;
      this.nextImageUrl = null;
    },
  },
});
