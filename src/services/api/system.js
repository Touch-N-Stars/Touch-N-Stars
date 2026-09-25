import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, simpleGetRequest } from './core';

export default {
  async setLanguage(languageCode, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}language`,
        { language: languageCode },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.warn('Failed to set backend language:', error.message);
      return null;
    }
  },

  // NOTE for both reachability probes below: the global error interceptor
  // (errorHandler.js) converts network failures into RESOLVED mock responses
  // ({ Success: false, ... }), so the catch blocks never fire. Without the
  // explicit envelope checks a timeout would count as "reachable" and the
  // error envelope would even end up stored as the API port.
  async fetchApiPort(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}get-api-port`, { timeout });
      if (response.status !== 200 || response.data?.Success === false) {
        return false;
      }
      return response;
    } catch (error) {
      return false;
    }
  },

  async fetchTnsPluginVersion(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}version`, { timeout });
      if (response.status !== 200 || response.data?.Success === false) {
        return false;
      }
      return response.data;
    } catch (error) {
      return false;
    }
  },

  // Backend reachability check
  async fetchApiVersion(timeout = DEFAULT_TIMEOUT) {
    const { BASE_URL } = getUrls();
    try {
      const { data } = await axios.get(`${BASE_URL}/version`, { timeout });
      // Error envelope from the global interceptor (see note above): returning
      // it would be truthy and skip tryWithRetry's retries in fetchAllInfos.
      if (data?.Success === false && data?.Type === 'API' && !data?.Response) {
        return null;
      }
      return data; // Erfolg
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        console.warn(`fetchApiVersion: Timeout nach ${timeout} ms`);
      } else {
        // console.error('Error reaching backend:', err.message);
      }
      return null;
    }
  },

  // Backend reachability check
  async fetchPinsVersion(timeout = DEFAULT_TIMEOUT) {
    const { BASE_URL } = getUrls();
    try {
      const { data } = await axios.get(`${BASE_URL}/version/pins`, { timeout });
      // Error envelope from the global interceptor (see note above):
      // 404 = backend reachable but no PINS endpoint (standard NINA),
      // anything else = backend not reachable.
      if (data?.Success === false && data?.Type === 'API' && !data?.Response) {
        return data.StatusCode === 404 ? {} : null;
      }
      return data;
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        console.warn(`fetchPinsVersion: Timeout nach ${timeout} ms`);
        return null;
      }
      if (err.response?.status === 404) {
        // 404 = Backend erreichbar, kein PINS-Endpoint (Standard-NINA)
        return {};
      }
      // No response at all — backend not reachable
      return null;
    }
  },

  //------------------------------------------- time -------------------------------------------------
  async fetchNinaTime() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/time`);
  },

  async fetchApplicationStart() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/application-start`);
  },

  //------------------------------------------- event-history -------------------------------------------------
  async getEventHistory() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/event-history`);
  },

  //------------------------------------------- Proxy -------------------------------------------------
  async proxyRequest(url) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}proxy?url=${encodeURIComponent(url)}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  async getPlugins() {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/application/plugins`);
  },

  //-------------------------------------  Dialog ---------------------------------------

  async getDialogList() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}dialogs/list`);
      return response.data;
    } catch (error) {
      // console.error('Error fetching dialog list:', error);
      throw error;
    }
  },

  async getDialogCount() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}dialogs/count`);
      return response.data;
    } catch (error) {
      // console.error('Error fetching dialog count:', error);
      throw error;
    }
  },

  async clickDialogButton(buttonName, windowHashCode = null) {
    try {
      const { API_URL } = getUrls();
      const params = { button: buttonName };
      if (windowHashCode) {
        params.window = windowHashCode;
      }
      console.log('API URL:', `${API_URL}dialogs/click-button`);
      console.log('Params:', params);
      const response = await axios.post(`${API_URL}dialogs/click-button`, null, { params });
      console.log('Dialog button clicked:', response.data);
      return response.data;
    } catch (error) {
      console.error(`Error clicking dialog button ${buttonName}:`, error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  },

  async closeAllDialogs(confirm = true) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}dialogs/close-all`, null, {
        params: { confirm },
      });
      console.log('All dialogs closed:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error closing all dialogs:', error);
      throw error;
    }
  },

  async closeDialogsByType(type, confirm = true) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}dialogs/close-by-type`, null, {
        params: { type, confirm },
      });
      console.log('Dialogs closed by type:', response.data);
      return response.data;
    } catch (error) {
      // console.error(`Error closing dialogs by type ${type}:`, error);
      throw error;
    }
  },

  //-------------------------------------  application ---------------------------------------
  async applicatioTabSwitch(tab) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/application/switch-tab`, {
        params: { tab: tab },
      });
      return response.data;
    } catch (error) {
      // console.error('Error open application:', error);
      throw error;
    }
  },

  async fetchApplicatioTab() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/application/get-tab`, {});
      return response.data;
    } catch (error) {
      // console.error('Error application:', error);
      throw error;
    }
  },

  //-------------------------------------  Logs ---------------------------------------
  async getLastLogs(count, level) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}logs`, {
        params: { count, level },
      });
      return response.data;
    } catch (error) {
      // console.error('Error retrieving logs result:', error);
      throw error;
    }
  },

  async getLogLevel() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}loglevel`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async setLogLevel(level) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}loglevel`, { logLevel: level });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //-------------------------------------  Location ---------------------------------------
  async getTnsLocation() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}location`);
  },

  async getTnsTime() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}location/time`);
  },

  async setHorizonFilePath(filePath) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}location/horizon`, { filePath });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //-------------------------------------  System Controls ------------------------------
  shutdown() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}system/shutdown`);
  },

  restart() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}system/restart`);
  },
};
