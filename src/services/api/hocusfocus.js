import axios from 'axios';
import { getUrls } from './core';

export default {
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
        return {
          options: response.data?.Options || {},
          enumOptions: response.data?.EnumOptions || {},
        };
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
        return {
          options: response.data?.Options || {},
          enumOptions: response.data?.EnumOptions || {},
        };
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
      dontOffsetToZero,
      screwCount,
      shiftToNonNegative
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

        // Include screw count if provided (3-screw or 4-screw plate)
        if (screwCount !== undefined && screwCount !== null) {
          requestBody.screwCount = screwCount;
        }

        // Include shiftToNonNegative if provided (report travel from fully seated screws)
        if (shiftToNonNegative !== undefined && shiftToNonNegative !== null) {
          requestBody.shiftToNonNegative = shiftToNonNegative;
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
};
