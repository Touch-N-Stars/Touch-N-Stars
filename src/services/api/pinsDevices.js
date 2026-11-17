import axios from 'axios';
import { DEFAULT_TIMEOUT, getUrls, rawHttp } from './core';

export default {
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

  // --------------------------------- PINS alarm (beeps on the box) ---------------------------------
  // The box beeps the PowerBox by itself on critical events. These calls use rawHttp: they reject
  // with the real status and body, so the caller can tell a plugin without the alarm (HTML 404)
  // from an answer of the alarm API (JSON envelope), and no generic error toast appears.
  async getPinsAlarmSettings() {
    const { API_URL } = getUrls();
    const response = await rawHttp.get(`${API_URL}pins/alarm`, { timeout: DEFAULT_TIMEOUT });
    return response.data;
  },

  // patch: the changed fields only (PascalCase, e.g. { Categories: { Guiding: false } })
  async setPinsAlarmSettings(patch) {
    const { API_URL } = getUrls();
    const response = await rawHttp.put(`${API_URL}pins/alarm`, patch, { timeout: DEFAULT_TIMEOUT });
    return response.data;
  },

  // preview: optional { Volume, ToneMs, PauseMs, BurstSeconds } to test unsaved values
  async testPinsAlarm(preview) {
    const { API_URL } = getUrls();
    const response = await rawHttp.post(`${API_URL}pins/alarm/test`, preview ?? {}, {
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
  },

  // minutes 0 ends a mute; a running burst stops either way
  async silencePinsAlarm(minutes = 30) {
    const { API_URL } = getUrls();
    const response = await rawHttp.post(
      `${API_URL}pins/alarm/silence`,
      { Minutes: minutes },
      { timeout: DEFAULT_TIMEOUT }
    );
    return response.data;
  },

  async getPinsAlarmStatus() {
    const { API_URL } = getUrls();
    const response = await rawHttp.get(`${API_URL}pins/alarm/status`, { timeout: DEFAULT_TIMEOUT });
    return response.data;
  },

  async getPinsAlarmHistory(limit = 20) {
    const { API_URL } = getUrls();
    const response = await rawHttp.get(`${API_URL}pins/alarm/history`, {
      params: { limit },
      timeout: DEFAULT_TIMEOUT,
    });
    return response.data;
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

  async getLensControlInfo() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/lenscontrol`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lenscontrol info:', error);
      throw error;
    }
  },

  async getLensControlStatus() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.get(`${API_URL}pins/lenscontrol/status`);
      return response.data;
    } catch (error) {
      console.error('Error fetching lenscontrol status:', error);
      throw error;
    }
  },

  async moveLensControl(position) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/lenscontrol/move`,
        {},
        { params: { position } }
      );
      return response.data;
    } catch (error) {
      console.error('Error moving lenscontrol:', error);
      throw error;
    }
  },

  async haltLensControl() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(`${API_URL}pins/lenscontrol/halt`, {});
      return response.data;
    } catch (error) {
      console.error('Error halting lenscontrol:', error);
      throw error;
    }
  },

  async setLensControlAperture(aperture) {
    try {
      const { API_URL } = getUrls();
      const response = await axios.put(
        `${API_URL}pins/lenscontrol/set-aperture`,
        {},
        { params: { aperture } }
      );
      return response.data;
    } catch (error) {
      console.error('Error setting lenscontrol aperture:', error);
      throw error;
    }
  },

  async calibrateLensControl() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}pins/lenscontrol/calibrate`, {});
      return response.data;
    } catch (error) {
      console.error('Error calibrating lenscontrol:', error);
      throw error;
    }
  },

  async restartLensControl() {
    try {
      const { API_URL } = getUrls();
      const response = await axios.post(`${API_URL}pins/lenscontrol/restart`, {});
      return response.data;
    } catch (error) {
      console.error('Error restarting lenscontrol:', error);
      throw error;
    }
  },
};
