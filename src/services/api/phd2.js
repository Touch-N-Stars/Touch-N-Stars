import axios from 'axios';
import { getUrls } from './core';

export default {
  //------------------------------------- PHD2 ------------------------------------------
  //https://github.com/acocalypso/N.I.N.A-Plugin-for-Touch-N-Stars/blob/PHD2/PHD2_API_README.md
  // quiet: no error toast when PHD2 is unreachable (background probes, not user actions).
  async connectPHD2({ quiet = false } = {}) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(
        `${API_URL}phd2/connect`,
        {
          instance: 1,
          hostname: 'localhost',
        },
        { suppressErrorToast: quiet }
      );
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

  async getPhd2CurrentImage(gamma) {
    try {
      const { API_URL } = getUrls();
      const params = gamma !== undefined ? `?gamma=${gamma}` : '';
      const response = await axios.get(`${API_URL}phd2/current-image${params}`, {
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
};
