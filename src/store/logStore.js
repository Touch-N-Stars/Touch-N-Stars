import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import i18n from '@/i18n';
import { usePinsAlarmStore } from '@/plugins/pinsDevices/store/pinsAlarmStore';
import { isAlarmApiMissing } from '@/plugins/pinsDevices/utils/alarm';
import { createPoller } from '@/utils/poller';
import { useFramingStore } from '@/store/framingStore';
import { findLatestSolvedRotation, newestLogTime } from '@/utils/plateSolveLog';

const SOLVE_MAX_AGE_MS = 10 * 60 * 1000;
const ALARM_MUTE_MINUTES = 30;

// Mutes the box's alarm (see the error toast); the result as a toast of its own
async function muteBoxAlarm(toastStore) {
  const t = i18n.global.t;
  try {
    await apiService.silencePinsAlarm(ALARM_MUTE_MINUTES);
    toastStore.showToast({
      type: 'success',
      title: t('plugins.pinsDevices.config.alarm.title'),
      message: t('plugins.pinsDevices.config.alarm.mutedFromToast', {
        minutes: ALARM_MUTE_MINUTES,
      }),
    });
  } catch (error) {
    if (error?.code === 'ERR_CANCELED') return;
    // A plugin without the alarm: no more mute buttons, and say why
    const missing = isAlarmApiMissing(error);
    if (missing) usePinsAlarmStore().markUnsupported();
    toastStore.showToast({
      type: 'warning',
      title: t('plugins.pinsDevices.config.alarm.title'),
      message: t(`plugins.pinsDevices.config.alarm.${missing ? 'updateRequired' : 'muteFailed'}`),
    });
  }
}
const LOG_POLL_INTERVAL_MS = 2000;

// Cheap identity of a log window: the backend returns the newest N entries, so
// an unchanged window has the same length and the same entries at both ends.
function logWindowSignature(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return '';
  const first = logs[0];
  const last = logs[logs.length - 1];
  return `${logs.length}|${first?.timestamp}|${first?.message}|${last?.timestamp}|${last?.message}`;
}

export const useLogStore = defineStore('LogStore', {
  state: () => ({
    LogsInfo: {
      logs: [],
    },
    canSetPos: true,
    foundPos: 0,
    foundPosTime: new Date(),

    focuserData: [],
    startAfTime: '',
    lastHfrLogTime: 0,
    lastErrorWarningTimestamp:
      localStorage.getItem('lastErrorWarningTimestamp') || '1970-01-01T00:00:00.0000',

    messageFilters: [
      // Nachrichten die ANGEZEIGT werden sollen (Whitelist)
      'guide star',
      'Platesolve failed',
      'Timed-out waiting for guider to settle',
      'PHDError:',
      'Telescope is not tracking',
    ],

    // Regeln zum Ändern von Level und Text bestimmter Log-Einträge
    logTransformRules: [
      {
        condition: (log) =>
          log.level === 'ERROR' &&
          log.message.includes('error:timed-out waiting for guider to settle'),
        transform: (log) => ({ ...log, level: 'WARNING', message: log.message }),
      },
      {
        condition: (log) => log.level === 'INFO' && log.message.includes('Platesolve failed'),
        transform: (log) => ({ ...log, level: 'WARNING', message: log.message }),
      },
      {
        condition: (log) => log.message.includes('error:timed-out waiting for guider to settle'),
        transform: (log) => ({ ...log, message: 'Timed-out waiting for guider to settle' }),
      },
    ],
  }),

  actions: {
    async fetchLogInfos() {
      try {
        const store = apiStore();

        if (!store.isBackendReachable) {
          console.warn('Backend is not reachable log');
          return;
        }

        // Logs vom Backend holen (z.B. die letzten 500)
        const logs = await apiService.getLastLogs('500');
        // Most polls return the same window; skipping it spares the reactive
        // array swap (and every watcher on it) plus the scans below. Compared
        // against the stored window, not a cached value, so a reset of LogsInfo
        // (clearAllStates) always lets the next poll through.
        const signature = logWindowSignature(logs);
        if (signature && signature === logWindowSignature(this.LogsInfo.logs)) return;
        this.LogsInfo.logs = logs;

        // Prüfe auf neue ERROR/WARNING Meldungen
        this.checkForNewErrorWarnings(logs);

        // Derive the camera rotation from every successful plate solve
        this.updateSolvedRotation(logs);
        //console.log('Alle Logs:', this.LogsInfo);
      } catch (error) {
        console.error('Error fetching information:', error);
      }
    },

    // Every solve in NINA and PINS writes "Platesolve successful: ... Position
    // Angle: ...". There is no socket event for it, so this log line is the only
    // place where the app also sees the solves triggered by the sequencer.
    updateSolvedRotation(logs) {
      const latest = findLatestSolvedRotation(logs);
      if (!latest) return;
      // At app start old solves are still inside the log window; they must not
      // overwrite the current angle. The age is measured against the newest
      // log line, not the phone clock: a PINS host boots with a stale clock and
      // may run in another time zone, which made every solve look outdated.
      const reference = newestLogTime(logs);
      if (new Date(latest.timestamp).getTime() < reference - SOLVE_MAX_AGE_MS) return;

      useFramingStore().applySolvedRotation(latest.angle, latest.timestamp);
    },

    isWithinTenMinutes(timestamp) {
      const now = new Date();
      const logTime = new Date(timestamp);
      const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
      return logTime >= tenMinutesAgo;
    },

    formatTimestamp(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    },

    // Transformiert Log-Einträge basierend auf den definierten Regeln
    transformLog(log) {
      let transformedLog = { ...log };

      for (const rule of this.logTransformRules) {
        if (rule.condition(transformedLog)) {
          transformedLog = rule.transform(transformedLog);
        }
      }

      return transformedLog;
    },

    isMessageAllowed(message) {
      // Wenn keine Filter definiert sind, alle Nachrichten erlauben
      if (this.messageFilters.length === 0) {
        return true;
      }

      // Prüfen ob die Nachricht einen der erlaubten Filter enthält
      return this.messageFilters.some((filter) =>
        message.toLowerCase().includes(filter.toLowerCase())
      );
    },

    checkForNewErrorWarnings(logs) {
      if (!logs || !Array.isArray(logs)) return;

      // Filtere ERROR und WARNING Nachrichten (OHNE Transformation der ursprünglichen Logs)
      const errorWarningLogs = logs.filter(
        (log) => log.level === 'ERROR' || log.level === 'WARNING' || log.level === 'INFO'
      );

      // Filtere nur Meldungen der letzten 10 Minuten
      const recentLogs = errorWarningLogs.filter((log) => this.isWithinTenMinutes(log.timestamp));

      // Erlaube nur Nachrichten, die in den Message-Filtern enthalten sind
      const allowedLogs = recentLogs.filter((log) => this.isMessageAllowed(log.message));

      // Sortiere nach Timestamp (neueste zuerst)
      allowedLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Finde neue Meldungen seit dem letzten gespeicherten Timestamp
      const newLogs = allowedLogs.filter(
        (log) => new Date(log.timestamp) > new Date(this.lastErrorWarningTimestamp)
      );

      // Zeige neue Meldungen in ToastModal an
      if (newLogs.length > 0) {
        const toastStore = useToastStore();

        // Zeige die neueste Meldung
        const latestLog = newLogs[0];

        // Transformiere nur für die Anzeige (nicht die ursprünglichen Logs)
        const displayLog = this.transformLog(latestLog);

        const type =
          displayLog.level === 'ERROR'
            ? 'error'
            : displayLog.level === 'WARNING'
              ? 'warning'
              : 'info';
        const formattedTime = this.formatTimestamp(latestLog.timestamp);

        // On a PINS box the box itself beeps the PowerBox on errors (alarm service of the
        // plugin); the error toast offers to mute it, as the alarm settings are deep in the
        // PINS-Devices page
        const muteAction =
          type === 'error' && apiStore().isPINS && !usePinsAlarmStore().unsupportedHere
            ? {
                actionText: i18n.global.t('plugins.pinsDevices.config.alarm.muteFromToast', {
                  minutes: ALARM_MUTE_MINUTES,
                }),
                onAction: () => muteBoxAlarm(toastStore),
              }
            : {};

        toastStore.showToast({
          type: type,
          title: `${displayLog.level}: ${formattedTime}`,
          message: displayLog.message,
          autoClose: displayLog.level === 'ERROR' ? false : true,
          autoCloseDelay: 8000,
          ...muteAction,
        });

        // Aktualisiere den letzten Timestamp
        this.lastErrorWarningTimestamp = latestLog.timestamp;
        localStorage.setItem('lastErrorWarningTimestamp', this.lastErrorWarningTimestamp);
      }
    },

    startFetchingLog() {
      if (!this._logPoller) {
        this._logPoller = createPoller(() => this.fetchLogInfos(), LOG_POLL_INTERVAL_MS);
      }
      this._logPoller.start();
    },

    stopFetchingLog() {
      this._logPoller?.stop();
    },
  },
});
