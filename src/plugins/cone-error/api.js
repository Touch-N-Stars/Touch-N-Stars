// Cone error wizard (Touch'N'Stars plugin server, /api/cone-error/*).
//
// The controller answers { success: true, response } or { success: false, error, code } with a
// real HTTP status (400 bad input, 409 refused). Like api/nativeGuider.js this talks through
// core's rawHttp, so that a refusal keeps the backend's reason and code instead of being turned
// into a resolved mock by the global interceptors.
import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, rawHttp } from '@/services/api/core';

/** Maps an axios failure to an Error with the backend's message, status and code. */
export function mapConeError(error, fallbackMessage = 'Cone error request failed') {
  if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
    const cancelled = new Error('Request cancelled');
    cancelled.cancelled = true;
    return cancelled;
  }
  const status = error?.response?.status;
  const data = error?.response?.data;
  const detail =
    (data && typeof data === 'object' ? data.error : null) ||
    (status ? `${fallbackMessage} (HTTP ${status})` : error?.message) ||
    fallbackMessage;
  const mapped = new Error(detail);
  if (status) mapped.status = status;
  if (data && typeof data === 'object' && data.code) mapped.code = data.code;
  return mapped;
}

async function request(method, path, { params, data, timeout = DEFAULT_TIMEOUT } = {}) {
  const { API_URL } = getUrls();
  try {
    const response = await rawHttp.request({
      method,
      url: `${API_URL}cone-error/${path}`,
      params,
      data,
      timeout,
    });
    return response.data?.response ?? null;
  } catch (error) {
    throw mapConeError(error);
  }
}

export default {
  /** Blockers and warnings per mode; the phone's clock goes along for the Pi clock check. */
  getPreconditions() {
    return request('get', 'preconditions', { params: { clientTimeUtc: new Date().toISOString() } });
  },

  /** The running or last session; always 200. */
  getStatus() {
    return request('get', 'status');
  },

  getSettings() {
    return request('get', 'settings');
  },

  /** Only the fields sent change; the rest stays as stored. */
  saveSettings(changes) {
    return request('put', 'settings', { data: changes });
  },

  getResults() {
    return request('get', 'results');
  },

  planAuto({ dovetailMm, repetitions, declination, exposureSeconds }) {
    return request('post', 'auto/plan', {
      data: {
        dovetailMm,
        repetitions,
        declination,
        exposureSeconds,
        clientTimeUtc: new Date().toISOString(),
      },
      timeout: 30000,
    });
  },

  startAuto(planId, acknowledgePointingModel) {
    return request('post', 'auto/start', { data: { planId, acknowledgePointingModel } });
  },

  answer(id, yes) {
    return request('post', 'answer', { data: { id, yes } });
  },

  /** Stops the mount and the exposure at once and ends the session. */
  abort() {
    return request('post', 'abort', { timeout: 5000 });
  },

  restore() {
    return request('post', 'restore');
  },

  manualBegin() {
    return request('post', 'manual/begin', { data: { clientTimeUtc: new Date().toISOString() } });
  },

  /** The one-time counterweight check of the daytime check, on the east pier side. */
  manualPierLabels(counterweightWest) {
    return request('post', 'manual/pier-labels', { data: { counterweightWest } });
  },

  manualCapture() {
    return request('post', 'manual/capture');
  },

  /** overrideSunPath overrides a refusal for the Sun near the path alone, for this one move. */
  manualPlanMove(side, overrideSunPath = false) {
    return request('post', 'manual/plan-move', {
      data: { side, overrideSunPath },
      timeout: 30000,
    });
  },

  manualMove(planId) {
    return request('post', 'manual/move', { data: { planId } });
  },

  /** Stops a running move; the daytime check stays active. */
  manualStop() {
    return request('post', 'manual/stop', { timeout: 5000 });
  },

  manualRecenterDone(axisOffsetMm, landmarkDistanceMeters) {
    return request('post', 'manual/recenter-done', {
      data: { axisOffsetMm, landmarkDistanceMeters },
    });
  },

  manualEnd() {
    return request('post', 'manual/end');
  },
};
