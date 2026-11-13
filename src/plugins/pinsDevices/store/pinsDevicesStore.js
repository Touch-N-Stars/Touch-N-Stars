import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { createPoller } from '@/utils/poller';

export const usePinsDeviceStore = defineStore('pinsDevices', {
  state: () => ({
    devices: {
      powerBox: 'not connected',
      meteoStation: 'not connected',
      lensControl: 'not connected',
    },
    powerboxInfo: {
      Name: '',
      Id: '',
      Connected: false,
      Firmware: '',
      DriverVersion: '',
      PowerPorts: 0,
      USBPorts: 0,
      DewPorts: 0,
      BuckPorts: 0,
      PWMPorts: 0,
    },
    powerboxStatus: {
      CoreTemp: 0,
      Temperature: 0,
      Humidity: 0,
      DewPoint: 0,
      UpTime: '',
      ExtSensor: false,
      HasWifi: false,
      UpdateRate: 1,
      EnvUpdateRate: 1,
      TemperatureOffset: 0,
      HumidityOffset: 0,
      Rail12V: 0,
      Rail12A: 0,
      Rail12W: 0,
      Rail5V: 0,
      Rail5A: 0,
      Rail5W: 0,
      AverageAmps: 0,
      AmpsPerHour: 0,
      WattsPerHour: 0,
    },
    powerPorts: {
      MaxPorts: 0,
      Ports: [],
    },
    usbPorts: {
      MaxPorts: 0,
      Ports: [],
    },
    dewPorts: {
      MaxPorts: 0,
      Ports: [],
    },
    buckPorts: {
      MaxPorts: 0,
      Ports: [],
    },
    pwmPorts: {
      MaxPorts: 0,
      Ports: [],
    },
    wifiInfo: {
      SSID: '',
      IPAddress: '',
      HostName: '',
      Mode: '',
      RSSI: 0,
      Channel: 0,
    },
    meteoStationInfo: {
      Name: '',
      DisplayName: '',
      Id: '',
      Firmware: '',
      DriverVersion: '',
      DriverInfo: '',
      Description: '',
      Connected: false,
    },
    meteoStationStatus: {
      Connected: false,
      Temperature: 0,
      Humidity: 0,
      DewPoint: 0,
      SkyBrightness: 0,
      SkyQuality: 0,
      SkyTemperature: 0,
      CloudCover: 0,
      UpTime: '',
      EnvUpdateRate: 1,
      TemperatureOffset: 0,
      HumidityOffset: 0,
    },
    lensControlInfo: {
      Name: '',
      DisplayName: '',
      Id: '',
      UniqueId: '',
      Firmware: '',
      DriverVersion: '',
      Connected: false,
      LensName: '',
      FocalLength: 0,
      Position: 0,
      MaxStep: 0,
      Aperture: 0,
      MinAperture: 0,
      MaxAperture: 0,
    },
    lensControlStatus: {
      Connected: false,
      LensName: '',
      FocalLength: 0,
      Position: 0,
      MaxStep: 0,
      IsMoving: false,
      Aperture: 0,
      MinAperture: 0,
      MaxAperture: 0,
    },
    isWiFiConnecting: false,
    isLoading: false,
    error: null,
    pollingInterval: null,
    isPolling: false,
  }),

  getters: {
    isPowerboxConnected: (state) => state.devices.powerBox !== 'not connected',
    isMeteostationConnected: (state) => state.devices.meteoStation !== 'not connected',
    isLensControlConnected: (state) => state.devices.lensControl !== 'not connected',
    isAnyDeviceConnected: (state) =>
      state.devices.powerBox !== 'not connected' ||
      state.devices.meteoStation !== 'not connected' ||
      state.devices.lensControl !== 'not connected',
  },

  actions: {
    async fetchDevices() {
      this.isLoading = true;
      this.error = null;
      try {
        const response = await apiService.getPinsDevices();
        if (response.Success) {
          this.devices = response.Response;
        } else {
          this.error = response.Error || 'Failed to fetch devices';
        }
      } catch (error) {
        console.error('Error fetching PINS devices:', error);
        this.error = error.message;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchPowerboxInfo() {
      this.isLoading = true;
      this.error = null;
      try {
        const response = await apiService.getPinsDevicePowerbox();
        if (response.Success) {
          this.powerboxInfo = response.Response;
        } else {
          this.error = response.Error || 'Failed to fetch powerbox info';
        }
      } catch (error) {
        console.error('Error fetching powerbox info:', error);
        this.error = error.message;
      } finally {
        this.isLoading = false;
      }
    },

    async fetchPowerboxStatus() {
      try {
        const response = await apiService.getPinsDevicePowerboxStatus();
        if (response.Success) {
          this.powerboxStatus = response.Response;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async fetchPowerPorts() {
      try {
        const response = await apiService.getPinsDevicePowerPorts();
        if (response.Success) {
          this.powerPorts = response.Response;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async setPowerPortState(portIndex, enabled) {
      try {
        const response = await apiService.setPinsDevicePowerPortState(portIndex, enabled);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIndex = this.powerPorts.Ports.findIndex(
            (p) => p.Index === response.Response.Index
          );
          if (portIndex !== -1) {
            this.powerPorts.Ports[portIndex] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set power port state';
          return false;
        }
      } catch (error) {
        console.error('Error setting power port state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setPowerPortName(portIndex, name) {
      try {
        const response = await apiService.setPinsDevicePowerPortName(portIndex, name);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIdx = this.powerPorts.Ports.findIndex(
            (p) => p.Index === response.Response.Index
          );
          if (portIdx !== -1) {
            this.powerPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set power port name';
          return false;
        }
      } catch (error) {
        console.error('Error setting power port name:', error);
        this.error = error.message;
        return false;
      }
    },

    async setPowerPortBootState(portIndex, bootState) {
      try {
        const response = await apiService.setPinsDevicePowerPortBootState(portIndex, bootState);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIdx = this.powerPorts.Ports.findIndex(
            (p) => p.Index === response.Response.Index
          );
          if (portIdx !== -1) {
            this.powerPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set power port boot state';
          return false;
        }
      } catch (error) {
        console.error('Error setting power port boot state:', error);
        this.error = error.message;
        return false;
      }
    },

    async fetchUsbPorts() {
      try {
        const response = await apiService.getPinsDeviceUsbPorts();
        if (response.Success) {
          this.usbPorts = response.Response;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async setUsbPortState(portIndex, enabled) {
      try {
        const response = await apiService.setPinsDeviceUsbPortState(portIndex, enabled);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIdx = this.usbPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.usbPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set USB port state';
          return false;
        }
      } catch (error) {
        console.error('Error setting USB port state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setUsbPortName(portIndex, name) {
      try {
        const response = await apiService.setPinsDeviceUsbPortName(portIndex, name);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIdx = this.usbPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.usbPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set USB port name';
          return false;
        }
      } catch (error) {
        console.error('Error setting USB port name:', error);
        this.error = error.message;
        return false;
      }
    },

    async setUsbPortBootState(portIndex, bootState) {
      try {
        const response = await apiService.setPinsDeviceUsbPortBootState(portIndex, bootState);
        if (response.Success && response.Response) {
          // Update the port with the full returned port info from the backend
          const portIdx = this.usbPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.usbPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set USB port boot state';
          return false;
        }
      } catch (error) {
        console.error('Error setting USB port boot state:', error);
        this.error = error.message;
        return false;
      }
    },

    async fetchDewPorts() {
      try {
        const response = await apiService.getPinsDeviceDewPorts();
        if (response.Success) {
          this.dewPorts = response.Response;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async setDewPortState(portIndex, enabled) {
      try {
        const response = await apiService.setPinsDeviceDewPortState(portIndex, enabled);
        if (response.Success && response.Response) {
          const portIdx = this.dewPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.dewPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set dew port state';
          return false;
        }
      } catch (error) {
        console.error('Error setting dew port state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setDewPortName(portIndex, name) {
      try {
        const response = await apiService.setPinsDeviceDewPortName(portIndex, name);
        if (response.Success && response.Response) {
          const portIdx = this.dewPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.dewPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set dew port name';
          return false;
        }
      } catch (error) {
        console.error('Error setting dew port name:', error);
        this.error = error.message;
        return false;
      }
    },

    async setDewPortAutoMode(portIndex, automode) {
      try {
        const response = await apiService.setPinsDeviceDewPortAutoMode(portIndex, automode);
        if (response.Success && response.Response) {
          const portIdx = this.dewPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.dewPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set dew port auto mode';
          return false;
        }
      } catch (error) {
        console.error('Error setting dew port auto mode:', error);
        this.error = error.message;
        return false;
      }
    },

    async setDewPortAutoThreshold(portIndex, autothreshold) {
      try {
        const response = await apiService.setPinsDeviceDewPortAutoThreshold(
          portIndex,
          autothreshold
        );
        if (response.Success && response.Response) {
          const portIdx = this.dewPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.dewPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set dew port auto threshold';
          return false;
        }
      } catch (error) {
        console.error('Error setting dew port auto threshold:', error);
        this.error = error.message;
        return false;
      }
    },

    async setDewPortPowerLevel(portIndex, powerlevel) {
      try {
        const response = await apiService.setPinsDeviceDewPortPowerLevel(portIndex, powerlevel);
        if (response.Success && response.Response) {
          const portIdx = this.dewPorts.Ports.findIndex((p) => p.Index === response.Response.Index);
          if (portIdx !== -1) {
            this.dewPorts.Ports[portIdx] = response.Response;
          }
          return true;
        } else {
          this.error = response.Error || 'Failed to set dew port power level';
          return false;
        }
      } catch (error) {
        console.error('Error setting dew port power level:', error);
        this.error = error.message;
        return false;
      }
    },

    async fetchBuckPorts() {
      try {
        const response = await apiService.getPinsDeviceBuckPorts();
        if (response.Success) {
          // Buck ports returns a single port as Response
          this.buckPorts.Ports = response.Response ? [response.Response] : [];
          this.buckPorts.MaxPorts = response.Response ? 1 : 0;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async setBuckPortState(enabled) {
      try {
        const response = await apiService.setPinsDeviceBuckPortState(enabled);
        if (response.Success && response.Response) {
          this.buckPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set buck port state';
          return false;
        }
      } catch (error) {
        console.error('Error setting buck port state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setBuckPortName(name) {
      try {
        const response = await apiService.setPinsDeviceBuckPortName(name);
        if (response.Success && response.Response) {
          this.buckPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set buck port name';
          return false;
        }
      } catch (error) {
        console.error('Error setting buck port name:', error);
        this.error = error.message;
        return false;
      }
    },

    async setBuckPortBootState(bootstate) {
      try {
        const response = await apiService.setPinsDeviceBuckPortBootState(bootstate);
        if (response.Success && response.Response) {
          this.buckPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set buck port boot state';
          return false;
        }
      } catch (error) {
        console.error('Error setting buck port boot state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setBuckPortVoltage(voltage) {
      try {
        const response = await apiService.setPinsDeviceBuckPortVoltage(voltage);
        if (response.Success && response.Response) {
          this.buckPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set buck port voltage';
          return false;
        }
      } catch (error) {
        console.error('Error setting buck port voltage:', error);
        this.error = error.message;
        return false;
      }
    },

    async fetchPwmPorts() {
      try {
        const response = await apiService.getPinsDevicePwmPorts();
        if (response.Success) {
          // PWM ports returns a single port as Response
          this.pwmPorts.Ports = response.Response ? [response.Response] : [];
          this.pwmPorts.MaxPorts = response.Response ? 1 : 0;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async setPwmPortState(enabled) {
      try {
        const response = await apiService.setPinsDevicePwmPortState(enabled);
        if (response.Success && response.Response) {
          this.pwmPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set PWM port state';
          return false;
        }
      } catch (error) {
        console.error('Error setting PWM port state:', error);
        this.error = error.message;
        return false;
      }
    },

    async setPwmPortName(name) {
      try {
        const response = await apiService.setPinsDevicePwmPortName(name);
        if (response.Success && response.Response) {
          this.pwmPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set PWM port name';
          return false;
        }
      } catch (error) {
        console.error('Error setting PWM port name:', error);
        this.error = error.message;
        return false;
      }
    },

    async setPwmPortPower(power) {
      try {
        const response = await apiService.setPinsDevicePwmPortPower(power);
        if (response.Success && response.Response) {
          this.pwmPorts.Ports = [response.Response];
          return true;
        } else {
          this.error = response.Error || 'Failed to set PWM port power';
          return false;
        }
      } catch (error) {
        console.error('Error setting PWM port power:', error);
        this.error = error.message;
        return false;
      }
    },

    async loadAllData() {
      await this.fetchDevices();
      if (this.isPowerboxConnected) {
        await this.fetchPowerboxInfo();
        await this.fetchPowerboxStatus();
        await this.fetchPowerPorts();
        await this.fetchUsbPorts();
        await this.fetchDewPorts();
        await this.fetchBuckPorts();
        await this.fetchPwmPorts();
      }
      if (this.isMeteostationConnected) {
        await this.fetchMeteoStationInfo();
        await this.fetchMeteoStationStatus();
      }
      if (this.isLensControlConnected) {
        await this.fetchLensControlInfo();
        await this.fetchLensControlStatus();
      }
    },

    async pollConnectedDevices() {
      if (this.isPowerboxConnected) {
        await this.fetchPowerboxStatus();
        await this.fetchPowerPorts();
        await this.fetchUsbPorts();
        await this.fetchDewPorts();
        await this.fetchBuckPorts();
        await this.fetchPwmPorts();
      }
      if (this.isMeteostationConnected) {
        await this.fetchMeteoStationStatus();
      }
      if (this.isLensControlConnected) {
        await this.fetchLensControlStatus();
      }
    },

    async startPolling(intervalMs = 1000) {
      if (this.isPolling) {
        console.warn('Polling already started');
        return;
      }

      this.isPolling = true;

      await this.fetchDevices();
      await this.pollConnectedDevices();

      // stopPolling() may have run during the awaits above (e.g. app backgrounded
      // mid-initialization). Bail out instead of starting an interval that
      // stopPolling already cleared - otherwise it would poll on forever.
      if (!this.isPolling) {
        return;
      }

      this.pollingInterval = createPoller(() => this.pollConnectedDevices(), intervalMs);
      this.pollingInterval.start();
    },

    stopPolling() {
      this.pollingInterval?.stop();
      this.pollingInterval = null;
      this.isPolling = false;
    },

    isFetchingDevices() {
      return this.isPolling;
    },

    resetError() {
      this.error = null;
    },

    async setTemperatureOffset(offset) {
      try {
        const response = await apiService.setPinsDeviceTemperatureOffset(offset);
        if (response.Success && response.Response) {
          this.powerboxStatus.Temperature = response.Response.Temperature;
          return true;
        } else {
          this.error = response.Error || 'Failed to set temperature offset';
          return false;
        }
      } catch (error) {
        console.error('Error setting temperature offset:', error);
        this.error = error.message;
        return false;
      }
    },

    async setHumidityOffset(offset) {
      try {
        const response = await apiService.setPinsDeviceHumidityOffset(offset);
        if (response.Success && response.Response) {
          this.powerboxStatus.Humidity = response.Response.Humidity;
          return true;
        } else {
          this.error = response.Error || 'Failed to set humidity offset';
          return false;
        }
      } catch (error) {
        console.error('Error setting humidity offset:', error);
        this.error = error.message;
        return false;
      }
    },

    async setEnvUpdateRate(updateRate) {
      try {
        const response = await apiService.setPinsDeviceEnvUpdateRate(updateRate);
        if (response.Success && response.Response) {
          this.powerboxStatus.EnvUpdateRate = response.Response.EnvUpdateRate;
          return true;
        } else {
          this.error = response.Error || 'Failed to set environment update rate';
          return false;
        }
      } catch (error) {
        console.error('Error setting environment update rate:', error);
        this.error = error.message;
        return false;
      }
    },

    async setUpdateRate(updateRate) {
      try {
        const response = await apiService.setPinsDeviceUpdateRate(updateRate);
        if (response.Success && response.Response) {
          this.powerboxStatus.UpdateRate = response.Response.UpdateRate;
          return true;
        } else {
          this.error = response.Error || 'Failed to set update rate';
          return false;
        }
      } catch (error) {
        console.error('Error setting update rate:', error);
        this.error = error.message;
        return false;
      }
    },

    async factoryReset() {
      try {
        const response = await apiService.factoryResetPinsDevice();
        if (response.Success) {
          return true;
        } else {
          this.error = response.Error || 'Failed to perform factory reset';
          return false;
        }
      } catch (error) {
        console.error('Error performing factory reset:', error);
        this.error = error.message;
        return false;
      }
    },

    async setMeteoStationTemperatureOffset(offset) {
      try {
        const response = await apiService.setMeteoStationTemperatureOffset(offset);
        if (response.Success && response.Response) {
          this.meteoStationStatus.Temperature = response.Response.Temperature;
          return true;
        } else {
          this.error = response.Error || 'Failed to set temperature offset';
          return false;
        }
      } catch (error) {
        console.error('Error setting temperature offset:', error);
        this.error = error.message;
        return false;
      }
    },

    async setMeteoStationHumidityOffset(offset) {
      try {
        const response = await apiService.setMeteoStationHumidityOffset(offset);
        if (response.Success && response.Response) {
          this.meteoStationStatus.Humidity = response.Response.Humidity;
          return true;
        } else {
          this.error = response.Error || 'Failed to set humidity offset';
          return false;
        }
      } catch (error) {
        console.error('Error setting humidity offset:', error);
        this.error = error.message;
        return false;
      }
    },

    async setMeteoStationUpdateRate(updateRate) {
      try {
        const response = await apiService.setMeteoStationUpdateRate(updateRate);
        if (response.Success && response.Response) {
          this.meteoStationStatus.UpdateRate = response.Response.UpdateRate;
          return true;
        } else {
          this.error = response.Error || 'Failed to set update rate';
          return false;
        }
      } catch (error) {
        console.error('Error setting update rate:', error);
        this.error = error.message;
        return false;
      }
    },

    async factoryResetMeteoStation() {
      try {
        const response = await apiService.factoryResetMeteoStation();
        if (response.Success) {
          return true;
        } else {
          this.error = response.Error || 'Failed to perform factory reset';
          return false;
        }
      } catch (error) {
        console.error('Error performing factory reset:', error);
        this.error = error.message;
        return false;
      }
    },

    async fetchWiFiInfo() {
      try {
        const response = await apiService.getPinsDeviceWiFi();
        if (response.Success) {
          this.wifiInfo = response.Response;
          this.error = null;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async connectWiFiAP(ssid, password) {
      this.isWiFiConnecting = true;
      this.error = null;
      try {
        const response = await apiService.connectPinsDeviceWiFiAP(ssid, password);
        if (response.Success) {
          await this.fetchWiFiInfo();
          return true;
        } else {
          this.error = response.Error || 'Failed to create WiFi hotspot';
          return false;
        }
      } catch (error) {
        console.error('Error creating WiFi AP:', error);
        this.error = error.message;
        return false;
      } finally {
        this.isWiFiConnecting = false;
      }
    },

    async fetchMeteoStationInfo() {
      try {
        const response = await apiService.getMeteoStationInfo();
        if (response.Success) {
          this.meteoStationInfo = response.Response;
          this.error = null;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async fetchMeteoStationStatus() {
      try {
        const response = await apiService.getMeteoStationStatus();
        if (response.Success) {
          this.meteoStationStatus = response.Response;
          this.error = null;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async fetchLensControlInfo() {
      try {
        const response = await apiService.getLensControlInfo();
        if (response.Success) {
          this.lensControlInfo = response.Response;
          this.error = null;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async fetchLensControlStatus() {
      try {
        const response = await apiService.getLensControlStatus();
        if (response.Success) {
          this.lensControlStatus = response.Response;
          this.error = null;
        }
      } catch (error) {
        // Silent fail - device may have disconnected
      }
    },

    async moveLensControl(position) {
      try {
        const response = await apiService.moveLensControl(position);
        return response.Success;
      } catch (error) {
        console.error('Error moving lenscontrol:', error);
        this.error = error.message;
        return false;
      }
    },

    async haltLensControl() {
      try {
        const response = await apiService.haltLensControl();
        if (response.Success && response.Response) {
          this.lensControlStatus.Position = response.Response.Position;
          this.lensControlStatus.IsMoving = false;
        }
        return response.Success;
      } catch (error) {
        console.error('Error halting lenscontrol:', error);
        this.error = error.message;
        return false;
      }
    },

    async setLensControlAperture(aperture) {
      try {
        const response = await apiService.setLensControlAperture(aperture);
        if (response.Success && response.Response) {
          this.lensControlStatus.Aperture = response.Response.Aperture;
        }
        return response.Success;
      } catch (error) {
        console.error('Error setting lenscontrol aperture:', error);
        this.error = error.message;
        return false;
      }
    },

    async calibrateLensControl() {
      try {
        const response = await apiService.calibrateLensControl();
        return response.Success;
      } catch (error) {
        console.error('Error calibrating lenscontrol:', error);
        this.error = error.message;
        return false;
      }
    },

    async restartLensControl() {
      try {
        const response = await apiService.restartLensControl();
        return response.Success;
      } catch (error) {
        console.error('Error restarting lenscontrol:', error);
        this.error = error.message;
        return false;
      }
    },
  },
});
