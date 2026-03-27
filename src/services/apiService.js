import axios from 'axios';
import { getActivePinia } from 'pinia';
import mockApiService from './mockApiService';

let settingsStore;
let store;
const DEFAULT_TIMEOUT = 10000;

// Check if mock API should be used
const useMockApi = () => {
  // Check localStorage for USE_MOCK_API flag
  return localStorage.getItem('USE_MOCK_API') === 'true';
};

const initializeStore = () => {
  if (!settingsStore) {
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
  };
};

const getUrls = () => {
  const urls = getBaseUrl();
  return {
    BASE_URL: urls.base,
    API_URL: urls.api,
    TARGETPIC_URL: urls.targetpic,
    PLUGINSERVER_URL: urls.pluginServer,
  };
};

const apiService = {
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
      } else {
        // console.error('Error reaching backend:', err.message);
      }
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

  //------------------------------------- Plugins ------------------------------------------
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

  async getSequenceThumbnail(index) {
    try {
      const { BASE_URL } = getUrls();
      const response = await axios.get(`${BASE_URL}/image/thumbnail/${index}`, {
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

  // api to get filesystem paths for image save path selection in settings
  async getFileDevices(timeout = DEFAULT_TIMEOUT) {
    try {
      const { PLUGINSERVER_URL } = getUrls();
      const response = await axios.get(`${PLUGINSERVER_URL}/api/files/devices`, { timeout });
      return response.data;
    } catch (error) {
      console.error('getFileDevices error:', error);
      return [];
    }
  },

  async listFileDirectories(path, timeout = DEFAULT_TIMEOUT) {
    try {
      const { PLUGINSERVER_URL } = getUrls();
      const response = await axios.get(`${PLUGINSERVER_URL}/api/files/list`, {
        params: { path },
        timeout,
      });
      return response.data;
    } catch (error) {
      console.error('listFileDirectories error:', error);
      throw error;
    }
  },

  async createFileDirectory(path, name, timeout = DEFAULT_TIMEOUT) {
    try {
      const { PLUGINSERVER_URL } = getUrls();
      const response = await axios.post(
        `${PLUGINSERVER_URL}/api/files/create-dir`,
        { path, name },
        { timeout }
      );
      return response.data;
    } catch (error) {
      console.error('createFileDirectory error:', error);
      throw error;
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

  // only in PINS version jm 04.12.2025
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
    filter,
    brightness
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
          filter,
          brightness,
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
    filter,
    exposureTime
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
          filter,
          exposureTime,
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
    filter
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
          filter,
        },
      });
      return response.data;
    } catch (error) {
      // console.error('Error skyflats:', error);
      throw error;
    }
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
