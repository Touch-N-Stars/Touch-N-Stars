import axios from 'axios';
import { getActivePinia } from 'pinia';
import mockApiService from './mockApiService';

let settingsStore;
let store;
const DEFAULT_TIMEOUT = 10000;
const DEFAULT_PINS_DAEMON_API_TOKEN =
  'zZDqJ3IKeFaIZqG2JIFvsxzA5E48GC2gyGVagHFZqC0OMtgoupUDZCPhQDYKm35d';

// Check if mock API should be used
const useMockApi = () => {
  // Check localStorage for USE_MOCK_API flag
  return localStorage.getItem('USE_MOCK_API') === 'true';
};

const initializeStore = () => {
  if (!settingsStore || !store) {
    const pinia = getActivePinia();
    if (!pinia) {
      throw new Error('Pinia store not initialized');
    }
    settingsStore = pinia._s.get('settings');
    store = pinia._s.get('store');

    // Watch for connection changes
    settingsStore.$onAction(({ name }) => {
      if (name === 'setConnection') {
        // Connection changed - URLs will be regenerated on next request
      }
    });
  }
};

const getBaseUrl = () => {
  initializeStore();
  const protocol = settingsStore.backendProtocol || 'http';
  const host = settingsStore.connection.ip || window.location.hostname;
  let port = settingsStore.connection.port || window.location.port || 80;
  const apiPort = store.apiPort;

  //devport auf 5000 umleiten
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && port == 8080) {
    port = 5000;
  }

  return {
    base: `${protocol}://${host}:${apiPort}/v2/api`,
    api: `${protocol}://${host}:${port}/api/`,
    targetpic: `${protocol}://${host}:${port}/api/targetpic`,
    pluginServer: `${protocol}://${host}:${port}`,
    pinsDaemon: `${protocol}://${host}:8000`,
  };
};

const getUrls = () => {
  const urls = getBaseUrl();
  return {
    BASE_URL: urls.base,
    API_URL: urls.api,
    TARGETPIC_URL: urls.targetpic,
    PLUGINSERVER_URL: urls.pluginServer,
    PINSDAEMON_URL: urls.pinsDaemon,
  };
};

const resolvePinsDaemonApiToken = () => {
  initializeStore();

  const selectedInstance = settingsStore?.connection?.instances?.find(
    (instance) => instance.id === settingsStore?.selectedInstanceId
  );

  const tokenCandidates = [
    selectedInstance?.apiToken,
    settingsStore?.apiToken,
    settingsStore?.connection?.apiToken,
    localStorage.getItem('PINS_API_TOKEN'),
    localStorage.getItem('pinsApiToken'),
    localStorage.getItem('API_TOKEN'),
    localStorage.getItem('apiToken'),
    DEFAULT_PINS_DAEMON_API_TOKEN,
  ];

  const token = tokenCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
  );

  return token ? token.trim() : '';
};

const getPinsDaemonAuthHeaders = () => {
  const token = resolvePinsDaemonApiToken();
  if (!token) {
    throw new Error('Missing API token for file endpoints');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

const apiService = {
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

  async fetchApiPort(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}get-api-port`, { timeout });
      return response;
    } catch (error) {
      return false;
    }
  },

  async fetchTnsPluginVersion(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}version`, { timeout });
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
      return data;
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        console.warn(`fetchPinsVersion: Timeout nach ${timeout} ms`);
        return null;
      }
      if (err.response) {
        // HTTP response received (e.g. 404) — backend is up but no PINS endpoint
        return {};
      }
      // No response at all — backend not reachable
      return null;
    }
  },

  //------------------------------------------- time -------------------------------------------------
  async fetchNinaTime() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/time`);
  },

  //------------------------------------------- event-history -------------------------------------------------
  async getEventHistory() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/event-history`);
  },

  //------------------------------------------- Proxy -------------------------------------------------
  async proxyRequest(url) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}proxy?url=${encodeURIComponent(url)}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  //------------------------------------- PHD2 ------------------------------------------
  //https://github.com/acocalypso/N.I.N.A-Plugin-for-Touch-N-Stars/blob/PHD2/PHD2_API_README.md
  async connectPHD2() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/connect`, {
        instance: 1,
        hostname: 'localhost',
      });
      console.log('PHD2 TNS API connect:', response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async disconnectPHD2() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/disconnect`, {
        instance: 1,
        hostname: 'localhost',
      });
      console.log('PHD2 TNS API disconnect:', response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPhd2AllInfos() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/all-info`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPhd2Profile() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/profiles`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPhd2CurrentProfile() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-profile`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPhd2CurrentEquipment() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-current-equipment`);
      return response.data;
    } catch (error) {
      // console.error('Error fetching CurrentEquipment:', error);
      throw error;
    }
  },

  async connectPHD2Equipment(profileName) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/connect-equipment`, {
        profileName,
      });
      console.log('PHD2 TNS API connect-equipment:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error connect-equipment PHD2:', error);
      throw error;
    }
  },

  async disconnectPHD2Equipment() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/disconnect-equipment`, {});
      console.log('PHD2 TNS API disconnect-equipment:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error disconnect-equipment PHD2:', error);
      throw error;
    }
  },

  async setPHD2StartGuiding() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/start-guiding`, {});
      console.log('PHD2 TNS API stop guiding:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error disconnect-equipment PHD2:', error);
      throw error;
    }
  },

  async setPHD2StartLooping() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/start-looping`, {});
      console.log('PHD2 TNS API start-looping:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error disconnect-equipment PHD2:', error);
      throw error;
    }
  },

  async setPHD2StopGuiding() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/stop-guiding`, {});
      console.log('PHD2 TNS API disconnect-equipment:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error stop guiding PHD2:', error);
      throw error;
    }
  },

  async getPhd2Exposure() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-exposure`);
      return response.data;
    } catch (error) {
      // console.error('Error fetching favorites:', error);
      throw error;
    }
  },

  async setPHD2Exposure(exposureMs) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/set-exposure`, {
        exposureMs,
      });
      console.log('PHD2 TNS API setPHD2Exposure:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error setPHD2Exposure PHD2:', error);
      throw error;
    }
  },

  //GET /phd2/get-algo-param-names?axis=ra
  async getPhd2AlgoParaName(axis) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-algo-param-names`, {
        params: {
          axis: axis,
        },
      });
      console.log(response);
      return response.data;
    } catch (error) {
      // console.error('Error fetching get-algo-param-names:', error);
      throw error;
    }
  },

  //GET /phd2/get-algo-param?axis=ra&name=MinMove
  async getPhd2AlgoPara(axis, name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-algo-param`, {
        params: {
          axis: axis,
          name: name,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error fetching get-algo-param-names:', error);
      throw error;
    }
  },

  async setPHD2AlgoParam(axis, name, value) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/set-algo-param`, {
        axis: axis,
        name: name,
        value: value,
      });
      console.log('PHD2 TNS API setPHD2AlgoParam:', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error setPHD2AlgoParam PHD2:', error);
      throw error;
    }
  },

  async getPhd2CurrentImage() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/current-image`, {
        responseType: 'blob',
      });
      return URL.createObjectURL(response.data);
    } catch (error) {
      // console.error('Error fetching PHD2 current image:', error);
      throw error;
    }
  },

  async getPhd2StarImage() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/star-image?size=25`, {
        responseType: 'blob',
      });
      return URL.createObjectURL(response.data);
    } catch (error) {
      // console.error('Error fetching PHD2 star image:', error);
      throw error;
    }
  },

  async findPhd2Star(roi = null) {
    try {
      const { API_URL } = getUrls();
      const body = roi ? { roi } : {};
      const response = await axios.post(`${API_URL}phd2/find-star`, body);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getPhd2LockPosition() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/get-lock-position`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 500) {
        // console.error('Error fetching PHD2 lock position:', error);
      } else if (error.response && error.response.status === 400) {
        // console.log('Bad request for PHD2 lock position:', error);
      } else {
        // console.error('Error fetching PHD2 lock position:', error);
      }
      return { Success: false, Response: null };
    }
  },

  async getPhd2StarPositions() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/star-positions`);
      return response.data;
    } catch {
      return { Success: false, Response: null };
    }
  },

  async getPhd2CalibrationData() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}phd2/calibration-data`);
      return response.data;
    } catch {
      return { Success: false, Response: null };
    }
  },

  async clearPhd2Calibration() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}phd2/clear-calibration`);
      return response.data;
    } catch {
      return { Success: false, Response: null };
    }
  },

  async getPlugins() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/application/plugins`);
  },

  //------------------------------------- Fav Targets ------------------------------------------

  async getAllFavorites() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}favorites`);
      return response.data;
    } catch (error) {
      // console.error('Error fetching favorites:', error);
      throw error;
    }
  },

  async addFavorite(favorite) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}favorites`, favorite);
      return response.data;
    } catch (error) {
      // console.error('Error adding favorite:', error);
      throw error;
    }
  },

  async updateFavorite(id, updatedFavorite) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}favorites/${id}`, updatedFavorite);
      return response.data;
    } catch (error) {
      // console.error(`Error updating favorite with ID ${id}:`, error);
      throw error;
    }
  },

  async deleteFavorite(id) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.delete(`${API_URL}favorites/${id}`);
      return response.data;
    } catch (error) {
      // console.error(`Error deleting favorite with ID ${id}:`, error);
      throw error;
    }
  },

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
    return this._simpleGetRequest(`${BASE_URL}/prepared-image/solve`);
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

  async imageAction(index, action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/image/${index}/${action}`);
  },

  //-------------------------------------  sequence ---------------------------------------
  sequenceAction(action) {
    const { BASE_URL } = getUrls();
    if (action === 'start') {
      return this._simpleGetRequest(`${BASE_URL}/sequence/start?skipValidation=true`).then(
        (response) => ({
          ...response,
          Response: 'Sequence start',
          Success: true,
        })
      );
    }
    return this._simpleGetRequest(`${BASE_URL}/sequence/${action}`);
  },

  async fetchSequenceCurrent() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}sequence/current`);
  },

  async fetchSequenceInfo(id) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}sequence/info?id=${id}`);
  },

  async fetchSequenceMetadata(id) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}sequence/metadata?id=${id}`);
  },

  async sequenceMove(id, targetId, insertAfter = true) {
    const { API_URL } = getUrls();
    const response = await axios.post(
      `${API_URL}sequence/move?id=${id}&targetId=${targetId}&insertAfter=${insertAfter}`,
      {}
    );
    return response.data;
  },

  async sequenceRemove(id) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/remove?id=${id}`, {});
    return response.data;
  },

  async sequenceDuplicate(id) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/duplicate?id=${id}`, {});
    return response.data;
  },

  async getDateTimeProviders() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/date-time-providers`);
    return response.data;
  },

  async sequenceSetProperty(id, propertyName, value) {
    const { API_URL } = getUrls();
    const response = await axios.post(
      `${API_URL}sequence/set?id=${id}&propertyName=${encodeURIComponent(propertyName)}&value=${encodeURIComponent(value)}`,
      {}
    );
    return response.data;
  },

  async sequenceEnable(id, enabled) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/enable?id=${id}&enabled=${enabled}`, {});
    return response.data;
  },

  async sequenceResetStatus(id) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/reset-status?id=${id}`, {});
    return response.data;
  },

  async sequenceFetchItemTypes() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/items`);
    return response.data;
  },

  async sequenceFetchTriggerTypes() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/triggers`);
    return response.data;
  },

  async sequenceFetchConditionTypes() {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/conditions`);
    return response.data;
  },

  async sequenceAddItem(targetId, itemType, insertAfter = true) {
    const { API_URL } = getUrls();
    const ia = insertAfter === null ? '' : `&insertAfter=${insertAfter}`;
    const response = await axios.post(
      `${API_URL}sequence/add?targetId=${targetId}&type=${encodeURIComponent(itemType)}${ia}`,
      {}
    );
    return response.data;
  },

  async sequenceAddTrigger(itemId, triggerType, insertAfter = true) {
    const { API_URL } = getUrls();
    const ia = insertAfter === null ? '' : `&insertAfter=${insertAfter}`;
    const response = await axios.post(
      `${API_URL}sequence/add?targetId=${itemId}&type=${encodeURIComponent(triggerType)}${ia}`,
      {}
    );
    return response.data;
  },

  async sequenceAddCondition(itemId, conditionType, insertAfter = true) {
    const { API_URL } = getUrls();
    const ia = insertAfter === null ? '' : `&insertAfter=${insertAfter}`;
    const response = await axios.post(
      `${API_URL}sequence/add?targetId=${itemId}&type=${encodeURIComponent(conditionType)}${ia}`,
      {}
    );
    return response.data;
  },

  async sequenceLoadJson(sequenceName) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.post(`${BASE_URL}/sequence/load`, sequenceName);
      console.log('seqence loaded :', response.data);
      return response.data;
    } catch (error) {
      // console.error('Error seqence json load:', error);
      throw error;
    }
  },

  //PINS only
  async sequenceFetchFiles(folderPath) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/files`, {
      params: folderPath ? { folderPath } : {},
    });
    return response.data;
  },

  //PINS only
  async sequenceLoadFile(filePath) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}sequence/load`, {
      params: { filePath },
    });
    return response.data;
  },

  //PINS only
  async sequenceSaveFile(filePath) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/save`, null, {
      params: { filePath },
    });
    return response.data;
  },

  //PINS only
  async sequenceDeleteFile(filePath) {
    const { API_URL } = getUrls();
    const response = await axios.delete(`${API_URL}sequence/delete`, {
      params: { filePath },
    });
    return response.data;
  },

  async sequenceSkipToEnd() {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/sequence/skip?type=ToEnd`);
    return response.data;
  },

  async sequenceSkipCurrentItem() {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/sequence/skip?type=CurrentItems`);
    return response.data;
  },

  //PINS only
  async sequenceClear() {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}sequence/clear`);
    return response.data;
  },

  //sequence/set-target?name=Orion Nebula&ra=83.822083&dec=-5.391111&rotation=5&index=0
  async sequnceTargetSet(name, ra, dec, rotation, index) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/sequence/set-target?`, {
        params: {
          name,
          ra,
          dec,
          rotation,
          index,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error read Image :', error);
      throw error;
    }
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

  //-------------------------------------  Mount ---------------------------------------
  mountAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/mount/${action}`);
  },

  async setTrackingMode(TrackingMode) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/tracking`, {
        params: { mode: TrackingMode },
      });
      return response.data;
    } catch (error) {
      // console.error('Error setTrackingMode:', error);
      throw error;
    }
  },

  async moveAxis(direction, rate = 8) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/move-axis`, {
        params: {
          direction,
          rate,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error moveAxis:', error);
      throw error;
    }
  },

  async moveAxisStop() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/move-axis/stop`, {
        params: {},
      });
      return response.data;
    } catch (error) {
      // console.error('Error moveAxisStop:', error);
      throw error;
    }
  },

  //-------------------------------------  profile ---------------------------------------
  profileAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/profile/${action}`);
  },

  //   change-value
  async profileChangeValue(settingpath, newValue) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/profile/change-value`, {
        params: {
          settingpath,
          newValue,
        },
      });
      //console.log(response.data);
      return response.data;
    } catch (error) {
      // console.error('Error switch profil:', error);
      throw error;
    }
  },

  // Directory listing via HocusFocus plugin API (more reliable than PINS daemon for local paths)
  async listDirectories(path, timeout = DEFAULT_TIMEOUT) {
    if (!path || typeof path !== 'string') {
      return [];
    }
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}hocusfocus/browse-directories`, {
        params: { path },
        timeout,
      });
      if (response.data?.Success) {
        return response.data.directories || [];
      }
      const errMsg = response.data?.Error || 'Failed to load directory';
      const err = new Error(errMsg);
      throw err;
    } catch (error) {
      const status = error?.response?.status;
      const detail =
        error?.response?.data?.Error ||
        error?.response?.data?.message ||
        error?.message ||
        'Unknown error';
      const mappedError = new Error(detail);
      if (status) mappedError.status = status;
      throw mappedError;
    }
  },

  // api to get filesystem paths for image save path selection in settings
  async getFileDevices(timeout = DEFAULT_TIMEOUT) {
    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.get(`${PINSDAEMON_URL}/files/devices`, {
        timeout,
        headers: getPinsDaemonAuthHeaders(),
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status === 401) {
        const unauthorizedError = new Error('Unauthorized: missing or invalid API token');
        unauthorizedError.status = 401;
        throw unauthorizedError;
      }
      console.error('getFileDevices error:', error);
      return [];
    }
  },

  async listFileDirectories(path, timeout = DEFAULT_TIMEOUT) {
    if (!path || typeof path !== 'string') {
      return [];
    }

    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.get(`${PINSDAEMON_URL}/files/list`, {
        params: { path },
        timeout,
        headers: getPinsDaemonAuthHeaders(),
      });
      // Backend contract: this endpoint returns an array and uses [] as a valid empty result.
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      if (error?.response?.status === 401) {
        const unauthorizedError = new Error('Unauthorized: missing or invalid API token');
        unauthorizedError.status = 401;
        throw unauthorizedError;
      }
      // Backend may return [] on failures; frontend treats empty list as the safe fallback.
      console.warn('listFileDirectories fallback to []:', error?.message || error);
      return [];
    }
  },

  async createFileDirectory(path, name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { PINSDAEMON_URL } = getUrls();
      const response = await axios.post(
        `${PINSDAEMON_URL}/files/create-dir`,
        { path, name },
        {
          timeout,
          headers: getPinsDaemonAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 401) {
        const mappedError = new Error(detail || 'Unauthorized: missing or invalid API token');
        mappedError.status = status;
        throw mappedError;
      }

      if ((status === 400 || status === 403) && detail) {
        const mappedError = new Error(detail);
        mappedError.status = status;
        throw mappedError;
      }

      console.error('createFileDirectory error:', error);
      throw error;
    }
  },

  // New filesystem endpoints
  async browseFilesystem(path = '') {
    const { API_URL } = getUrls();
    const params = path ? { path } : {};
    const response = await axios.get(`${API_URL}filesystem/browse`, {
      params,
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data; // { success, currentPath, parentPath, directories[], files[] }
  },

  async createFilesystemDirectory(path) {
    const { API_URL } = getUrls();
    const response = await axios.post(
      `${API_URL}filesystem/directory`,
      { path },
      { timeout: DEFAULT_TIMEOUT }
    );
    return response.data;
  },

  async deleteFilesystemDirectory(path) {
    const { API_URL } = getUrls();
    const response = await axios.delete(`${API_URL}filesystem/directory`, {
      params: { path },
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  async deleteFilesystemFile(path) {
    const { API_URL } = getUrls();
    const response = await axios.delete(`${API_URL}filesystem/file`, {
      params: { path },
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  async renameFilesystemEntry(sourcePath, targetPath) {
    const { API_URL } = getUrls();
    const response = await axios.put(
      `${API_URL}filesystem/rename`,
      { sourcePath, targetPath },
      { timeout: DEFAULT_TIMEOUT }
    );
    return response.data;
  },

  getFilesystemFileStreamUrl(path) {
    const { API_URL } = getUrls();
    return `${API_URL}filesystem/file?path=${encodeURIComponent(path || '')}`;
  },

  async fetchFilesystemFileBuffer(path) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}filesystem/file`, {
      params: { path },
      responseType: 'arraybuffer',
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  async fetchFilesystemFileText(path) {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}filesystem/file`, {
      params: { path },
      responseType: 'text',
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  // Available Serial Ports
  async availableSerialPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}indi/serialports`);
      const data = response.data.Response;
      if (data && Array.isArray(data.Ports)) {
        const byIdLinks = (data.ByIdLinks || []).map((link) => ({
          Port: link.Path,
          Description: '',
        }));
        if (byIdLinks.length > 0) {
          return [
            ...data.Ports,
            { Port: '', Description: '', separator: true, label: '─── by-id ───' },
            ...byIdLinks,
          ];
        }
        return data.Ports;
      }
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching available serial ports:', error);
      return [];
    }
  },

  // Profil Switch
  async profileSwitch(profileid) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/profile/switch`, {
        params: { profileid: profileid },
      });
      return response.data;
    } catch (error) {
      // console.error('Error switch profil:', error);
      throw error;
    }
  },

  // Profile Add (PINS only) - creates blank profile, name must be set separately via profileChangeValue
  async profileAdd() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/profile/add`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Profile Clone (PINS only) - clones profile by id, name must be set separately via profileChangeValue
  async profileClone(id) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/profile/clone`, {
        params: { profileid: id },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Profile Remove (PINS only)
  async profileRemove(id) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/profile/remove`, {
        params: { profileid: id },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async postProfileHorizon(hrzText) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.post(`${BASE_URL}/profile/horizon`, hrzText, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error) {
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

  //-------------------------------------  Camera ---------------------------------------
  cameraAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/camera/${action}`);
  },

  async getCaptureStatisticsFull() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/camera/capture/statistics/full`);
  },

  async getPreparedImageStatistics() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/prepared-image/statistics`);
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

  //-------------------------------------  Filterwheel ---------------------------------------
  filterAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/filterwheel/${action}`);
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
    return this._simpleGetRequest(`${BASE_URL}/equipment/rotator/${action}`);
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

  //-------------------------------------  flatdevice ---------------------------------------

  flatdeviceAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/flatdevice/${action}`);
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
    return this._simpleGetRequest(`${BASE_URL}/flats/${action}`);
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
    return this._simpleGetRequest(`${API_URL}flats/status`);
  },

  async flatMultiStop() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}flats/stop`);
  },

  //-------------------------------------  dome ---------------------------------------
  domeAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/dome/${action}`);
  },

  //-------------------------------------  focuser ---------------------------------------
  focusAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/focuser/${action}`);
  },

  focuserAfAction(action) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}autofocus/${action}`);
  },

  focuserLastAf() {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/focuser/last-af`);
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
    return this._simpleGetRequest(`${BASE_URL}/equipment/switch/${action}`);
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
    return this._simpleGetRequest(`${BASE_URL}/equipment/weather/${action}`);
  },

  //------------------------------------- AlpacaDirect ----------------------------------------
  async getAlpacaDirectSettings(deviceType) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}alpaca-direct/${deviceType}/settings`);
  },

  async setAlpacaDirectSettings(deviceType, body) {
    const { API_URL } = getUrls();
    const response = await axios.put(`${API_URL}alpaca-direct/${deviceType}/settings`, body, {
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  //-------------------------------------  Framing ---------------------------------------
  framingAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/framing/${action}`);
  },

  async setFramingImageSource(source) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/framing/set-source`, {
        params: { source },
      });
      return response.data;
    } catch (error) {
      // console.error('Error controlling setFramingImageSource:', error);
      throw error;
    }
  },

  async setFramingCoordinates(RAangle, DECangle) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/framing/set-coordinates`, {
        params: { RAangle, DECangle },
      });
      return response.data;
    } catch (error) {
      // console.error('Error setting framing coordinates:', error);
      throw error;
    }
  },

  async slewAndCenter(ra, dec, Center = false, rotate = false, rotationAngle) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/slew`, {
        params: {
          ra: ra,
          dec: dec,
          center: Center,
          rotate: rotate,
          rotationAngle: rotationAngle,
          waitForResult: true,
        },
      });
      console.log('Slew response: ', response);
      return response.data;
    } catch (error) {
      // console.error('Error controlling slewAndCenterAndRotate:', error);
      throw error;
    }
  },
  async slewStop() {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/equipment/mount/slew/stop`);
      return response.data;
    } catch (error) {
      // console.error('Error controlling slewAndCenterAndRotate:', error);
      throw error;
    }
  },

  async framingRotate(rotation) {
    try {
      const { BASE_URL } = getUrls();
      await axios.get(`${BASE_URL}/framing/set-rotation`, {
        params: {
          rotation: rotation,
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 3000)); // damit NINA genug Zeit hat die Koordinaten zu setzen
      const response = await axios.get(`${BASE_URL}/framing/slew`, {
        params: {
          slew_option: 'Rotate',
          waitForResult: true,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error controlling slewAndCenterAndRotate:', error);
      throw error;
    }
  },

  async cancelSlewAndCenter() {
    //Kommt von der TNS API
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}framing/cancel`, {});
      console.log('Cancel SlweAndCenter:', response.data);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  //-------------------------------------  Target Search ---------------------------------------

  async searchNGC(query, limit = 50) {
    if (!query || query.replace(/[^a-zA-Z0-9]/g, '').length < 2) {
      return { data: [] };
    }
    const { API_URL } = getUrls();
    return this._getWithParams(`${API_URL}ngc/search`, { query, limit });
  },

  async searchTargetPic(width, height, fov, ra, dec, useCache) {
    try {
      const { TARGETPIC_URL } = getUrls();
      const response = await axios.get(TARGETPIC_URL, {
        params: {
          width,
          height,
          fov,
          ra,
          dec,
          useCache,
        },
        responseType: 'blob',
      });
      return URL.createObjectURL(response.data);
    } catch (error) {
      // console.error('Error retrieving target picture:', error);
      throw error;
    }
  },

  //-------------------------------------  guider ---------------------------------------
  /* commands:
      - info
      - clear-calibration
      - graph                 */

  guiderAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/guider/${action}`);
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
    return this._simpleGetRequest(`${BASE_URL}/equipment/safetymonitor/${action}`);
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

  //-------------------------------------  Settings ---------------------------------------
  async getAllSettings() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}settings`);
      return response.data;
    } catch (error) {
      console.error('Error fetching settings:', error);
      throw error;
    }
  },

  async getSetting(key) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}settings/${key}`, {
        headers: {
          'X-Suppress-Toast-404': 'true', // Tell error handler to suppress 404 toasts for settings
        },
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching setting '${key}':`, error);
      throw error;
    }
  },

  async createSetting(setting) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}settings`, setting);
      return response.data;
    } catch (error) {
      console.error('Error creating setting:', error);
      throw error;
    }
  },

  async updateSetting(key, value) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}settings/${key}`, { Value: value });
      return response.data;
    } catch (error) {
      console.error(`Error updating setting '${key}':`, error);
      throw error;
    }
  },

  async deleteSetting(key) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.delete(`${API_URL}settings/${key}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting setting '${key}':`, error);
      throw error;
    }
  },

  //-------------------------------------  Sequence Creator ------------------------------
  async getDefaultSequence() {
    try {
      const response = await this.getSetting('sequence_creator_default');
      if (response && response.Response && response.Response.Value) {
        return JSON.parse(response.Response.Value);
      }
      return null;
    } catch (error) {
      if (error.response?.status === 404 || error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async saveDefaultSequence(sequenceData) {
    try {
      await this.createSetting({
        Key: 'sequence_creator_default',
        Value: JSON.stringify(sequenceData),
      });
    } catch (error) {
      if (error.response && error.response.status === 409) {
        await this.updateSetting('sequence_creator_default', JSON.stringify(sequenceData));
      } else {
        throw error;
      }
    }
  },

  async deleteDefaultSequence() {
    try {
      await this.deleteSetting('sequence_creator_default');
    } catch (error) {
      console.error('Error deleting default sequence:', error);
      throw error;
    }
  },

  //-------------------------------------  Livestack ---------------------------------------
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

  // --- Observation Planner helpers ---
  async getActiveProfile() {
    // profileAction('show?active=true') exists already
    const res = await this.profileAction('show?active=true');
    return res?.Response ?? res;
  },

  // save image save path
  async setImageSavePath(path) {
    return await this.profileChangeValue('ImageFileSettings-FilePath', path);
  },

  async getAstrometrySettings() {
    const profile = await this.getActiveProfile();
    // expected path (matches mock structure)
    return profile?.AstrometrySettings ?? null;
  },

  //-------------------------------------  PINS Devices ---------------------------------
  async getPinsDevices() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/devices`);
      return response.data;
    } catch (error) {
      console.error('Error fetching PINS devices:', error);
      throw error;
    }
  },

  async getPinsDevicePowerbox() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox`);
      return response.data;
    } catch (error) {
      console.error('Error fetching powerbox info:', error);
      throw error;
    }
  },

  async getPinsDevicePowerboxStatus() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching powerbox status:', error);
      throw error;
    }
  },

  async getPinsDevicePowerPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/powerports/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching power ports:', error);
      throw error;
    }
  },

  async setPinsDevicePowerPortState(portIndex, enabled) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/powerports/${portIndex}/set-enabled`,
        null,
        {
          params: { enabled },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting power port state:', error);
      throw error;
    }
  },

  async setPinsDevicePowerPortName(portIndex, name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/powerports/${portIndex}/set-name`,
        null,
        {
          params: { name },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting power port name:', error);
      throw error;
    }
  },

  async getPinsDeviceUsbPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/usbports/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching USB ports:', error);
      throw error;
    }
  },

  async setPinsDeviceUsbPortState(portIndex, enabled) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/usbports/${portIndex}/set-enabled`,
        null,
        {
          params: { enabled },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting USB port state:', error);
      throw error;
    }
  },

  async setPinsDeviceUsbPortName(portIndex, name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/usbports/${portIndex}/set-name`,
        null,
        {
          params: { name },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting USB port name:', error);
      throw error;
    }
  },

  async setPinsDevicePowerPortBootState(portIndex, bootState) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/powerports/${portIndex}/set-bootstate`,
        null,
        {
          params: { bootState },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting power port boot state:', error);
      throw error;
    }
  },

  async setPinsDeviceUsbPortBootState(portIndex, bootState) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/usbports/${portIndex}/set-bootstate`,
        null,
        {
          params: { bootState },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting USB port boot state:', error);
      throw error;
    }
  },

  async getPinsDeviceDewPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/dewports/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dew ports:', error);
      throw error;
    }
  },

  async setPinsDeviceDewPortState(portIndex, enabled) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/dewports/${portIndex}/set-enabled`,
        null,
        {
          params: { enabled },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting dew port state:', error);
      throw error;
    }
  },

  async setPinsDeviceDewPortName(portIndex, name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/dewports/${portIndex}/set-name`,
        null,
        {
          params: { name },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting dew port name:', error);
      throw error;
    }
  },

  async setPinsDeviceDewPortAutoMode(portIndex, automode) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/dewports/${portIndex}/set-automode`,
        null,
        {
          params: { automode },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting dew port auto mode:', error);
      throw error;
    }
  },

  async setPinsDeviceDewPortAutoThreshold(portIndex, autothreshold) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/dewports/${portIndex}/set-autothreshold`,
        null,
        {
          params: { autothreshold },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting dew port auto threshold:', error);
      throw error;
    }
  },

  async setPinsDeviceDewPortPowerLevel(portIndex, powerlevel) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/powerbox/dewports/${portIndex}/set-powerlevel`,
        null,
        {
          params: { powerlevel },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting dew port power level:', error);
      throw error;
    }
  },

  // --------------------------------- Buck Converter Ports ---------------------------------
  async getPinsDeviceBuckPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/buck/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting buck ports:', error);
      throw error;
    }
  },

  async setPinsDeviceBuckPortState(enabled) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/buck/set-enabled`, null, {
        params: { enabled },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting buck port enabled:', error);
      throw error;
    }
  },

  async setPinsDeviceBuckPortName(name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/buck/set-name`, null, {
        params: { name },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting buck port name:', error);
      throw error;
    }
  },

  async setPinsDeviceBuckPortBootState(bootstate) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/buck/set-bootstate`, null, {
        params: { bootstate },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting buck port boot state:', error);
      throw error;
    }
  },

  async setPinsDeviceBuckPortVoltage(voltage) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/buck/set-voltage`, null, {
        params: { voltage },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting buck port voltage:', error);
      throw error;
    }
  },

  // --------------------------------- PWM Ports ---------------------------------
  async getPinsDevicePwmPorts() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/pwm/status`);
      return response.data;
    } catch (error) {
      console.error('Error getting PWM ports:', error);
      throw error;
    }
  },

  async setPinsDevicePwmPortState(enabled) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/pwm/set-enabled`, null, {
        params: { enabled },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting PWM port enabled:', error);
      throw error;
    }
  },

  async setPinsDevicePwmPortName(name) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/pwm/set-name`, null, {
        params: { name },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting PWM port name:', error);
      throw error;
    }
  },

  async setPinsDevicePwmPortPower(power) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/pwm/set-power`, null, {
        params: { power },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting PWM port power:', error);
      throw error;
    }
  },

  // --------------------------------- PowerBox Configuration ---------------------------------
  async setPinsDeviceTemperatureOffset(offset) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/set-temperature-offset`, null, {
        params: { offset },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting temperature offset:', error);
      throw error;
    }
  },

  async setPinsDeviceHumidityOffset(offset) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/set-humidity-offset`, null, {
        params: { offset },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting humidity offset:', error);
      throw error;
    }
  },

  async setPinsDeviceEnvUpdateRate(updateRate) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/set-env-update-rate`, null, {
        params: { updateRate },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting environment update rate:', error);
      throw error;
    }
  },

  async setPinsDeviceUpdateRate(updateRate) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/powerbox/set-update-rate`, null, {
        params: { updateRate },
      });
      return response.data;
    } catch (error) {
      console.error('Error setting update rate:', error);
      throw error;
    }
  },

  async factoryResetPinsDevice() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}pins/powerbox/factory-reset`, {});
      return response.data;
    } catch (error) {
      console.error('Error performing factory reset:', error);
      throw error;
    }
  },

  async beepPinsDevice(volume = 100, lengthMs = 1000) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}pins/powerbox/beep?volume=${volume}&lengthMs=${lengthMs}`
      );
      return response.data;
    } catch (error) {
      console.error('Error beeping PowerBox:', error);
      throw error;
    }
  },

  // --------------------------------- PowerBox WiFi ---------------------------------
  async getPinsDeviceWiFi() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/powerbox/wifi`);
      return response.data;
    } catch (error) {
      console.error('Error fetching WiFi info:', error);
      throw error;
    }
  },

  async connectPinsDeviceWiFiAP(ssid, password) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}pins/powerbox/wifi/connect-ap`, null, {
        params: { ssid, password },
      });
      return response.data;
    } catch (error) {
      console.error('Error creating WiFi AP:', error);
      throw error;
    }
  },

  //-------------------------------------  Location ---------------------------------------
  async getTnsLocation() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}location`);
  },

  async getTnsTime() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}location/time`);
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
    return this._simpleGetRequest(`${API_URL}system/shutdown`);
  },

  restart() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}system/restart`);
  },

  //-------------------------------------  Helper ---------------------------------------
  _simpleGetRequest(url) {
    return axios
      .get(url)
      .then((response) => response.data)
      .catch((error) => {
        // console.error(`Error in GET request to ${url}:`, error);
        throw error;
      });
  },

  _getWithParams(url, params) {
    return axios
      .get(url, { params })
      .then((response) => response.data)
      .catch((error) => {
        // console.error(`Error in GET request to ${url} with params:`, error);
        throw error;
      });
  },

  // --------------------------------- MeteoStation Weather ---------------------------------
  async getMeteoStationInfo() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/meteostation`);
      return response.data;
    } catch (error) {
      console.error('Error fetching meteostation info:', error);
      throw error;
    }
  },

  async getMeteoStationStatus() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/meteostation/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching meteostation status:', error);
      throw error;
    }
  },

  async setMeteoStationTemperatureOffset(offset) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/meteostation/set-temperature-offset`,
        {},
        {
          params: { offset },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting meteostation temperature offset:', error);
      throw error;
    }
  },

  async setMeteoStationHumidityOffset(offset) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/meteostation/set-humidity-offset`,
        {},
        {
          params: { offset },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting meteostation humidity offset:', error);
      throw error;
    }
  },

  async setMeteoStationUpdateRate(updateRate) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/meteostation/set-update-rate`,
        {},
        {
          params: { updateRate },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting meteostation update rate:', error);
      throw error;
    }
  },

  async factoryResetMeteoStation() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}pins/meteostation/factory-reset`, {});
      return response.data;
    } catch (error) {
      console.error('Error performing meteostation factory reset:', error);
      throw error;
    }
  },

  // --------------------------------- HocusFocus Plugin ---------------------------------
  hocusfocus: {
    async listAutoFocusSessions() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/autofocus-sessions`);
        return response.data;
      } catch (error) {
        console.error('Error listing AutoFocus sessions:', error);
        throw error;
      }
    },

    async loadAutoFocusSession(sessionData) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(
          `${API_URL}hocusfocus/load-autofocus-session`,
          sessionData
        );
        return response.data;
      } catch (error) {
        console.error('Error loading AutoFocus session:', error);
        throw error;
      }
    },

    async runDetailedAutoFocus() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/run-detailed-af`);
        return response.data;
      } catch (error) {
        console.error('Error running detailed AutoFocus:', error);
        throw error;
      }
    },

    async listAutoFocusDirectories() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/list-af`);
        return response.data;
      } catch (error) {
        console.error('Error listing AutoFocus directories:', error);
        throw error;
      }
    },

    async rerunDetailedAutoFocus(afDirectory = null) {
      try {
        const { API_URL } = getUrls();
        const payload = afDirectory ? { afDirectory } : {};
        const response = await axios.post(`${API_URL}hocusfocus/re-run-detailed-af`, payload);
        return response.data;
      } catch (error) {
        console.error('Error re-running detailed AutoFocus:', error);
        throw error;
      }
    },

    async cancelDetailedAutoFocus() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/cancel-detailed-af`);
        return response.data;
      } catch (error) {
        console.error('Error cancelling AutoFocus:', error);
        throw error;
      }
    },

    async clearDetailedAutoFocus() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/clear-detailed-af`);
        return response.data;
      } catch (error) {
        console.error('Error clearing detailed AutoFocus:', error);
        throw error;
      }
    },

    async getRegionFocusPoints() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/region-focus-points`);
        return response.data;
      } catch (error) {
        console.error('Error getting region focus points:', error);
        throw error;
      }
    },

    async getTiltCornerMeasurements() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilt-corner-measurements`);
        return response.data;
      } catch (error) {
        console.error('Error getting tilt corner measurements:', error);
        throw error;
      }
    },

    async getTiltMeasurementHistory() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilt-measurement-history`);
        return response.data;
      } catch (error) {
        console.error('Error getting tilt measurement history:', error);
        throw error;
      }
    },

    async getFinalFocusData() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/final-focus-data`);
        return response.data;
      } catch (error) {
        console.error('Error getting final focus data:', error);
        throw error;
      }
    },

    async getStatus() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/status`);
        return response.data;
      } catch (error) {
        console.error('Error getting status:', error);
        throw error;
      }
    },

    async getStarDetectionOptions() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/star-detection/options`);
        return response.data;
      } catch (error) {
        console.error('Error getting Star Detection options:', error);
        throw error;
      }
    },

    async resetStarDetectionDefaults() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/star-detection/reset-defaults`);
        return response.data;
      } catch (error) {
        console.error('Error resetting Star Detection to defaults:', error);
        throw error;
      }
    },

    async setStarDetectionOption(optionName, value) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(
          `${API_URL}hocusfocus/star-detection/options/${optionName}`,
          { value }
        );
        return response.data;
      } catch (error) {
        console.error(`Error setting Star Detection option ${optionName}:`, error);
        throw error;
      }
    },

    async getAutoFocusOptions() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/autofocus/options`);
        return response.data?.Options || {};
      } catch (error) {
        console.error('Error getting AutoFocus options:', error);
        throw error;
      }
    },

    async setAutoFocusOptions(options) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/autofocus/options`, options);
        return response.data;
      } catch (error) {
        console.error('Error setting AutoFocus options:', error);
        throw error;
      }
    },

    async setAutoFocusOption(optionName, value) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/autofocus/options/${optionName}`, {
          value,
        });
        return response.data;
      } catch (error) {
        console.error(`Error setting AutoFocus option ${optionName}:`, error);
        throw error;
      }
    },

    async resetAutoFocusDefaults() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/autofocus/reset-defaults`);
        return response.data;
      } catch (error) {
        console.error('Error resetting AutoFocus options to defaults:', error);
        throw error;
      }
    },

    async getAberrationInspectorOptions() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/aberration-inspector/options`);
        return response.data?.Options || {};
      } catch (error) {
        console.error('Error getting Aberration Inspector options:', error);
        throw error;
      }
    },

    async setAberrationInspectorOption(optionName, value) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(
          `${API_URL}hocusfocus/aberration-inspector/options/${optionName}`,
          {
            value,
          }
        );
        return response.data;
      } catch (error) {
        console.error(`Error setting Aberration Inspector option ${optionName}:`, error);
        throw error;
      }
    },

    async resetAberrationInspectorDefaults() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(
          `${API_URL}hocusfocus/aberration-inspector/reset-defaults`
        );
        return response.data;
      } catch (error) {
        console.error('Error resetting Aberration Inspector options to defaults:', error);
        throw error;
      }
    },

    async getLastAutoFocusRun() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/autofocus/last-run`);
        return response.data;
      } catch (error) {
        // Not available without HocusFocus plugin — silently return null
        return null;
      }
    },

    async browseDirectories(path = null) {
      try {
        const { API_URL } = getUrls();
        let url = `${API_URL}hocusfocus/browse-directories`;
        if (path) {
          url += `?path=${encodeURIComponent(path)}`;
        }
        console.log('[API] Browsing directories with URL:', url);
        const response = await axios.get(url);
        console.log('[API] Browse response:', response);
        return response.data;
      } catch (error) {
        console.error('[API] Error browsing directories:', error);
        console.error('[API] Error details:', {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: error.config,
        });
        throw error;
      }
    },

    // Tilter API Methods
    async getTilterDevices() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilter/devices`);
        return response.data;
      } catch (error) {
        console.error('Error getting tilter devices:', error);
        throw error;
      }
    },

    async scanTilterDevices() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilter/scan-devices`);
        return response.data;
      } catch (error) {
        console.error('Error scanning tilter devices:', error);
        throw error;
      }
    },

    async connectTilterDevice(deviceId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/tilter/connect`, {
          deviceId: deviceId,
        });
        return response.data;
      } catch (error) {
        console.error('Error connecting tilter device:', error);
        throw error;
      }
    },

    async disconnectTilterDevice(deviceId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/tilter/disconnect`, {
          deviceId: deviceId,
        });
        return response.data;
      } catch (error) {
        console.error('Error disconnecting tilter device:', error);
        throw error;
      }
    },

    async getTilterStatus(deviceId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilter/status/${deviceId}`);
        return response.data;
      } catch (error) {
        console.error('Error getting tilter status:', error);
        throw error;
      }
    },

    async isTilterDeviceConnected(deviceId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilter/is-connected/${deviceId}`);
        return response.data;
      } catch (error) {
        console.error('Error checking tilter connection status:', error);
        throw error;
      }
    },

    async getSensorConfiguration() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}hocusfocus/tilter/sensor-config`);
        return response.data;
      } catch (error) {
        console.error('Error getting sensor configuration:', error);
        throw error;
      }
    },

    async setSensorConfiguration(config) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/tilter/sensor-config`, config);
        return response.data;
      } catch (error) {
        console.error('Error setting sensor configuration:', error);
        throw error;
      }
    },

    async setTilterPositions(deviceId, positions) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}hocusfocus/tilter/set-positions`, {
          deviceId: deviceId,
          positions: positions,
        });
        return response.data;
      } catch (error) {
        console.error('Error setting tilter positions:', error);
        throw error;
      }
    },

    async applyTiltPlane(
      deviceId,
      topLeftZ,
      topRightZ,
      bottomLeftZ,
      bottomRightZ,
      outerRadius,
      dontOffsetToZero
    ) {
      try {
        const { API_URL } = getUrls();
        const requestBody = {
          deviceId: deviceId,
          imagePlaneTopLeftZ: topLeftZ,
          imagePlaneTopRightZ: topRightZ,
          imagePlaneBottomLeftZ: bottomLeftZ,
          imagePlaneBottomRightZ: bottomRightZ,
        };

        // Only include outerRadius if provided (for manual tilters)
        if (outerRadius !== undefined && outerRadius !== null) {
          requestBody.outerRadius = outerRadius;
        }

        // Include dontOffsetToZero flag if provided (for manual tilters)
        if (dontOffsetToZero !== undefined && dontOffsetToZero !== null) {
          requestBody.dontOffsetToZero = dontOffsetToZero;
        }

        const response = await axios.post(
          `${API_URL}hocusfocus/tilter/apply-tilt-plane`,
          requestBody
        );
        return response.data;
      } catch (error) {
        console.error('Error applying tilt plane:', error);
        // Extract error message from response if available
        if (error.response && error.response.data) {
          throw new Error(
            error.response.data.Error || error.response.data.message || error.message
          );
        }
        throw error;
      }
    },
  },

  //------------------------------------------- TPPA (PINS) ------------------------------------------
  async getTppaOptions(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tppa/options`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error fetching TPPA options:', error);
      throw error;
    }
  },

  async postTppaOptions(options, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tppa/options`, options, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error posting TPPA options:', error);
      throw error;
    }
  },

  async postTppaReset(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tppa/reset`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error resetting TPPA options:', error);
      throw error;
    }
  },

  // ── 10micron Model Builder ──────────────────────────────────────────────────
  async tenMicronGetStatus(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/status`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron status:', error);
      throw error;
    }
  },

  async tenMicronGetMountTime(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/time`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron mount time:', error);
      throw error;
    }
  },

  async tenMicronGetBuilderStatus(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/builder-status`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron builder status:', error);
      throw error;
    }
  },

  async tenMicronGetBuilderOptions(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/builder-options`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron builder options:', error);
      throw error;
    }
  },

  async tenMicronSetBuilderOption(key, value, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/builder-option`,
        { key, value },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron builder option:', error);
      throw error;
    }
  },

  async tenMicronResetBuilderOptions(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/reset-builder-options`,
        {},
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error resetting TenMicron builder options:', error);
      throw error;
    }
  },

  async tenMicronGetAlignmentModel(timeout = 60000) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/alignment-model`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron alignment model:', error);
      throw error;
    }
  },

  async tenMicronGetModelNames(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}tenmicron/model-names`, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error getting TenMicron model names:', error);
      throw error;
    }
  },

  async tenMicronGenerateGoldenSpiral(starCount, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/generate-golden-spiral`,
        { starCount },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error generating golden spiral:', error);
      throw error;
    }
  },

  async tenMicronGenerateSiderealPath(params, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/generate-sidereal-path`, params, {
        timeout,
      });
      return response.data;
    } catch (error) {
      console.error('Error generating sidereal path:', error);
      throw error;
    }
  },

  async tenMicronSiderealCoordsFromScope(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/sidereal-path-coords-from-scope`,
        {},
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching scope coords:', error);
      throw error;
    }
  },

  async tenMicronSiderealCoordsFromSequence(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/sidereal-path-coords-from-sequence`,
        {},
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching sequence coords:', error);
      throw error;
    }
  },

  async tenMicronClearPoints(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/clear-points`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error clearing TenMicron points:', error);
      throw error;
    }
  },

  async tenMicronBuildModel(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/build-model`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error starting TenMicron build:', error);
      throw error;
    }
  },

  async tenMicronCancelBuild(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/cancel-build`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error cancelling TenMicron build:', error);
      throw error;
    }
  },

  async tenMicronStopBuild(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/stop-build`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error stopping TenMicron build:', error);
      throw error;
    }
  },

  async tenMicronLoadModel(name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/load-model`, { name }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error loading TenMicron model:', error);
      throw error;
    }
  },

  async tenMicronSaveModel(name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/save-model`, { name }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error saving TenMicron model:', error);
      throw error;
    }
  },

  async tenMicronDeleteModel(name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/delete-model`, { name }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error deleting TenMicron model:', error);
      throw error;
    }
  },

  async tenMicronDeleteWorstStar(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/delete-worst-star`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error deleting worst alignment star:', error);
      throw error;
    }
  },

  async tenMicronClearAlignment(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/clear-alignment`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error clearing TenMicron alignment:', error);
      throw error;
    }
  },

  async tenMicronSetDualAxisTracking(enabled, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/dual-axis-tracking`,
        { enabled },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron dual axis tracking:', error);
      throw error;
    }
  },

  async tenMicronSetRefractionCorrection(enabled, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/refraction-correction`,
        { enabled },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron refraction correction:', error);
      throw error;
    }
  },

  async tenMicronDisableUnattendedFlip(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/unattended-flip/disable`,
        {},
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error disabling TenMicron unattended flip:', error);
      throw error;
    }
  },

  async tenMicronResetMeridianLimit(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}tenmicron/reset-meridian-limit`,
        {},
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('Error resetting TenMicron meridian limit:', error);
      throw error;
    }
  },

  async tenMicronResetSlewSettle(timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/reset-slew-settle`, {}, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error resetting TenMicron slew settle time:', error);
      throw error;
    }
  },

  async tenMicronSetSlewRate(value, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/slew-rate`, { value }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron slew rate:', error);
      throw error;
    }
  },

  async tenMicronSetHorizonHigh(value, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/horizon-high`, { value }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron horizon limit high:', error);
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

  async tenMicronSetHorizonLow(value, timeout = DEFAULT_TIMEOUT) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}tenmicron/horizon-low`, { value }, { timeout });
      return response.data;
    } catch (error) {
      console.error('Error setting TenMicron horizon limit low:', error);
      throw error;
    }
  },

  // --------------------------------- Night Summary Plugin ---------------------------------
  nightsummary: {
    async getStatus() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}nightsummary/status`);
        return response.data;
      } catch (error) {
        return { Success: false, Response: { Installed: false } };
      }
    },

    async getSettings() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}nightsummary/settings`);
        return response.data;
      } catch (error) {
        console.error('Error fetching Night Summary settings:', error);
        throw error;
      }
    },

    async updateSettings(patch) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.put(`${API_URL}nightsummary/settings`, patch);
        return response.data;
      } catch (error) {
        console.error('Error updating Night Summary settings:', error);
        throw error;
      }
    },

    async testEmail() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}nightsummary/test-email`);
        return response.data;
      } catch (error) {
        return { Success: true, Response: { Ok: false, Message: error.message } };
      }
    },

    async testDiscord() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}nightsummary/test-discord`);
        return response.data;
      } catch (error) {
        return { Success: true, Response: { Ok: false, Message: error.message } };
      }
    },

    async testPushover() {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(`${API_URL}nightsummary/test-pushover`);
        return response.data;
      } catch (error) {
        return { Success: true, Response: { Ok: false, Message: error.message } };
      }
    },

    async getSessions(limit = 50) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(`${API_URL}nightsummary/sessions`, { params: { limit } });
        return response.data;
      } catch (error) {
        console.error('Error fetching Night Summary sessions:', error);
        throw error;
      }
    },

    async getSession(sessionId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.get(
          `${API_URL}nightsummary/sessions/${encodeURIComponent(sessionId)}`
        );
        return response.data;
      } catch (error) {
        console.error('Error fetching Night Summary session:', error);
        throw error;
      }
    },

    async resendSession(sessionId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.post(
          `${API_URL}nightsummary/sessions/${encodeURIComponent(sessionId)}/resend`
        );
        return response.data;
      } catch (error) {
        console.error('Error resending Night Summary session:', error);
        throw error;
      }
    },

    async deleteSession(sessionId) {
      try {
        const { API_URL } = getUrls();
        const response = await axios.delete(
          `${API_URL}nightsummary/sessions/${encodeURIComponent(sessionId)}`
        );
        return response.data;
      } catch (error) {
        console.error('Error deleting Night Summary session:', error);
        throw error;
      }
    },
  },
};

// Create a proxy that checks for mock mode and routes accordingly
const apiServiceProxy = new Proxy(apiService, {
  get(target, prop) {
    // If mock mode is enabled and the method exists in mock service, use it
    if (useMockApi() && typeof mockApiService[prop] === 'function') {
      console.log(`[MOCK MODE] Using mock implementation for: ${prop}`);
      return mockApiService[prop].bind(mockApiService);
    }
    // Otherwise use real API service
    return target[prop];
  },
});

export default apiServiceProxy;
