import axios from 'axios';
import { getUrls, simpleGetRequest } from './core';

export default {
  //-------------------------------------  Camera ---------------------------------------
  cameraAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/camera/${action}`);
  },

  cameraCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/camera/cancel-connect`);
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

  async startCameraCooling(temp, minutes) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/cool`, {
        params: {
          temperature: temp,
          minutes: minutes,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving capture result:', error);
      throw error;
    }
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

  async startCameraWarming(minutes) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/warm`, {
        params: {
          minutes: minutes,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
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

  async setBinningMode(mode) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/camera/set-binning`, {
        params: { binning: mode },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving result:', error);
      throw error;
    }
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
  // PINS' second camera slot. Same routes as the camera's under /equipment/guidecamera.
  guideCameraAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/guidecamera/${action}`);
  },

  guideCameraCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/guidecamera/cancel-connect`);
  },

  // One exposure, returned as an image without going through the imaging pipeline (nothing is saved).
  async guideCameraCapture(duration, gain, quality = 80) {
    const { BASE_URL } = getUrls();
    const params = { duration: duration, quality: quality, resize: true, size: '1280x960' };
    if (gain !== null && gain !== undefined && gain !== '') {
      params.gain = gain;
    }
    const response = await axios.get(`${BASE_URL}/equipment/guidecamera/capture`, {
      params,
      timeout: (duration + 120) * 1000,
    });
    return response.data;
  },

  async guideCameraCool(temp, minutes) {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/equipment/guidecamera/cool`, {
      params: { temperature: temp, minutes: minutes },
    });
    return response.data;
  },

  async guideCameraWarm(minutes) {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/equipment/guidecamera/warm`, {
      params: { minutes: minutes },
    });
    return response.data;
  },

  async guideCameraSetBinning(mode) {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/equipment/guidecamera/set-binning`, {
      params: { binning: mode },
    });
    return response.data;
  },
};
