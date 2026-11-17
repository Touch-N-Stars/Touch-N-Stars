import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, rawHttp, simpleGetRequest } from './core';

// rawHttp, not the global axios: its interceptor turns every failure into a mock success and
// drops the body, but the caller needs the status and the plugin's JSON error code to tell an
// older plugin (route unknown) from a real error. Rejects in both cases.
async function getRawImage(url, params, signal) {
  const response = await rawHttp.get(url, { params, responseType: 'arraybuffer', signal });
  // A backend that answers unknown paths with a page instead of a 404 is just as unsupported.
  const contentType = String(response.headers?.['content-type'] ?? '');
  if (!contentType.includes('application/octet-stream')) {
    const error = new Error(`Raw image endpoint not available (${contentType || 'no type'})`);
    error.rawImageCode = 'unsupported';
    throw error;
  }
  return response.data;
}

// The TNS plugin's Livestack routes answer a refused request with a JSON body
// { Success: false, Response: { Errors: [{ Field, Code, Message }] } } and status 400/404/409;
// that body is returned like a success, anything else rejects.
async function livestackRequest(request) {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    if (error?.response?.data?.Success === false) {
      return error.response.data;
    }
    throw error;
  }
}

// Adding a master reads all its pixels for the mean, a few seconds for a large one on a Pi
const LIVESTACK_MASTER_TIMEOUT = 60000;

export default {
  //-------------------------------------  Image History ---------------------------------------
  async imageHistoryAll() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image-history`, {
        params: { all: true },
      });
      return response.data;
    } catch (error) {
      // console.error('Error read Image History:', error);
      throw error;
    }
  },

  async imageHistoryAllFilterd(imageType) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image-history`, {
        params: {
          all: true,
          imageType: imageType,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error read Image History:', error);
      throw error;
    }
  },

  //-------------------------------------  plate solve  ---------------------------------------
  async solvePreparedImage() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/prepared-image/solve`);
  },

  //-------------------------------------  Image  ---------------------------------------
  async getImagePrepared(quality, resize = false, scale = 100) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/prepared-image`, {
        params: {
          quality: quality,
          resize: resize,
          scale: scale,
        },
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      // console.error('Error read Image :', error);
      throw error;
    }
  },

  async getSequenceImage(index, quality, resize, scale) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image/${index}`, {
        params: {
          quality: quality,
          resize: resize,
          scale: scale,
          autoPrepare: true,
          stream: true,
        },
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      // console.error('Error read Image :', error);
      throw error;
    }
  },

  async getSequenceThumbnail(index, imageType = null) {
    try {
      const { BASE_URL } = getUrls();
      const params = imageType ? { imageType } : {};
      const response = await axios.get(`${BASE_URL}/image/thumbnail/${index}`, {
        params,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      // console.error('Error read Thumbnail :', error);
      throw error;
    }
  },

  async getSequenceImageFilterd(index, quality, resize, scale, imageType) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image/${index}`, {
        params: {
          quality: quality,
          resize: resize,
          scale: scale,
          autoPrepare: true,
          imageType: imageType,
          stream: true,
        },
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      // console.error('Error read Image :', error);
      throw error;
    }
  },

  //-------------------------------------  Raw image data (plugin server) ----------------------
  // Real 16-bit sensor data for the histogram and the client-side stretch. The body is the
  // binary container parsed by src/utils/rawImage/parseRawImage.js.
  getRawPreparedImage(maxDim, signal) {
    const { API_URL } = getUrls();
    return getRawImage(`${API_URL}raw-image/prepared`, { maxDim }, signal);
  },

  /**
   * A history entry is addressed by its file name where the backend reports one (PINS fork),
   * otherwise by its index plus mean/median, which the plugin checks against the saved frame.
   */
  getRawHistoryImage({ filename, index, mean, median }, maxDim, signal) {
    const { API_URL } = getUrls();
    const params = filename ? { filename, maxDim } : { index, mean, median, maxDim };
    return getRawImage(`${API_URL}raw-image/history`, params, signal);
  },

  getRawLivestackImage(target, filter, maxDim, signal) {
    const { API_URL } = getUrls();
    return getRawImage(`${API_URL}raw-image/livestack`, { target, filter, maxDim }, signal);
  },

  async imageAction(index, action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/image/${index}/${action}`);
  },

  /**
   * Deletes the image file behind a history entry from the rig's disk.
   * The entry is addressed by the `Id` the history payload carries, never by its
   * index: the index is positional and changes whenever the history is rebuilt.
   * `filename` is sent as a cross-check; the backend refuses (409) when it does not
   * match the entry. Only the PINS fork of the Advanced API serves this route (see
   * docs/features/image-history-delete.md); an official ninaAPI answers 404.
   */
  async deleteHistoryImage(id, filename = null) {
    const { BASE_URL } = getUrls();
    const params = filename ? { filename } : {};
    const response = await axios.delete(`${BASE_URL}/image-history/${encodeURIComponent(id)}`, {
      params,
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  //-------------------------------------  Livestack ---------------------------------------
  // The Livestack plugin's options and calibration library, served by the TNS plugin. rawHttp, not
  // the global axios: its interceptor would replace a refusal by a mock response without the errors.
  async getLivestackSettings() {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.get(`${API_URL}livestack/settings`, { timeout: DEFAULT_TIMEOUT })
    );
  },

  async setLivestackSettings(body) {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.put(`${API_URL}livestack/settings`, body, { timeout: DEFAULT_TIMEOUT })
    );
  },

  async getLivestackCalibration() {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.get(`${API_URL}livestack/calibration`, { timeout: DEFAULT_TIMEOUT })
    );
  },

  async inspectLivestackCalibrationMaster(path) {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.get(`${API_URL}livestack/calibration/inspect`, {
        params: { path },
        timeout: DEFAULT_TIMEOUT,
      })
    );
  },

  async addLivestackCalibrationMaster(body) {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.post(`${API_URL}livestack/calibration`, body, { timeout: LIVESTACK_MASTER_TIMEOUT })
    );
  },

  async removeLivestackCalibrationMaster({ Type, Path, Gain, Offset, ExposureTime, Filter }) {
    const { API_URL } = getUrls();
    return livestackRequest(
      rawHttp.delete(`${API_URL}livestack/calibration`, {
        params: {
          type: Type,
          path: Path,
          gain: Gain,
          offset: Offset,
          exposureTime: ExposureTime,
          filter: Filter,
        },
        timeout: DEFAULT_TIMEOUT,
      })
    );
  },

  async livestackStart() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/start`);
      return response.data;
    } catch (error) {
      console.error('Error starting livestack:', error);
      throw error;
    }
  },

  async livestackStop() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/stop`);
      return response.data;
    } catch (error) {
      console.error('Error starting livestack:', error);
      throw error;
    }
  },

  async livestackStatus() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/status`);
      return response.data;
    } catch (error) {
      console.error('Error checking livestack running state:', error);
      throw error;
    }
  },

  async livestackImageAvailable() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/image/available`);
      return response.data;
    } catch (error) {
      console.error('Error checking livestack image availability:', error);
      throw error;
    }
  },

  async getLivestackImage(target, filter, quality = 80, scale = 100) {
    try {
      const { BASE_URL } = getUrls();
      const encodedTarget = encodeURIComponent(target);
      const response = await axios.get(`${BASE_URL}/livestack/image/${encodedTarget}/${filter}`, {
        params: {
          stream: true,
          quality: quality,
          scale: scale,
          resize: true,
        },
        responseType: 'blob',
      });
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.error('Error fetching livestack image:', error);
      throw error;
    }
  },

  async livestackImageInfo(target, filter) {
    try {
      const { BASE_URL } = getUrls();
      const encodedTarget = encodeURIComponent(target);
      const response = await axios.get(
        `${BASE_URL}/livestack/image/${encodedTarget}/${filter}/info`
      );
      return response.data;
    } catch (error) {
      // Nur bei echten Errors loggen
      if (error.response?.status !== 404) {
        // console.error('Error checking livestack image info:', error);
      }
      throw error;
    }
  },

  async livestackReset() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/reset`);
      return response.data;
    } catch (error) {
      console.error('Error resetting livestack:', error);
      throw error;
    }
  },

  async livestackRgbAvailable() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/rgb/available`);
      return response.data;
    } catch (error) {
      console.error('Error fetching livestack rgb candidates:', error);
      throw error;
    }
  },

  async livestackCreateRgb(target, red, green, blue) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/rgb/create`, {
        params: { target, red, green, blue },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating livestack rgb combination:', error);
      throw error;
    }
  },

  async livestackDeleteRgb(target) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/livestack/rgb/delete`, {
        params: { target },
      });
      return response.data;
    } catch (error) {
      console.error('Error deleting livestack rgb combination:', error);
      throw error;
    }
  },

  // ------------------------------------- FITS Plate Solve -------------------------------------
  async getFitsParameters(path) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}fits/parameters`, {
      params: { path },
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  async analyzeFits({ path, focalLength, pixelSize, binning, ra, dec, blindSolve }) {
    const { API_URL } = getUrls();
    const body = { path, focalLength, pixelSize, binning, blindSolve: !!blindSolve };
    if (!blindSolve && ra != null) body.ra = ra;
    if (!blindSolve && dec != null) body.dec = dec;
    const response = await axios.post(`${API_URL}fits/analyze`, body, {
      timeout: 120000, // plate solving can take up to 2 minutes
    });
    return response.data;
  },
};
