import i18n from '@/i18n';
import { useToastStore } from '@/store/toastStore';

// The global axios interceptor (errorHandler.js) resolves every failed request into
// { Success: false, Error, StatusCode } and shows no toast for it (409/500 are exempt there),
// so an action the backend can refuse has to report the refusal at its call site.

// Requests aborted on app resume come back as 499; they are no refusal of the backend.
const CANCELED_STATUS = 499;

/** True when the backend answered and refused the request (not a canceled request). */
export function isBackendRefusal(response) {
  return response?.Success === false && response.StatusCode !== CANCELED_STATUS;
}

/** Shows the backend's reason for a failed action in an error toast. */
export function toastBackendError(response, titleKey, { autoClose = true } = {}) {
  const t = i18n.global.t;
  useToastStore().showToast({
    type: 'error',
    title: t(titleKey),
    message: response?.Error || t('components.backendErrors.noReason'),
    autoClose,
  });
}

/** Toasts a refusal and returns true, so call sites can bail out in one line. */
export function reportBackendRefusal(response, titleKey) {
  if (!isBackendRefusal(response)) return false;
  toastBackendError(response, titleKey);
  return true;
}

// The plugin's /autofocus/start answers a refused start with HTTP 200 and a fixed German message
// ("Fehler beim Starten des Autofokus: <reason>") instead of Success: false.
const AF_START_ERROR_PREFIX = 'Fehler beim Starten des Autofokus';

/** The reason the autofocus start was refused ('' when none is given), or null if it started. */
export function autofocusStartRefusal(response) {
  if (isBackendRefusal(response)) return response.Error || '';
  const message = typeof response?.message === 'string' ? response.message : '';
  if (!message.startsWith(AF_START_ERROR_PREFIX)) return null;
  return message.slice(AF_START_ERROR_PREFIX.length).replace(/^:\s*/, '');
}

// Background actions (park, filter change, focuser move, ...) answer their request at once and
// report a later failure as a /v2/socket event. A canceled action sends no event.
const FAILURE_EVENTS = {
  'MOUNT-PARK-FAILED': { titleKey: 'components.backendErrors.mountPark', persistent: true },
  'MOUNT-UNPARK-FAILED': { titleKey: 'components.backendErrors.mountUnpark', persistent: true },
  'MOUNT-HOME-FAILED': { titleKey: 'components.backendErrors.mountHome' },
  'MOUNT-FLIP-FAILED': { titleKey: 'components.backendErrors.mountFlip', persistent: true },
  'FILTERWHEEL-CHANGE-FAILED': { titleKey: 'components.backendErrors.filterChange' },
  'FOCUSER-MOVE-FAILED': { titleKey: 'components.backendErrors.focuserMove' },
  'ROTATOR-MOVE-FAILED': { titleKey: 'components.backendErrors.rotatorMove' },
  'FLATDEVICE-LIGHT-FAILED': { titleKey: 'components.backendErrors.flatLight' },
  'FLATDEVICE-COVER-FAILED': { titleKey: 'components.backendErrors.flatCover' },
  'FLATDEVICE-BRIGHTNESS-FAILED': { titleKey: 'components.backendErrors.flatBrightness' },
  'DOME-SHUTTER-FAILED': { titleKey: 'components.backendErrors.domeShutter', persistent: true },
};

const DOME_SHUTTER_TITLES = {
  opening: 'components.backendErrors.domeOpen',
  closing: 'components.backendErrors.domeClose',
};

/**
 * Maps a /v2/socket event to its failure toast, or null for any other event.
 * Park, unpark, flip and the dome shutter stay until dismissed: a missed park failure lets the
 * user power off a mount that is not parked.
 */
export function describeFailureEvent(response) {
  const failure = FAILURE_EVENTS[response?.Event];
  if (!failure) return null;
  const titleKey =
    response.Event === 'DOME-SHUTTER-FAILED'
      ? DOME_SHUTTER_TITLES[response.Action] || failure.titleKey
      : failure.titleKey;
  return { titleKey, persistent: failure.persistent === true };
}

/** Shows the toast for a failure event; returns false for any other event. */
export function handleFailureEvent(response) {
  const failure = describeFailureEvent(response);
  if (!failure) return false;
  toastBackendError(response, failure.titleKey, { autoClose: !failure.persistent });
  return true;
}
