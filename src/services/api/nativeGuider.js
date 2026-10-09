// PINS native guider (Touch'N'Stars plugin server, /api/internal-guider/*).
//
// The controller answers { success: true, response } or { success: false, error, code } with a
// real HTTP status (409 NotAvailable/Rejected, 400 bad input, 404 no frame yet, 202 accepted).
// The global axios interceptors (utils/errorHandler.js) would turn every non-2xx into a resolved
// mock object and drop the backend's reason, so this module talks through its own instance and
// maps failures to Errors carrying { status, code } - the page shows the real reason instead of
// "HTTP 409". The app-wide resume abort signal is attached by hand (see httpLifecycle.js).
import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls } from './core';
import { getHttpAbortSignal } from '@/utils/httpLifecycle';

export const nativeGuiderHttp = axios.create();
nativeGuiderHttp.interceptors.request.use((config) => {
  if (!config.signal) {
    config.signal = getHttpAbortSignal();
  }
  return config;
});

/** Maps an axios failure to an Error with the backend's message, status and code. */
export function mapNativeGuiderError(error, fallbackMessage = 'Native guider request failed') {
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
    const cancelled = new Error('Request cancelled');
    cancelled.cancelled = true;
    return cancelled;
  }
  const status = error?.response?.status;
  const data = error?.response?.data;
  const detail =
    (data && typeof data === 'object' ? data.error || data.message : null) ||
    (status ? `${fallbackMessage} (HTTP ${status})` : error?.message) ||
    fallbackMessage;
  const mapped = new Error(detail);
  if (status) mapped.status = status;
  if (data && typeof data === 'object' && data.code) mapped.code = data.code;
  // Guiding Coach rejections carry the guider's stable code and its parameters for a localized
  // message (coach.busy, ...).
  if (data && typeof data === 'object' && data.messageCode) {
    mapped.messageCode = data.messageCode;
    mapped.messageParameters =
      data.messageParameters && typeof data.messageParameters === 'object'
        ? data.messageParameters
        : {};
  }
  return mapped;
}

async function request(method, path, { params, data, timeout = DEFAULT_TIMEOUT } = {}) {
  const { API_URL } = getUrls();
  try {
    const response = await nativeGuiderHttp.request({
      method,
      url: `${API_URL}internal-guider/${path}`,
      params,
      data,
      timeout,
    });
    return response.data?.response ?? null;
  } catch (error) {
    throw mapNativeGuiderError(error);
  }
}

function incidentDownloadUrl(id) {
  const { API_URL } = getUrls();
  return `${API_URL}internal-guider/incidents/${encodeURIComponent(id)}/download`;
}

export default {
  /** { available, connected, deviceId, deviceName, isNative, reason, status } - always 200. */
  getNativeGuiderStatus() {
    return request('get', 'status');
  },

  getNativeGuiderSteps(max = 400) {
    return request('get', 'steps', { params: { max } });
  },

  getNativeGuiderAlerts(max = 100) {
    return request('get', 'alerts', { params: { max } });
  },

  getNativeGuiderCalibration() {
    return request('get', 'calibration');
  },

  /** { connected, settings: AdvancedGuiderSetting[] } - also works before the first connect. */
  getNativeGuiderSettings() {
    return request('get', 'settings');
  },

  /** Returns the updated setting; rejects with the backend's validation message. */
  setNativeGuiderSetting(name, value) {
    return request('post', 'settings', { data: { name, value } });
  },

  /**
   * Overlay data of the latest frame (or of frame N while still cached on the backend), with
   * pixel crops around the primary star and the `secondaries` strongest secondaries.
   */
  getNativeGuiderFrameInfo({ cropSize = 31, secondaries = 0, frame } = {}) {
    const params = { cropSize };
    if (secondaries > 0) params.secondaries = secondaries;
    if (frame !== undefined && frame !== null) params.frame = frame;
    return request('get', 'frame-info', { params });
  },

  /**
   * URL of the stretched JPEG (used directly as <img src>, so no request is made here).
   * frame doubles as cache buster and pins the image to the frame of the last frame-info.
   */
  getNativeGuiderImageUrl({ maxWidth = 1024, stretch = 0.2, quality = 80, frame } = {}) {
    const { API_URL } = getUrls();
    const params = new URLSearchParams({
      maxWidth: String(Math.round(maxWidth)),
      stretch: String(stretch),
      quality: String(quality),
    });
    if (frame !== undefined && frame !== null) params.set('frame', String(frame));
    return `${API_URL}internal-guider/image?${params.toString()}`;
  },

  /**
   * Guider actions: loop, stop, start-guiding, stop-guiding, pause, resume, dither,
   * clear-calibration. Params: start-guiding { calibrate }, dither { pixels, raOnly }.
   */
  nativeGuiderAction(action, params = {}) {
    return request('post', action, { params, timeout: 20000 });
  },

  buildNativeGuiderDarks({ minExposure = 0.5, maxExposure = 4, frames = 5 } = {}) {
    return request('post', 'darks/build', { data: { minExposure, maxExposure, frames } });
  },

  cancelNativeGuiderDarks() {
    return request('post', 'darks/cancel');
  },

  // --- Guiding Coach ------------------------------------------------------------

  /** AdvancedCoachStatus of the current/last session (phase Idle before the first one). */
  getNativeGuiderCoach() {
    return request('get', 'coach');
  },

  /**
   * Starts a session. options = AdvancedCoachOptions ({ steps, exposureSeconds, gains,
   * framesPerCombination, driftSeconds, trialSeconds, repeatBaseline, allowCalibration });
   * empty lists mean the guider's defaults. Resolves { action, accepted, pending, status };
   * a rejection carries the guider's messageCode (e.g. coach.busy).
   */
  startNativeGuiderCoach(options = {}) {
    return request('post', 'coach/start', { data: options, timeout: 20000 });
  },

  skipNativeGuiderCoachStep() {
    return request('post', 'coach/skip', { timeout: 20000 });
  },

  cancelNativeGuiderCoach() {
    return request('post', 'coach/cancel', { timeout: 20000 });
  },

  /**
   * Applies findings (by id), trials ('trial:<id>') or active live hints (by id; an applied hint
   * is dismissed); resolves { status, applied }.
   */
  applyNativeGuiderCoachActions(ids) {
    return request('post', 'coach/apply', { data: { ids }, timeout: 20000 });
  },

  /** Stored coach reports, newest first. */
  getNativeGuiderCoachHistory(max = 30) {
    return request('get', 'coach/history', { params: { max } });
  },

  /** Hides a live hint for the rest of the guiding session; resolves { dismissed, hints }. */
  dismissNativeGuiderHint(id) {
    return request('post', 'hints/dismiss', { data: { id } });
  },

  // --- Flight recorder (incidents) --------------------------------------------------

  /**
   * AdvancedIncidentList: { incidents (summaries, newest first), enabled, recordingId, usedBytes,
   * budgetBytes, maxIncidents, simulatorUsedBytes, simulatorBudgetBytes }.
   */
  getNativeGuiderIncidents() {
    return request('get', 'incidents');
  },

  /** AdvancedIncident with the telemetry of all frames, markers and the diagnosis. */
  getNativeGuiderIncident(id) {
    return request('get', `incidents/${encodeURIComponent(id)}`, { timeout: 30000 });
  },

  /**
   * URL of a stored incident image as a stretched JPEG (used directly as <img src>): kind 'context'
   * (the whole field, binned) or 'key' (full resolution, at the key moments).
   */
  getNativeGuiderIncidentImageUrl(
    id,
    { kind = 'context', frame, maxWidth = 1024, stretch = 0.2, quality = 80 } = {}
  ) {
    const { API_URL } = getUrls();
    const params = new URLSearchParams({
      kind,
      frame: String(frame),
      maxWidth: String(Math.round(maxWidth)),
      stretch: String(stretch),
      quality: String(quality),
    });
    return `${API_URL}internal-guider/incidents/${encodeURIComponent(id)}/image?${params.toString()}`;
  },

  /** { frame, crops: [{ star, x0, y0, width, height, pixels }] } - primary first, raw 16-bit. */
  getNativeGuiderIncidentCrops(id, frame) {
    return request('get', `incidents/${encodeURIComponent(id)}/crops`, { params: { frame } });
  },

  /** Keep (protect from the budget rotation) or release; resolves the updated summary. */
  keepNativeGuiderIncident(id, kept) {
    return request('post', `incidents/${encodeURIComponent(id)}/keep`, { data: { kept } });
  },

  deleteNativeGuiderIncident(id) {
    return request('delete', `incidents/${encodeURIComponent(id)}`);
  },

  /** Deletes all incidents that are not kept; resolves { deleted: n }. */
  deleteAllNativeGuiderIncidents() {
    return request('delete', 'incidents', { timeout: 30000 });
  },

  /**
   * Records the last 2 minutes and the next 30 s as a manual incident; resolves { id }. Rejects
   * (409 Rejected) with the guider's reason when refused.
   */
  markNativeGuiderIncident(note) {
    return request('post', 'incidents/mark', { data: note ? { note } : {} });
  },

  /** URL of the incident as a zip (pins-incident-<id>.zip). */
  getNativeGuiderIncidentDownloadUrl(id) {
    return incidentDownloadUrl(id);
  },

  /** The incident zip as a Blob (saved on the device with blobDownloader). */
  async downloadNativeGuiderIncident(id) {
    try {
      const response = await nativeGuiderHttp.get(incidentDownloadUrl(id), {
        responseType: 'blob',
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      // A JSON error body arrives as a Blob too: read it for the backend's reason.
      const data = error?.response?.data;
      if (data && typeof data.text === 'function') {
        try {
          error.response.data = JSON.parse(await data.text());
        } catch {
          // not JSON - the status is all there is
        }
      }
      throw mapNativeGuiderError(error, 'Incident download failed');
    }
  },
};
