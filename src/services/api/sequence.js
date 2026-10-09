import axios from 'axios';
import { getUrls, rawHttp, simpleGetRequest } from './core';

export default {
  //-------------------------------------  sequence ---------------------------------------
  sequenceAction(action) {
    const { BASE_URL } = getUrls();
    if (action === 'start') {
      return simpleGetRequest(`${BASE_URL}/sequence/start?skipValidation=true`).then(
        (response) => ({
          ...response,
          Response: 'Sequence start',
          Success: true,
        })
      );
    }
    return simpleGetRequest(`${BASE_URL}/sequence/${action}`);
  },

  async fetchSequenceCurrent() {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}sequence/current`);
  },

  // Lightweight poll: { Revision, Running, Items: [{ Id, Status, ...runtime fields }] }.
  // Rejects on HTTP errors (rawHttp) so the caller can detect a plugin without this route.
  async fetchSequenceStatus() {
    const { API_URL } = getUrls();
    const response = await rawHttp.get(`${API_URL}sequence/status`);
    return response.data;
  },

  // Feature detection for the id-based sequence editor (TNS plugin sequence controller).
  // Returns true/false, or null when the backend did not answer and the probe should be
  // repeated. Unknown plugin routes answer with an HTML 404, so only a JSON body counts.
  async probeSequenceEditorSupport() {
    const { API_URL } = getUrls();
    try {
      const { data } = await rawHttp.get(`${API_URL}sequence/status`);
      return typeof data === 'object' && data !== null && 'Revision' in data;
    } catch (error) {
      const status = error?.response?.status;
      if (!status) return null;
      // 400 = endpoint exists, but no sequence is loaded yet
      const body = error.response.data;
      return status === 400 && typeof body === 'object' && body !== null && 'Error' in body;
    }
  },

  async fetchSequenceInfo(id) {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}sequence/info?id=${id}`);
  },

  async fetchSequenceMetadata(id) {
    const { API_URL } = getUrls();
    return simpleGetRequest(`${API_URL}sequence/metadata?id=${id}`);
  },

  // insertAfter null with a container targetId moves into that container (plugin 1.5.0.0+
  // on NINA, 1.2.9.0+ on PINS)
  async sequenceMove(id, targetId, insertAfter = true) {
    const { API_URL } = getUrls();
    const ia = insertAfter === null ? '' : `&insertAfter=${insertAfter}`;
    const response = await axios.post(
      `${API_URL}sequence/move?id=${id}&targetId=${targetId}${ia}`,
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

  // Editable properties of one item: { Fields: [{ Name, Type, Options?, ReadOnly }] }
  async sequenceFetchFields(id) {
    const { API_URL } = getUrls();
    const response = await rawHttp.get(`${API_URL}sequence/fields`, { params: { id } });
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
};
