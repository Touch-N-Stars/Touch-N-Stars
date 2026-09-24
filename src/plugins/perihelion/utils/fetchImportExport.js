import perihelionApi from './perihelionClient';
import i18n from '@/i18n';
import { getUrls } from '@/services/api/core';
import { describePerihelionResponse, describePerihelionError } from './perihelionResult';

/** @returns {Promise<{ ok: boolean, message: string, count?: number }>} */
export async function importComets(rawText) {
  return doImport('/import/comets', rawText, 'text/plain');
}

/** @returns {Promise<{ ok: boolean, message: string, count?: number }>} */
export async function importAsteroids(json) {
  return doImport('/import/asteroids', json, 'application/json');
}

/** @returns {Promise<{ ok: boolean, text: string|null, message: string }>} text is null when nothing's ever been synced */
export async function exportComets() {
  return doExport('/export/comets');
}

/** @returns {Promise<{ ok: boolean, text: string|null, message: string }>} text is null when nothing's ever been synced */
export async function exportAsteroids() {
  return doExport('/export/asteroids');
}

/** @returns {Promise<{ ok: boolean, message: string }>} */
export async function clearComets() {
  return doClear('/clear/comets');
}

/** @returns {Promise<{ ok: boolean, message: string }>} */
export async function clearAsteroids() {
  return doClear('/clear/asteroids');
}

/** @returns {Promise<{ ok: boolean, message: string }>} */
export async function clearCobs() {
  return doClear('/clear/cobs');
}

async function doImport(path, body, contentType) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}${path}`, body, {
      headers: { 'Content-Type': contentType },
    });
    return { ...describePerihelionResponse(response.data), count: response.data.Count };
  } catch (error) {
    return describePerihelionError(error);
  }
}

async function doExport(path) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.get(`${PERIHELION_URL}${path}`, { responseType: 'text' });
    // This route always answers 200 with a plain string (empty means never synced) -- the
    // global axios interceptor (src/utils/errorHandler.js) replaces a failed request's own
    // response with a synthetic {Error, Success:false, ...} object instead of rejecting, so
    // anything that isn't a string means the request didn't actually succeed.
    if (typeof response.data !== 'string') {
      return {
        ok: false,
        text: null,
        message: response.data?.Error ?? i18n.global.t('perihelion.status.unreachable'),
      };
    }
    return { ok: true, text: response.data || null, message: '' };
  } catch (error) {
    return { ok: false, text: null, message: describePerihelionError(error).message };
  }
}

async function doClear(path) {
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}${path}`);
    return describePerihelionResponse(response.data);
  } catch (error) {
    return describePerihelionError(error);
  }
}
