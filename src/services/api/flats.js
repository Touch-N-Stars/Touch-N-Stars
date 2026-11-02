import axios from 'axios';
import { getUrls, simpleGetRequest } from './core';

export default {
  //-------------------------------------  flatdevice ---------------------------------------

  flatdeviceAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/flatdevice/${action}`);
  },

  flatdeviceCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/flatdevice/cancel-connect`);
  },

  async flatdeviceSetLight(on) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-light`, {
        params: { on: on }, //true or false
      });
      return response.data;
    } catch (error) {
      // console.error('Error set-light:', error);
      throw error;
    }
  },

  async flatdeviceSetCover(closed) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-cover`, {
        params: { closed: closed }, //true or false
      });
      return response.data;
    } catch (error) {
      // console.error('Error set-cover:', error);
      throw error;
    }
  },

  async flatdeviceSetBrightness(brightness) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-brightness`, {
        params: { brightness: brightness }, //z.B. 42
      });
      return response.data;
    } catch (error) {
      // console.error('Error set brightness:', error);
      throw error;
    }
  },

  async flatdeviceSetHeater(power) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-heater`, {
        params: { power: power },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceGetHeater() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/get-heater`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceSetOpenPosition(angle) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-openposition`, {
        params: { angle: angle },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceGetOpenPosition() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/get-openposition`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceSetClosedPosition(angle) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/set-closedposition`, {
        params: { angle: angle },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceGetClosedPosition() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/get-closedposition`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async flatdeviceGetCurrentPosition() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/flatdevice/get-currentposition`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getTrainedFlatSettings() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/trained-settings`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async addTrainedFlatSetting() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/add-trained-setting`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async updateTrainedFlatSetting(index, filterId, binning, gain, offset, brightness, time) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/update-trained-setting`, {
        params: { index, filterId, binning, gain, offset, brightness, time },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async removeTrainedFlatSetting(index) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/remove-trained-setting`, {
        params: { index },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //-------------------------------------  Flatassistant ---------------------------------------
  flatassistantAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/flats/${action}`);
  },

  //auto-exposure
  async flatAutoExposure(
    count,
    minExposure,
    maxExposure,
    histogramMean,
    meanTolerance,
    binning,
    gain,
    offset,
    filterId,
    brightness,
    keepClosed,
    darkCount = 0
  ) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/auto-exposure`, {
        params: {
          count,
          minExposure,
          maxExposure,
          histogramMean,
          meanTolerance,
          binning,
          gain,
          offset,
          filterId,
          brightness,
          keepClosed,
          darkCount,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error auto-exposure:', error);
      throw error;
    }
  },

  //auto-brightness
  async flatAutoBrightness(
    count,
    minBrightness,
    maxBrightness,
    histogramMean,
    meanTolerance,
    binning,
    gain,
    offset,
    filterId,
    exposureTime,
    keepClosed,
    darkCount = 0
  ) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/auto-brightness`, {
        params: {
          count,
          minBrightness,
          maxBrightness,
          histogramMean,
          meanTolerance,
          binning,
          gain,
          offset,
          filterId,
          exposureTime,
          keepClosed,
          darkCount,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error auto-brightness:', error);
      throw error;
    }
  },

  //skyflat
  async flatSkyflat(
    count,
    minExposure,
    maxExposure,
    histogramMean,
    meanTolerance,
    binning,
    gain,
    offset,
    filterId,
    keepClosed,
    darkCount = 0
  ) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/skyflat`, {
        params: {
          count,
          minExposure,
          maxExposure,
          histogramMean,
          meanTolerance,
          binning,
          gain,
          offset,
          filterId,
          keepClosed,
          darkCount,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error skyflats:', error);
      throw error;
    }
  },

  async flatTrainedDarkFlat(count, binning, gain, offset, filterId, keepClosed) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/flats/trained-dark-flat`, {
        params: {
          count,
          binning,
          gain,
          offset,
          filterId,
          keepClosed,
        },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //multimode
  async flatMultiMode(payload) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}flats/multimode`, payload);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  flatMultiStatus() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}flats/status`);
  },

  async flatMultiStop() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}flats/stop`);
  },

  // Answers the plugin-side run waiting for the telescope to be covered before its dark flats.
  async flatRunConfirmCover(confirmed) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}flats/confirm-cover`, {
      params: { confirmed: Boolean(confirmed) },
    });
    return response.data;
  },
};
