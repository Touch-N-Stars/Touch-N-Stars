import axios from 'axios';
import { getUrls, simpleGetRequest } from './core';

// The imaging camera and PINS' guide camera slot share the same routes under
// /equipment/camera and /equipment/guidecamera: one implementation per call for both slots.
const CAMERA = 'camera';
const GUIDE_CAMERA = 'guidecamera';

function slotAction(slot, action) {
  const { BASE_URL } = getUrls();
  return simpleGetRequest(`${BASE_URL}/equipment/${slot}/${action}`);
}

async function slotGet(slot, path, params, config = {}) {
  const { BASE_URL } = getUrls();
  const response = await axios.get(`${BASE_URL}/equipment/${slot}/${path}`, { params, ...config });
  return response.data;
}

const cool = (slot, temperature, minutes) => slotGet(slot, 'cool', { temperature, minutes });
const warm = (slot, minutes) => slotGet(slot, 'warm', { minutes });
const setBinning = (slot, mode) => slotGet(slot, 'set-binning', { binning: mode });

export default {
  //-------------------------------------  Camera ---------------------------------------
  cameraAction(action) {
    return slotAction(CAMERA, action);
  },

  cameraCancelConnect() {
    return slotAction(CAMERA, 'cancel-connect');
  },

  async getCaptureStatisticsFull() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/camera/capture/statistics/full`);
  },

  async getPreparedImageStatistics() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/prepared-image/statistics`);
  },

  async startCapture(
    duration,
    gain,
    solve = false,
    omitImage = false,
    save = false,
    targetName = 'Snapshot'
  ) {
    console.log('Zeit:', duration, 'Gain: ', gain);
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/capture`, {
        params: {
          duration: duration,
          gain: gain,
          solve: solve,
          omitImage: omitImage,
          save: save,
          targetName: targetName,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error starting capture:', error);
      throw error;
    }
  },

  async getPlatesovle(duration, gain) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/capture`, {
        params: {
          duration: duration,
          gain: gain,
          solve: true,
          omitImage: true,
          waitForResult: true,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error starting capture:', error);
      throw error;
    }
  },

  async getCaptureResult(quality = 80) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/capture`, {
        params: {
          getResult: true,
          quality: quality,
          autoPrepare: true,
          stream: true,
        },
        responseType: 'blob',
      });
      return response;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
  },

  async getImageData() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/capture`, {
        params: {
          getResult: true,
          omitImage: true,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
  },

  async getCaptureStatistics() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image-history`, {
        params: { all: true },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  startCameraCooling(temp, minutes) {
    return cool(CAMERA, temp, minutes);
  },

  async stopCameraCooling() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/cool`, {
        params: { cancel: true },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
  },

  startCameraWarming(minutes) {
    return warm(CAMERA, minutes);
  },

  async stopCameraWarming() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/warm`, {
        params: {
          cancel: true,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async startStoppWarming(cancel, minutes) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/warm`, {
        params: {
          cancel: cancel,
          minutes: minutes,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
  },

  async startStoppDewheater(power) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/dew-heater`, {
        params: { power: power },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
  },

  setBinningMode(mode) {
    return setBinning(CAMERA, mode);
  },

  async setReadoutMode(mode) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/set-readout`, {
        params: { mode: mode },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving result:', error);
      throw error;
    }
  },

  //eg v2/api/equipment/camera/set-readout/snapshot?mode=1 or /image?mode=0
  async setReadoutModeType(type, mode) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/set-readout/${type}`, {
        params: { mode: mode },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving result:', error);
      throw error;
    }
  },

  //eg v2/api/equipment/camera/usb-limit?=7
  async setCamerUsbLimit(limit) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/set-readout/`, {
        params: { limit: limit },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving result:', error);
      throw error;
    }
  },

  //-------------------------------------  Guide camera (PINS) ---------------------------------------
  // PINS' second camera slot: the camera's calls on /equipment/guidecamera.
  guideCameraAction(action) {
    return slotAction(GUIDE_CAMERA, action);
  },

  guideCameraCancelConnect() {
    return slotAction(GUIDE_CAMERA, 'cancel-connect');
  },

  // One exposure, returned as an image without going through the imaging pipeline (nothing is saved).
  guideCameraCapture(duration, gain, quality = 80) {
    const params = { duration: duration, quality: quality, resize: true, size: '1280x960' };
    if (gain !== null && gain !== undefined && gain !== '') {
      params.gain = gain;
    }
    return slotGet(GUIDE_CAMERA, 'capture', params, { timeout: (duration + 120) * 1000 });
  },

  guideCameraCool(temp, minutes) {
    return cool(GUIDE_CAMERA, temp, minutes);
  },

  guideCameraWarm(minutes) {
    return warm(GUIDE_CAMERA, minutes);
  },

  guideCameraSetBinning(mode) {
    return setBinning(GUIDE_CAMERA, mode);
  },
};
