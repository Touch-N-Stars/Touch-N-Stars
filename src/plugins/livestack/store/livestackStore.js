import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';

// Settings requests - loads and saves - go to the backend one at a time, so an older response can't
// overwrite a newer one
let settingsQueue = Promise.resolve();
let pendingSettingsSaves = 0;

function enqueueSettingsRequest(task) {
  const run = settingsQueue.then(task);
  settingsQueue = run.catch(() => {});
  return run;
}

// A TNS plugin without the Livestack routes answers 404 without its JSON error body
function isUnsupported(error) {
  return error?.response?.status === 404 && error?.response?.data?.Success !== false;
}

export const useLivestackStore = defineStore('livestackStore', {
  state: () => ({
    availableImages: [],
    availableTargets: [],
    availableFilters: [],
    selectedFilter: null,
    selectedTarget: null,
    currentImageTarget: null,
    currentImageFilter: null,
    currentImageUrl: null,
    lastImageUpdate: null,
    status: 'stopped',
    resetSupported: true,
    // RGB combination (PINS only - on Windows the plugin has its own WPF wizard)
    rgbCandidates: [],
    rgbBusy: false,
    rgbError: null,
    // The Livestack plugin's own options, served by the TNS plugin (PINS only - on Windows the
    // plugin's options page is the place for them)
    settings: null,
    settingsLoadError: null,
    // The TNS plugin doesn't offer the settings (older version): the section is hidden
    settingsUnsupported: false,
    settingsBusy: false,
    // Field name -> { code, message } of the last refused change; '_' for one without a field
    settingsErrors: {},
    // The Livestack calibration master library (Bias/Dark/Flat), PINS only as well
    calibration: null,
    calibrationLoadError: null,
    // Error code of a failed load, e.g. livestack-unavailable
    calibrationLoadErrorCode: null,
    calibrationUnsupported: false,
    calibrationBusy: false,
    // { field, code, message } of the last refused library change
    calibrationError: null,
  }),
  getters: {
    currentCounter: (state) => {
      console.log('Getting currentCounter for filter:', state.selectedFilter);
      return state.selectedFilter?.count ?? '--';
    },

    isTrackingStacks: () => {
      const settingsStore = useSettingsStore();
      return settingsStore.livestack?.isTrackingStacks ?? true;
    },

    showFilters: () => {
      const settingsStore = useSettingsStore();
      // Fall back to true if persisted settings were missing the livestack section
      return settingsStore.livestack?.showFilters ?? true;
    },

    activeImages() {
      return this.showFilters
        ? this.availableImages
        : this.availableImages.filter((img) => img.filter === 'RGB');
    },

    activeTargets() {
      const targetsMap = new Map();
      this.activeImages.forEach(({ target, count }) => {
        if (!targetsMap.has(target)) {
          targetsMap.set(target, { label: target, count });
        }
      });
      return Array.from(targetsMap.values()).toSorted((a, b) => a.label.localeCompare(b.label));
    },

    activeFilters() {
      if (!this.selectedTarget) return [];
      const filtersMap = new Map();
      this.activeImages
        .filter((img) => img.target === this.selectedTarget.label)
        .forEach(({ filter, count }) => {
          if (filter && !filtersMap.has(filter)) {
            filtersMap.set(filter, { label: filter, count });
          }
        });
      return Array.from(filtersMap.values()).toSorted((a, b) => a.label.localeCompare(b.label));
    },
  },
  actions: {
    setShowFilters(show) {
      const settingsStore = useSettingsStore();
      if (!settingsStore.livestack) {
        settingsStore.livestack = { showFilters: true, isTrackingStacks: true };
      }
      settingsStore.livestack.showFilters = show;
      // If filters are hidden, ensure selection stays valid (RGB-only branch)
      this.selectedFilter = this._defaultFilter();
    },

    setTrackingStacks(track) {
      const settingsStore = useSettingsStore();
      if (!settingsStore.livestack) {
        settingsStore.livestack = { showFilters: true, isTrackingStacks: true };
      }
      settingsStore.livestack.isTrackingStacks = track;
    },

    selectTarget(targetLabel) {
      const found = this.availableTargets.find((t) => t.label === targetLabel);
      this.selectedTarget =
        found || (this.availableTargets.length ? this.availableTargets[0] : null);

      this.availableFilters = this._filtersForTarget(this.selectedTarget?.label);
      this.selectedFilter = this._defaultFilter();
    },

    selectFilter(filterLabel) {
      const found = this.availableFilters.find((f) => f.label === filterLabel);
      if (found) {
        this.selectedFilter = found;
      } else if (!this.selectedFilter) {
        this.selectedFilter = this._defaultFilter();
      }
    },

    // Update count for a specific target/filter from WebSocket event
    updateCountForTargetFilter(targetLabel, filterLabel, count) {
      // Find or create target
      let image = this.availableImages.find(
        (img) => img.target === targetLabel && img.filter === filterLabel
      );
      if (!image) {
        this.availableImages.push({ target: targetLabel, filter: filterLabel, count });
      } else {
        image.count = count;
      }

      this.makeAvailableTargets();
      this.makeAvailableFilters();

      if (this.isTrackingStacks) {
        const filterAllowed = this.showFilters || filterLabel === 'RGB';
        if (filterAllowed) {
          this.selectTarget(targetLabel);
          this.selectFilter(filterLabel);
        }
      }
    },

    setCurrentImageUrl(imageUrl, target = null, filter = null) {
      // Clean up previous image URL if it exists
      if (this.currentImageUrl) {
        URL.revokeObjectURL(this.currentImageUrl);
      }
      this.currentImageUrl = imageUrl;
      this.currentImageTarget = target;
      this.currentImageFilter = filter;
      this.lastImageUpdate = new Date().toISOString();
    },

    clearCurrentImageUrl() {
      if (this.currentImageUrl) {
        URL.revokeObjectURL(this.currentImageUrl);
      }
      this.currentImageUrl = null;
      this.currentImageTarget = null;
      this.currentImageFilter = null;
      this.lastImageUpdate = null;
    },
    shouldReloadImage(target, filter) {
      // Reload if no image cached or target/filter changed
      return (
        !this.currentImageUrl ||
        this.currentImageTarget !== target ||
        this.currentImageFilter !== filter
      );
    },
    forceReloadImage() {
      // Force reload even if cached - used for websocket updates
      return true;
    },
    toogleShowFilters() {
      this.setShowFilters(!this.showFilters);
    },

    // Check image availability and initialize store state
    async checkImageAvailability() {
      try {
        const counts = await this.loadAllTargetFilterCounts();
        this.makeAvailableImages(counts);
        if (this.selectedTarget && this.selectedFilter) {
          return true;
        }
      } catch (error) {
        console.error('Error checking image availability:', error);
        this.makeAvailableImages([]);
        return false;
      }
    },

    // Fetch all target/filter/count tuples up front
    async loadAllTargetFilterCounts() {
      const result = await apiService.livestackImageAvailable();
      if (!result.Success || !Array.isArray(result.Response)) {
        console.log('✗ API response not successful or Response not array');
        return [];
      }

      const pairs = Array.from(
        new Map(
          result.Response.map(({ Target, Filter }) => ({ target: Target, filter: Filter }))
            .filter(({ target, filter }) => target && filter)
            .map(({ target, filter }) => [`${target}|${filter}`, { target, filter }])
        ).values()
      );

      console.log(`Fetching counts for ${pairs.length} target/filter pairs`);
      const counts = await Promise.all(
        pairs.map(async ({ target, filter }) => {
          try {
            const info = await apiService.livestackImageInfo(target, filter);
            const count =
              info?.Success && info.Response
                ? info.Response.IsMonochrome
                  ? (info.Response.StackCount ?? '--')
                  : `${info.Response.RedStackCount} | ${info.Response.GreenStackCount} | ${info.Response.BlueStackCount}`
                : '--';
            return { target, filter, count };
          } catch (error) {
            console.error('Error fetching livestack image info:', error);
            return { target, filter, count: '--' };
          }
        })
      );

      return counts;
    },

    // Build availableImages from counts
    makeAvailableImages(counts = []) {
      const normalized = Array.isArray(counts)
        ? counts.filter((c) => c && c.target && c.filter)
        : [];
      this.availableImages = normalized;
      this.makeAvailableTargets();
      this.makeAvailableFilters();
    },

    makeAvailableTargets() {
      const targetsMap = new Map();
      this.activeImages.forEach(({ target, count }) => {
        if (!targetsMap.has(target)) {
          targetsMap.set(target, { label: target, count });
        }
      });
      this.availableTargets = Array.from(targetsMap.values()).toSorted((a, b) =>
        a.label.localeCompare(b.label)
      );
      if (this.selectedTarget == null) {
        this.selectedTarget = this.availableTargets[0] || null;
      }
    },

    makeAvailableFilters() {
      this.availableFilters = this._filtersForTarget(this.selectedTarget?.label).toSorted((a, b) =>
        a.label.localeCompare(b.label)
      );
      this.selectedFilter = this._defaultFilter();
    },

    // Fetch info for a given target/filter using the API (authoritative count)
    async fetchAndUpdateCount(target, filter) {
      const targetLabel = target?.label ?? target;
      const filterLabel = filter?.label ?? filter;
      if (!targetLabel || !filterLabel) return;
      try {
        const info = await apiService.livestackImageInfo(targetLabel, filterLabel);
        if (info && info.Success && info.Response) {
          const count = info.Response.IsMonochrome
            ? (info.Response.StackCount ?? '--')
            : `${info.Response.RedStackCount} | ${info.Response.GreenStackCount} | ${info.Response.BlueStackCount}`;
          this.updateCountForTargetFilter(targetLabel, filterLabel, count);
        } else {
          console.log('livestackImageInfo returned no info for', targetLabel, filterLabel);
        }
      } catch (err) {
        console.error('Error fetching livestack image info:', err);
      }
    },

    // Collect filters for a given target from the current tuples
    _filtersForTarget(targetLabel) {
      if (!targetLabel) return [];

      const filtersMap = new Map();
      this.activeImages
        .filter((img) => img.target === targetLabel)
        .forEach(({ filter, count }) => {
          if (filter && !filtersMap.has(filter)) {
            filtersMap.set(filter, { label: filter, count });
          }
        });

      return Array.from(filtersMap.values());
    },
    _defaultFilter() {
      return (
        this.activeFilters.find((f) => f.label === this.selectedFilter?.label) ||
        this.availableFilters[0] ||
        null
      );
    },

    resetStack() {
      this.availableImages = [];
      this.availableTargets = [];
      this.availableFilters = [];
      this.selectedFilter = null;
      this.selectedTarget = null;
      this.rgbCandidates = [];
      this.rgbError = null;
      this.clearCurrentImageUrl();
    },

    // ---- RGB combination -------------------------------------------------

    async loadRgbCandidates() {
      try {
        const result = await apiService.livestackRgbAvailable();
        this.rgbCandidates =
          result?.Success && Array.isArray(result.Response) ? result.Response : [];
      } catch (error) {
        console.error('Error loading livestack rgb candidates:', error);
        this.rgbCandidates = [];
      }
      return this.rgbCandidates;
    },

    async createRgbCombination({ target, red, green, blue }) {
      this.rgbBusy = true;
      this.rgbError = null;
      try {
        const result = await apiService.livestackCreateRgb(target, red, green, blue);
        if (!result?.Success) {
          this.rgbError = result?.Error || 'unknown';
          return false;
        }
        await this.loadRgbCandidates();
        await this.checkImageAvailability();
        return true;
      } catch (error) {
        console.error('Error creating livestack rgb combination:', error);
        this.rgbError = error?.response?.data?.Error || error.message;
        return false;
      } finally {
        this.rgbBusy = false;
      }
    },

    async deleteRgbCombination(target) {
      this.rgbBusy = true;
      this.rgbError = null;
      try {
        const result = await apiService.livestackDeleteRgb(target);
        if (!result?.Success) {
          this.rgbError = result?.Error || 'unknown';
          return false;
        }
        // Drop the cached RGB entry right away so the selectors do not offer a dead image
        this.availableImages = this.availableImages.filter(
          (img) => !(img.target === target && img.filter === 'RGB')
        );
        this.makeAvailableTargets();
        this.makeAvailableFilters();
        await this.loadRgbCandidates();
        await this.checkImageAvailability();
        return true;
      } catch (error) {
        console.error('Error deleting livestack rgb combination:', error);
        this.rgbError = error?.response?.data?.Error || error.message;
        return false;
      } finally {
        this.rgbBusy = false;
      }
    },

    // ---- Livestack plugin settings ----------------------------------------

    // The dialog's first load (initial) starts without values, so nothing of another PINS instance is
    // shown; a later reload that fails keeps the values on screen and only reports the error.
    loadSettings({ initial = false } = {}) {
      if (initial) {
        this.settings = null;
      }
      return enqueueSettingsRequest(() => this.fetchSettings());
    },

    async fetchSettings() {
      try {
        const result = await apiService.getLivestackSettings();
        if (result?.Success) {
          this.settings = result.Response;
          this.settingsLoadError = null;
          this.settingsUnsupported = false;
        } else {
          this.settingsLoadError = result?.Error || 'unknown';
        }
      } catch (error) {
        console.error('Error loading livestack settings:', error);
        this.settingsUnsupported = isUnsupported(error);
        this.settingsLoadError = error?.response?.data?.Error || error.message;
      }
      return this.settings;
    },

    /**
     * Stores a subset of the settings, e.g. { SaveStackedLights: true }. The backend checks all of
     * them before storing any; on a refusal the shown values stay as they were and settingsErrors
     * names the refused fields. Returns whether the change was stored.
     */
    saveSettings(patch) {
      pendingSettingsSaves += 1;
      this.settingsBusy = true;
      return enqueueSettingsRequest(() => this.storeSettings(patch)).finally(() => {
        pendingSettingsSaves -= 1;
        this.settingsBusy = pendingSettingsSaves > 0;
      });
    },

    async storeSettings(patch) {
      // Only the errors of what is saved now are cleared; a refusal of another field stays visible
      const remaining = { ...this.settingsErrors };
      for (const key of [...Object.keys(patch), '_']) {
        delete remaining[key];
      }
      this.settingsErrors = remaining;
      try {
        const result = await apiService.setLivestackSettings(patch);
        if (result?.Success) {
          this.settings = result.Response;
          return true;
        }

        const errors = Array.isArray(result?.Response?.Errors) ? result.Response.Errors : [];
        this.settingsErrors = {
          ...this.settingsErrors,
          ...(errors.length
            ? Object.fromEntries(
                errors.map((e) => [e.Field || '_', { code: e.Code, message: e.Message }])
              )
            : { _: { code: 'unknown', message: result?.Error || 'unknown' } }),
        };

        // A 409 means a stack started in the meantime: reload so the locks show (already queued)
        await this.fetchSettings();
        return false;
      } catch (error) {
        console.error('Error saving livestack settings:', error);
        this.settingsErrors = {
          ...this.settingsErrors,
          _: { code: 'unknown', message: error.message },
        };
        return false;
      }
    },

    // ---- Livestack calibration library -------------------------------------

    // Like loadSettings: only the first load of the dialog starts without a library on screen
    async loadCalibration({ initial = false } = {}) {
      if (initial) {
        this.calibration = null;
      }
      try {
        const result = await apiService.getLivestackCalibration();
        if (result?.Success) {
          this.calibration = result.Response;
          this.calibrationLoadError = null;
          this.calibrationLoadErrorCode = null;
          this.calibrationUnsupported = false;
        } else {
          this.calibrationLoadError = result?.Error || 'unknown';
          this.calibrationLoadErrorCode = result?.Response?.Errors?.[0]?.Code ?? null;
        }
      } catch (error) {
        console.error('Error loading the livestack calibration library:', error);
        this.calibrationUnsupported = isUnsupported(error);
        this.calibrationLoadError = error?.response?.data?.Error || error.message;
        this.calibrationLoadErrorCode = null;
      }
      return this.calibration;
    },

    // The FITS header of a master as a proposal for adding it, or null (calibrationError says why)
    async inspectCalibrationMaster(path) {
      return this.runCalibrationChange(() => apiService.inspectLivestackCalibrationMaster(path));
    },

    async addCalibrationMaster(master) {
      const result = await this.runCalibrationChange(() =>
        apiService.addLivestackCalibrationMaster(master)
      );
      if (result) {
        this.calibration = result;
      }
      return result !== null;
    },

    // The whole entry identifies it: desktop Livestack allows the same file twice with other values
    async removeCalibrationMaster(master) {
      const result = await this.runCalibrationChange(() =>
        apiService.removeLivestackCalibrationMaster(master)
      );
      if (result) {
        this.calibration = result;
      }
      return result !== null;
    },

    // Runs one library request; returns its Response, or null with calibrationError set
    async runCalibrationChange(request) {
      this.calibrationBusy = true;
      this.calibrationError = null;
      try {
        const result = await request();
        if (result?.Success) {
          return result.Response;
        }

        const error = result?.Response?.Errors?.[0];
        this.calibrationError = {
          field: error?.Field ?? null,
          code: error?.Code ?? 'unknown',
          message: error?.Message || result?.Error || 'unknown',
        };
        // Another device may have changed the library, or a stack started: show the current state
        await this.loadCalibration();
        return null;
      } catch (error) {
        console.error('Error changing the livestack calibration library:', error);
        this.calibrationError = { field: null, code: 'unknown', message: error.message };
        // A timed-out request may still have been carried out
        await this.loadCalibration();
        return null;
      } finally {
        this.calibrationBusy = false;
      }
    },
  },
});
