import axios from 'axios';
import { getUrls } from './core';

// Plugin-server endpoints for the Atlas survey downloads (HipsSurveyController). `survey`
// selects the survey ('dss' or 'nsns'); a plugin from before NSNS ignores it and always
// answers for DSS. A plugin without the controller answers 404, which the global
// interceptor turns into a resolved mock response with `status: 404`; the methods report
// that as `supported: false` instead of throwing so the UI can show an "update the plugin"
// hint.
function isMissingEndpoint(response) {
  return response?.status === 404 || response?.data?.StatusCode === 404;
}

function unwrapSurveyResponse(response) {
  if (isMissingEndpoint(response)) return { success: false, supported: false };
  const data = response?.data;
  if (!data || typeof data !== 'object' || data.Success === false) {
    return { success: false, supported: true, error: data?.Error || 'Request failed' };
  }
  return { supported: true, ...data };
}

export default {
  async getAtlasSurveyStatus(survey = 'dss') {
    const { API_URL } = getUrls();
    const response = await axios.get(`${API_URL}atlas/survey/status`, {
      params: { survey },
      headers: { 'X-Suppress-Toast-404': 'true' },
      validateStatus: (status) => status < 500 || status === 404,
    });
    const result = unwrapSurveyResponse(response);
    // An older plugin answers every status request with DSS and without a `survey` field;
    // for any other survey that means the plugin cannot download it.
    if (survey !== 'dss' && result.success !== false && result.survey !== survey) {
      return { success: false, supported: false };
    }
    return result;
  },

  async startAtlasSurveyDownload(survey, targetOrder) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}atlas/survey/download`, { survey, targetOrder });
    return unwrapSurveyResponse(response);
  },

  async cancelAtlasSurveyDownload(survey) {
    const { API_URL } = getUrls();
    const response = await axios.post(`${API_URL}atlas/survey/cancel`, { survey });
    return unwrapSurveyResponse(response);
  },

  /** keepOrder: null/omitted deletes everything; otherwise only the orders above it. */
  async deleteAtlasSurvey(survey, keepOrder = null) {
    const { API_URL } = getUrls();
    const body = keepOrder === null ? { survey } : { survey, keepOrder };
    const response = await axios.post(`${API_URL}atlas/survey/delete`, body);
    return unwrapSurveyResponse(response);
  },
};
