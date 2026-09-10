import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, simpleGetRequest } from './core';

export default {
  //-------------------------------------  Filterwheel ---------------------------------------
  filterAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/filterwheel/${action}`);
  },

  filterCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/filterwheel/cancel-connect`);
  },

  async changeFilter(filterId) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/filterwheel/change-filter`, {
        params: { filterId: filterId },
      });
      return response.data;
    } catch (error) {
      // console.error('Error changing filter:', error);
      throw error;
    }
  },

  async removeFilter(filterNr) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/filterwheel/remove-filter`, {
        params: { filterId: filterNr },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //-------------------------------------  Rotator ---------------------------------------
  rotatorAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/rotator/${action}`);
  },

  rotatorCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/rotator/cancel-connect`);
  },

  async moveRotator(position) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/rotator/move`, {
        params: { position: position },
      });
      return response.data;
    } catch (error) {
      // console.error('Error moving Rotator:', error);
      throw error;
    }
  },

  async moveMechanicalRotator(position) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/rotator/move-mechanical`, {
        params: { position: position },
      });
      return response.data;
    } catch (error) {
      // console.error('Error moving mechanical Rotator:', error);
      throw error;
    }
  },

  async getRotatorBacklash() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/rotator/get-backlash`);
      return response.data;
    } catch (error) {
      // console.error('Error getting rotator backlash:', error);
      throw error;
    }
  },

  async setRotatorBacklash(angle) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/rotator/set-backlash`, {
        params: { angle: angle },
      });
      return response.data;
    } catch (error) {
      // console.error('Error setting rotator backlash:', error);
      throw error;
    }
  },

  //-------------------------------------  dome ---------------------------------------
  domeAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/dome/${action}`);
  },

  domeCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/dome/cancel-connect`);
  },

  //-------------------------------------  focuser ---------------------------------------
  focusAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/focuser/${action}`);
  },

  focusCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/focuser/cancel-connect`);
  },

  focuserAfAction(action) {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}autofocus/${action}`);
  },

  focuserLastAf() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/focuser/last-af`);
  },

  async moveFocuser(position) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/focuser/move`, {
        params: { position },
      });
      return response.data;
    } catch (error) {
      // console.error('Error moving focuser:', error);
      throw error;
    }
  },

  //-------------------------------------  Switch ----------------------------------------
  switchAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/switch/${action}`);
  },

  switchCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/switch/cancel-connect`);
  },

  async setSwitch(id, value) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/switch/set`, {
        params: {
          index: id,
          value: value,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error setSwitch:', error);
      throw error;
    }
  },

  //-------------------------------------  Weather ----------------------------------------
  weatherAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/weather/${action}`);
  },

  weatherCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/weather/cancel-connect`);
  },

  //------------------------------------- AlpacaDirect ----------------------------------------
  async getAlpacaDirectSettings(deviceType) {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}alpaca-direct/${deviceType}/settings`);
  },

  async setAlpacaDirectSettings(deviceType, body) {
    const { API_URL } = getUrls();
    const response = await axios.put(`${API_URL}alpaca-direct/${deviceType}/settings`, body, {
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  //-------------------------------------  guider ---------------------------------------
  /* commands:
      - info
      - clear-calibration
      - graph
      - graph/clear           */

  guiderAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/guider/${action}`);
  },

  guiderCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/guider/cancel-connect`);
  },

  // PINS only: not available in the official ninaAPI build.
  guiderClearGraph() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/guider/graph/clear`);
  },

  async guiderStart(calibrate) {
    //calibrate = true or false
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/guider/start`, {
        params: { calibrate },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving logs result:', error);
      throw error;
    }
  },

  //-------------------------------------  safety ---------------------------------------
  safetyAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/safetymonitor/${action}`);
  },

  safetyCancelConnect() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/equipment/safetymonitor/cancel-connect`);
  },
};
