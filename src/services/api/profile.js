import axios from 'axios';
import { getUrls, simpleGetRequest } from './core';
import { markProfileStale } from './profileStaleness';

export default {
  //-------------------------------------  profile ---------------------------------------
  profileAction(action) {
    const { BASE_URL } = getUrls();
    return simpleGetRequest(`${BASE_URL}/profile/${action}`);
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
      console.log('[profileChangeValue]', settingpath, newValue);
      return response.data;
    } catch (error) {
      // console.error('Error switch profil:', error);
      throw error;
    } finally {
      markProfileStale();
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
    } finally {
      markProfileStale();
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
    } finally {
      markProfileStale();
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
    } finally {
      markProfileStale();
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
    } finally {
      markProfileStale();
    }
  },

  async postProfileHorizon(hrzText) {
    try {
      const { PLUGINSERVER_URL } = getUrls();
      const response = await axios.post(`${PLUGINSERVER_URL}/api/profile/horizon`, hrzText, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async getProfileHorizon() {
    const { BASE_URL } = getUrls();
    const response = await axios.get(`${BASE_URL}/profile/horizon`);
    const { Azimuths, Altitudes } = response.data.Response;
    if (!Azimuths || !Altitudes || Azimuths.length === 0) return [];
    return Azimuths.map((az, i) => ({ az, alt: Altitudes[i] }));
  },

  async createStellariumLandscape(formData) {
    try {
      const { PLUGINSERVER_URL } = getUrls();
      const response = await axios.post(
        `${PLUGINSERVER_URL}/api/stellarium/landscape/create`,
        formData,
        {
          responseType: 'blob',
        }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  async listStellariumLandscapes() {
    const { PLUGINSERVER_URL } = getUrls();
    const response = await axios.get(`${PLUGINSERVER_URL}/api/stellarium/landscape/list`);
    return response.data;
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
};
