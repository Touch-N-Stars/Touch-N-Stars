import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { timeSync } from '@/utils/timeSync';
import {
  classifyTestResult,
  isAlarmApiMissing,
  isCancelled,
  serverError,
  validateExclusion,
} from '../utils/alarm.js';

// Settings reads and writes run one after the other: two quick toggles must not overtake each
// other, and an older read must not land after a newer write
let settingsQueue = Promise.resolve();
function enqueue(task) {
  const result = settingsQueue.then(task, task);
  settingsQueue = result.catch(() => {});
  return result;
}

// The PINS instance the app talks to: "unsupported" belongs to one instance
function instanceKey() {
  const { ip, port } = useSettingsStore().connection ?? {};
  return `${ip ?? ''}:${port ?? ''}`;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// The PINS alarm: the box beeps the PowerBox by itself on critical events (Touch'N'Stars plugin,
// /api/pins/alarm). Its own store, so that its errors stay in the alarm card.
export const usePinsAlarmStore = defineStore('pinsAlarm', {
  state: () => ({
    settings: null,
    defaults: null,
    stored: false,
    status: null,
    history: [],
    // The box's plugin has no alarm API (older plugin), for the instance in unsupportedKey
    unsupported: false,
    unsupportedKey: '',
    loadError: null,
    saving: false,
    saveError: null,
    testing: false,
    testResult: null,
    silencing: false,
    // Box clock minus phone clock (the Pi has no RTC), for the times the box reports
    clockOffsetMs: 0,
  }),

  getters: {
    // Old plugin on the instance the app is connected to now (not on one switched away from)
    unsupportedHere: (state) => state.unsupported && state.unsupportedKey === instanceKey(),
  },

  actions: {
    markUnsupported() {
      this.unsupported = true;
      this.unsupportedKey = instanceKey();
    },

    // Through the settings queue: an older GET must not land after a newer PUT
    loadSettings() {
      return enqueue(() => this._loadSettings());
    },

    async _loadSettings() {
      try {
        const data = await apiService.getPinsAlarmSettings();
        this.settings = data?.Response?.Settings ?? null;
        this.defaults = data?.Response?.Defaults ?? null;
        this.stored = !!data?.Response?.Stored;
        this.unsupported = false;
        this.loadError = null;
      } catch (error) {
        if (isCancelled(error)) return;
        if (isAlarmApiMissing(error)) {
          this.markUnsupported();
          this.loadError = null;
          return;
        }
        this.loadError = serverError(error) || error?.message || 'error';
      }
    },

    // Status and recent alarms; while the card is visible
    async refreshLive() {
      if (this.unsupported || !this.settings || !apiStore().isBackendReachable) return;
      const [status, history] = await Promise.allSettled([
        apiService.getPinsAlarmStatus(),
        apiService.getPinsAlarmHistory(20),
      ]);
      // Unchanged payloads are not written (no re-render every 5 s)
      if (status.status === 'fulfilled' && status.value?.Response) {
        if (!sameJson(this.status, status.value.Response)) this.status = status.value.Response;
      }
      if (history.status === 'fulfilled' && Array.isArray(history.value?.Response?.Entries)) {
        const entries = history.value.Response.Entries;
        if (!sameJson(this.history, entries)) this.history = entries;
      }
      try {
        await timeSync.ensureSync();
        this.clockOffsetMs = timeSync.serverTimeOffset || 0;
      } catch {
        // keep the last offset
      }
    },

    // patch: the changed fields only, or a function (settings) => patch, evaluated when the save
    // runs (after the saves before it): two quick taps then work on the current settings.
    // Resolves to true, false if the box refused it (the old settings stay), or 'cancelled'.
    saveSettings(patch) {
      return enqueue(async () => {
        const body = typeof patch === 'function' ? patch(this.settings ?? {}) : patch;
        if (!body) return true;
        this.saving = true;
        try {
          const data = await apiService.setPinsAlarmSettings(body);
          if (data?.Response?.Settings) {
            this.settings = data.Response.Settings;
            this.stored = true;
          }
          this.saveError = null;
          return true;
        } catch (error) {
          if (isCancelled(error)) return 'cancelled';
          this.saveError = serverError(error) || error?.message || 'error';
          console.warn('PINS alarm: settings not saved', error);
          return false;
        } finally {
          this.saving = false;
        }
      });
    },

    // null if added, else the reason ('tooShort' | 'tooLong' | 'duplicate' | 'tooMany' | 'save')
    async addExclusion(text) {
      const reason = validateExclusion(text, this.settings?.Exclusions ?? []);
      if (reason) return reason;
      let late = null;
      const ok = await this.saveSettings((settings) => {
        const list = settings.Exclusions ?? [];
        late = validateExclusion(text, list);
        return late ? null : { Exclusions: [...list, text.trim()] };
      });
      if (late) return late;
      return ok === true ? null : 'save';
    },

    async removeExclusion(text) {
      return this.saveSettings((settings) => ({
        Exclusions: (settings.Exclusions ?? []).filter((e) => e !== text),
      }));
    },

    // preview: unsaved sound values to test ({ Volume, ToneMs, PauseMs, BurstSeconds })
    async testBeep(preview) {
      this.testing = true;
      this.testResult = null;
      try {
        const data = await apiService.testPinsAlarm(preview);
        this.testResult = classifyTestResult(data);
      } catch (error) {
        this.testResult = classifyTestResult(error);
        if (this.testResult.kind === 'failed') console.warn('PINS alarm: test beep failed', error);
      } finally {
        this.testing = false;
      }
      await this.refreshLive();
      return this.testResult;
    },

    // minutes 0 ends a mute; a running burst stops either way
    async silence(minutes) {
      this.silencing = true;
      try {
        await apiService.silencePinsAlarm(minutes);
        return true;
      } catch (error) {
        if (!isCancelled(error)) console.warn('PINS alarm: silence failed', error);
        return false;
      } finally {
        this.silencing = false;
        await this.refreshLive();
      }
    },
  },
});
