import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';

// Older versions persisted the complete store state for ALL instances under
// this one global key; kept only as a read-once migration fallback.
const LEGACY_GLOBAL_KEY = 'tppaStore';

// Filter, gain and exposure are equipment properties, not device preferences:
// every client connected to the same rig should see the same values. They
// used to be scoped per (device, instance) via this localStorage key - kept
// only as a one-time migration source for the first client to reconnect after
// the update, then removed.
function legacyInstanceKey() {
  const connection = useSettingsStore().connection;
  return `tppaStore.settings:${connection?.ip ?? ''}:${connection?.port ?? ''}`;
}

const BACKEND_SETTINGS_KEY = 'tppa_settings';

const defaultSettings = () => ({
  StartFromCurrentPosition: false,
  EastDirection: false,
  ManualMode: false,
  ExposureTime: null,
  Gain: null,
  Filter: null,
});

export const useTppaStore = defineStore('tppaStore', {
  state: () => ({
    lastMessage: null,
    status: 'nicht verbunden',
    isConnected: false,
    currentMessage: null,
    isRunning: false,
    isSouthernHemisphere: false,
    showAzimuthError: '',
    showAltitudeError: '',
    showTotalError: '',
    totalErrorDeg: 0,
    AzimuthErrorDeg: 0,
    AltitudeErrorDEG: 0,
    azimuthCorDirectionLeft: false,
    altitudeCorDirectionTop: false,
    isWithinTolerance: false,
    isPause: false,
    initialErrorLarge: false,
    initialErrorHuge: false,
    declinationSpreadLarge: false,
    declinationSpreadArcsec: 0,
    nearEastWest: false,
    distanceToEastWest: null,
    settings: defaultSettings(),
    // Why the alignment does not get anywhere ({ key, detail }), shown on the TPPA page. The
    // socket itself never reports an error, see utils/tppaProblems.js.
    problem: null,
    // The alignment ran and was stopped: NINA switches tracking off at that point.
    stoppedAfterRun: false,
    // Guards the save watcher in TppaPage.vue: must stay false until
    // loadTppaSettings() has applied either backend or migrated values, so the
    // watcher never writes the pre-load defaults back to the backend.
    settingsReady: false,
  }),

  actions: {
    setRunning(isRunning) {
      this.isRunning = isRunning;
    },
    // Fetch the current TPPA status (running or not) from the backend.
    async fetchInfo() {
      try {
        const response = await apiService.getTppaInfo();
        if (response?.Success) {
          this.setRunning(!!response.IsRunning);
        }
      } catch (error) {
        console.error('Error fetching TPPA info:', error);
      }
    },

    // One-time migration source: the instance-scoped key from the client this
    // rig was first reconnected with after the update, falling back to the
    // even older global key. Both are removed once consumed.
    _readLegacySettings() {
      try {
        const scoped = localStorage.getItem(legacyInstanceKey());
        if (scoped) return JSON.parse(scoped);
        const global = localStorage.getItem(LEGACY_GLOBAL_KEY);
        if (global) return JSON.parse(global)?.settings ?? null;
      } catch (error) {
        console.error('Error reading legacy TPPA settings from localStorage:', error);
      }
      return null;
    },

    _clearLegacySettings() {
      localStorage.removeItem(legacyInstanceKey());
      localStorage.removeItem(LEGACY_GLOBAL_KEY);
    },

    // Called from a floating debounce timer in TppaPage.vue, so it must never
    // reject. A failed write is not fatal: settingsReady stays true and the
    // next edit retries. Deliberately no toast - the watcher fires on every
    // change, and an unreachable rig would spam the user.
    async saveSettings() {
      try {
        const res = await apiService.createSetting({
          Key: BACKEND_SETTINGS_KEY,
          Value: JSON.stringify(this.settings),
        });
        if (res?.StatusCode === 409) {
          await apiService.updateSetting(BACKEND_SETTINGS_KEY, JSON.stringify(this.settings));
        }
      } catch (error) {
        console.error('Error saving TPPA settings:', error);
      }
    },

    // Load the rig-shared settings from the backend. Called once per
    // connection from settingsStore.loadAllBackendSettings(), which runs
    // unawaited, so this must never reject.
    async loadTppaSettings() {
      try {
        const legacy = this._readLegacySettings();
        const response = await apiService.getSetting(BACKEND_SETTINGS_KEY);

        if (response?.Response?.Value !== undefined) {
          // Merge onto defaults, not onto the in-memory values: switching to a
          // rig with nothing saved for a given field must not carry over the
          // previous rig's value.
          this.settings = { ...defaultSettings(), ...JSON.parse(response.Response.Value) };
        } else if (response?.StatusCode === 404) {
          this.settings = { ...defaultSettings(), ...(legacy ?? {}) };
          await this.saveSettings();
        } else {
          // Neither a stored value nor a clean "not found" - e.g. a 500 or an
          // empty body while the plugin restarts. Nothing was migrated, so the
          // legacy keys must survive for the next attempt.
          return;
        }

        // Only reached once the legacy data was actually consumed.
        this._clearLegacySettings();
        this.settingsReady = true;
      } catch (error) {
        // settingsReady stays false on purpose: the save watcher must not go
        // live while only the defaults are in memory, or the first edit would
        // overwrite the rig's real settings. TppaPage retries on open, and the
        // next connection re-runs loadAllBackendSettings().
        console.error('Error loading TPPA settings:', error);
      }
    },
  },
});
