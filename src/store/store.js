import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useToastStore } from '@/store/toastStore';
import websocketChannelService from '@/services/websocketChannelSocket';

export const apiStore = defineStore('store', {
  state: () => ({
    apiPort: null,
    intervalId: null,
    intervalIdGraph: null,
    profileInfo: [],
    cameraInfo: { IsExposing: false },
    mountInfo: [],
    filterInfo: [],
    focuserInfo: [],
    rotatorInfo: [],
    focuserAfInfo: {},
    afTimestampLastStart: null,
    afCurveData: [],
    guiderInfo: [],
    flatdeviceInfo: [],
    domeInfo: [],
    safetyInfo: {
      Connected: false,
      IsSafe: false,
    },
    switchInfo: [],
    weatherInfo: [],
    attemptsToConnect: 0,
    isBackendReachable: false,
    isWebSocketConnected: false,
    isTnsPluginConnected: false,
    isApiConnected: false,
    isApiVersionNewerOrEqual: false,
    isTnsPluginVersionNewerOrEqual: false,
    webSocketDisconnectTime: null,
    webSocketTimeoutId: null,
    filterName: 'unbekannt',
    filterNr: null,
    showAfGraph: true,
    imageData: null,
    isLoadingImage: false,
    captureRunning: false,
    rotatorMechanicalPosition: 0,
    existingEquipmentList: [],
    coordinates: null,
    currentLanguage: 'en',
    showSettings: false,
    showFocuser: false,
    showMount: false,
    showStellarium: false,
    minimumApiVersion: '2.2.9.0',
    minimumTnsPluginVersion: '1.1.1.0',
    currentApiVersion: null,
    currentTnsPluginVersion: null,
    isApiVersionNewerOrEqual: false,
    isTnsPluginVersionNewerOrEqual: false,
    mount: {
      currentTab: 'showMount',
    },
    closeErrorModal: false,
    errorMessageShown: false,
    connectingAttempts: 2,
    setupCheckConnectionDone: false,
    pageReturnedFromBackground: false,
    pageReturnTime: null,
    isRedirecting: false,
    isImageFetching: false,
    backendReachableTimeoutId: null,
  }),

  actions: {
    async fetchAllInfos(t) {
      const toastStore = useToastStore();

      const tryWithRetry = async (fn, retries = 1, delay = 2000) => {
        let result = null;
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            result = await fn();
            //console.log(fn, 'Attempt', attempt);
            if (result) break;
          } catch (e) {
            // ignore error, continue retrying
          }
          if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, delay));
        }
        return result;
      };

      if (!this.isBackendReachable) this.closeErrorModal = false;

      try {
        //const tnsVersionResponse = await apiService.fetchTnsPluginVersion(); //Check if Plugin is reachable
        const tnsVersionResponse = await tryWithRetry(
          () => apiService.fetchTnsPluginVersion(),
          this.connectingAttempts
        );
        if (!tnsVersionResponse) {
          console.warn('TNS-Plugin not reachable');
          if (!this.errorMessageShown) {
            toastStore.showToast({
              type: 'error',
              title: t('app.connection_error_toast.title'),
              message: t('app.connection_error_toast.message_tns'),
              autoClose: false,
            });
          }
          this.isTnsPluginConnected = false;
          this.clearAllStates();
          return;
        } else {
          this.isTnsPluginConnected = true;
          //console.log('TNS Plugin reachable');
          //Check the plugin version
          if (!this.isTnsPluginVersionNewerOrEqual) {
            this.currentTnsPluginVersion = tnsVersionResponse.version;
            this.isTnsPluginVersionNewerOrEqual = this.checkVersionNewerOrEqual(
              this.currentTnsPluginVersion,
              this.minimumTnsPluginVersion
            );
            if (!this.isTnsPluginVersionNewerOrEqual) {
              console.warn('TNS version incompatible', this.currentTnsPluginVersion);
              if (!this.errorMessageShown) {
                toastStore.showToast({
                  type: 'error',
                  title: t('app.connection_error_toast.title'),
                  message: t('app.connection_error_toast.message_tns_version'),
                  autoClose: false,
                });
              }
              this.clearAllStates();
              this.isTnsPluginVersionNewerOrEqual = false;
              return;
            }
            this.isTnsPluginVersionNewerOrEqual = true;
            console.log('TNS Plugin Version:', this.currentTnsPluginVersion);
          }
        }

        if (!this.apiPort) {
          //fetch API Port
          //const response = await apiService.fetchApiPort();
          const response = await tryWithRetry(
            () => apiService.fetchApiPort(),
            this.connectingAttempts
          );
          //console.log('API Port response:', response);
          if (!response) {
            console.error('API not reachable');
            if (!this.errorMessageShown) {
              toastStore.showToast({
                type: 'error',
                title: t('app.connection_error_toast.title'),
                message: t('app.connection_error_toast.message_api'),
                autoClose: false,
              });
            }
            this.isApiConnected = false;
            this.apiPort = null;
            this.clearAllStates();
            return;
          }
          if (response.data === -1) {
            console.error('API not reachable');
            if (!this.errorMessageShown) {
              toastStore.showToast({
                type: 'error',
                title: t('app.connection_error_toast.title'),
                message: t('app.connection_error_toast.message_api'),
                autoClose: false,
              });
            }
            this.isApiConnected = false;
            this.apiPort = null;
            this.clearAllStates();
            return;
          }
          this.apiPort = response.data;
          console.log('api Port:', this.apiPort);
          this.isApiConnected = true;
        }

        if (this.isApiConnected) {
          //const responseApoVersion = await apiService.fetchApiVersion();
          const responseApiVersion = await tryWithRetry(
            () => apiService.fetchApiVersion(),
            this.connectingAttempts
          );
          //console.log('API Version response:', responseApiVersion);
          if (!responseApiVersion) {
            console.warn('API-Plugin not reachable');
            if (!this.errorMessageShown) {
              toastStore.showToast({
                type: 'error',
                title: t('app.connection_error_toast.title'),
                message: t('app.connection_error_toast.message_api'),
                autoClose: false,
              });
            }
            this.clearAllStates();
            this.isApiConnected = false;
            this.apiPort = null;
            return;
          } else {
            this.isApiConnected = true;
            //Check the API version
            if (!this.isApiVersionNewerOrEqual) {
              const apiVersionResponse = await apiService.fetchApiVersion();
              this.currentApiVersion = apiVersionResponse.Response;

              this.isApiVersionNewerOrEqual = this.checkVersionNewerOrEqual(
                this.currentApiVersion,
                this.minimumApiVersion
              );

              if (!this.isApiVersionNewerOrEqual) {
                console.warn('API version incompatible', this.currentApiVersion);
                if (!this.errorMessageShown) {
                  toastStore.showToast({
                    type: 'error',
                    title: t('app.connection_error_toast.title'),
                    message: t('app.connection_error_toast.message_api_version'),
                    autoClose: false,
                  });
                }
                this.clearAllStates();
                this.isApiVersionNewerOrEqual = false;
                return;
              }
              console.log('API Version:', this.currentApiVersion);
              this.isApiVersionNewerOrEqual = true;
            }
          }
        }

        /*console.log('API und TNS Plugin reachable');
        console.log(
          'Api connected',
          this.isApiConnected,
          'TNS connected',
          this.isTnsPluginConnected
        );
        console.log(
          'Api version ok',
          this.isApiVersionNewerOrEqual,
          'TNS version ok',
          this.isTnsPluginVersionNewerOrEqual
        );*/

        // Automatisch Channel WebSocket verbinden wenn Backend erreichbar ist
        if (!websocketChannelService.isWebSocketConnected()) {
          // Setup message callback für IMAGE-PREPARED handling
          websocketChannelService.setMessageCallback((message) => {
            //console.log('Channel WebSocket Message:', message);
            this.handleWebSocketMessage(message);
          });

          // Versuche WebSocket zu verbinden (max 500ms warten)
          try {
            await websocketChannelService.connect(500);
            this.isWebSocketConnected = true;
          } catch (error) {
            // WebSocket fehlgeschlagen oder Timeout - nicht kritisch, App läuft weiter
            console.warn('WebSocket connection failed or timeout:', error.message);
            this.isWebSocketConnected = false;
          }
        } else {
          this.isWebSocketConnected = true;
        }

        // If all conditions are met, mark backend as reachable
        if (
          this.isApiConnected &&
          this.isTnsPluginConnected &&
          this.isApiVersionNewerOrEqual &&
          this.isTnsPluginVersionNewerOrEqual &&
          this.isWebSocketConnected
        ) {
          this.isBackendReachable = true;
          this.attemptsToConnect = 0;
          //console.log('Backend is reachable', new Date().toLocaleTimeString());
        } else if (this.attemptsToConnect < 5) {
          this.attemptsToConnect += 1;
          console.log(
            'Backend not reachable, attempt',
            this.attemptsToConnect,
            new Date().toLocaleTimeString()
          );
        } else {
          this.clearAllStates();
          toastStore.showToast({
            type: 'error',
            title: t('app.connection_error_toast.title'),
            message: t('app.connection_error_toast.message_api'),
            autoClose: false,
          });
          console.warn(
            'Backend not reachable after multiple attempts, clearing states',
            new Date().toLocaleTimeString()
          );
        }

        const [
          imageHistoryResponse,
          cameraResponse,
          mountResponse,
          filterResponse,
          rotatorResponse,
          focuserResponse,
          focuserAfResponse,
          guiderResponse,
          flatdeviceResponse,
          domeResponse,
          safetyResponse,
          weatherResponse,
          switchResponse,
        ] = await Promise.all([
          apiService.imageHistoryAll(),
          apiService.cameraAction('info'),
          apiService.mountAction('info'),
          apiService.filterAction('info'),
          apiService.rotatorAction('info'),
          apiService.focusAction('info'),
          apiService.focuserAfAction('info'),
          apiService.guiderAction('info'),
          apiService.flatdeviceAction('info'),
          apiService.domeAction('info'),
          apiService.safetyAction('info'),
          apiService.weatherAction('info'),
          apiService.switchAction('info'),
        ]);

        this.handleApiResponses({
          imageHistoryResponse,
          cameraResponse,
          mountResponse,
          filterResponse,
          rotatorResponse,
          focuserResponse,
          focuserAfResponse,
          guiderResponse,
          flatdeviceResponse,
          domeResponse,
          safetyResponse,
          weatherResponse,
          switchResponse,
        });
      } catch (error) {
        console.error('Error fetching information:', error);
      }
      await this.fetchProfilInfos();
      //when the backend is accessible again close modal
      if (this.isBackendReachable && !this.closeErrorModal) {
        this.closeErrorModal = true;
        console.log('Backend is reachable');
        toastStore.newMessage = false;
        this.errorMessageShown = false;
      }
    },

    clearAllStates() {
      this.isBackendReachable = false;
      this.errorMessageShown = true;
      //this.apiPort = null;

      // Channel WebSocket disconnecten wenn Backend nicht erreichbar
      if (websocketChannelService.isWebSocketConnected()) {
        websocketChannelService.disconnect();
      }
    },

    handleApiResponses({
      imageHistoryResponse,
      cameraResponse,
      mountResponse,
      filterResponse,
      rotatorResponse,
      focuserResponse,
      focuserAfResponse,
      guiderResponse,
      flatdeviceResponse,
      domeResponse,
      safetyResponse,
      weatherResponse,
      switchResponse,
    }) {
      if (imageHistoryResponse.Success) {
        this.imageHistoryInfo = imageHistoryResponse.Response;
      }

      if (cameraResponse.Success) {
        this.cameraInfo = cameraResponse.Response;
      } else {
        console.error('Error in camera API response:', cameraResponse.Error);
      }

      if (mountResponse.Success) {
        this.mountInfo = mountResponse.Response;
      } else {
        console.error('Error in mount API response:', mountResponse.Error);
      }

      if (filterResponse.Success) {
        this.filterInfo = filterResponse.Response;
      } else {
        console.error('Error in filter API response:', filterResponse.Error);
      }

      if (rotatorResponse.Success) {
        this.rotatorInfo = rotatorResponse.Response;
      } else {
        console.error('Error in rotator API response:', rotatorResponse.Error);
      }

      if (focuserResponse.Success) {
        this.focuserInfo = focuserResponse.Response;
      } else {
        console.error('Error in focuser API response:', focuserResponse.Error);
      }

      if (focuserAfResponse.Success) {
        this.focuserAfInfo = focuserAfResponse;
      } else {
        console.error('Error in focuser AF API response:', focuserAfResponse.Error);
      }

      if (safetyResponse.Success) {
        this.safetyInfo = safetyResponse.Response;
      } else {
        console.error('Error in safety API response:', safetyResponse.Error);
      }

      if (guiderResponse.Success) {
        this.guiderInfo = guiderResponse.Response;
      } else {
        console.error('Error in guider API response:', guiderResponse.Error);
      }

      if (flatdeviceResponse.Success) {
        this.flatdeviceInfo = flatdeviceResponse.Response;
      } else {
        console.error('Error in flat device API response:', flatdeviceResponse.Error);
      }

      if (domeResponse.Success) {
        this.domeInfo = domeResponse.Response;
      } else {
        console.error('Error in dome API response:', domeResponse.Error);
      }

      if (weatherResponse.Success) {
        this.weatherInfo = weatherResponse.Response;
      } else {
        console.error('Error in weather API response:', weatherResponse.Error);
      }

      if (switchResponse.Success) {
        this.switchInfo = switchResponse.Response;
      } else {
        console.error('Error in switch API response:', switchResponse.Error);
      }
    },

    startFetchingInfo(t) {
      if (!this.intervalId) {
        this.attemptsToConnect = 0;
        this.intervalId = setInterval(() => {
          this.fetchAllInfos(t);
        }, 2000);
        console.log('Started fetching info interval');
      }
    },

    stopFetchingInfo() {
      if (this.intervalId) {
        this.attemptsToConnect = 0;
        clearInterval(this.intervalId);
        this.intervalId = null;
        websocketChannelService.disconnect();
        console.log('Stopped fetching info interval');
      }
    },

    async getGuiderInfo() {
      try {
        const response = await apiService.guiderAction('info');
        if (response.Success) {
          this.guiderInfo = response.Response;
        }
      } catch (error) {
        console.error('Error fetching guider info:', error);
      }
    },

    async fetchProfilInfos() {
      try {
        const profileInfoResponse = await apiService.profileAction('show?active=true');

        if (profileInfoResponse && profileInfoResponse.Response) {
          this.profileInfo = profileInfoResponse.Response;
          this.getExistingEquipment(this.profileInfo);
        } else {
          console.error('Error in profile API response:', profileInfoResponse?.Error);
        }
      } catch (error) {
        console.error('Error fetching profile information:', error);
      }
    },

    getExistingEquipment(activeProfile) {
      this.existingEquipmentList = [];
      const apiMapping = {
        CameraSettings: 'camera',
        DomeSettings: 'dome',
        FilterWheelSettings: 'filter',
        FocuserSettings: 'focuser',
        SwitchSettings: 'switch',
        TelescopeSettings: 'mount',
        SafetyMonitorSettings: 'safety',
        FlatDeviceSettings: 'flatdevice',
        RotatorSettings: 'rotator',
        WeatherDataSettings: 'weather',
        GuiderSettings: 'guider',
      };
      const keysToCheck = Object.keys(apiMapping);

      keysToCheck.forEach((key) => {
        if (activeProfile && activeProfile[key]) {
          const device = activeProfile[key];

          if (key === 'GuiderSettings') {
            if (device.GuiderName && device.GuiderName !== 'No_Guider') {
              this.existingEquipmentList.push({
                type: key,
                id: device.GuiderName,
                apiName: apiMapping[key],
              });
            }
          } else if (device.Id && device.Id !== 'No_Device') {
            this.existingEquipmentList.push({
              type: key,
              id: device.Id,
              apiName: apiMapping[key],
            });
          }
        }
      });
    },

    setDefaultCameraSettings() {
      const cStore = useCameraStore();
      const cameraSettings = this.profileInfo?.CameraSettings || {};
      cStore.coolingTemp = cameraSettings.Temperature ?? -10;
      cStore.coolingTime = cameraSettings.CoolingDuration ?? 10;
      cStore.warmingTime = cameraSettings.WarmingDuration ?? 10;
      console.log(
        'Camera settings set:',
        cStore.coolingTemp,
        cStore.coolingTime,
        cStore.warmingTime
      );
    },
    setDefaultRotatorSettings() {
      this.rotatorMechanicalPosition = this.rotatorInfo?.MechanicalPosition ?? 0;
      console.log('Rotator setting set:', this.rotatorMechanicalPosition);
    },
    setDefaultCoordinates() {
      const cStore = useSettingsStore();
      cStore.coordinates.longitude = this.profileInfo.AstrometrySettings.Longitude;
      cStore.coordinates.latitude = this.profileInfo.AstrometrySettings.Latitude;
      cStore.coordinates.altitude = this.profileInfo.AstrometrySettings.Elevation;
    },
    checkVersionNewerOrEqual(currentVersion, minimumVersion) {
      const parseVersion = (version) => version.split('.').map(Number);

      //console.log('current', currentVersion, 'minimum', minimumVersion);

      const currentParts = parseVersion(currentVersion);
      const minimumParts = parseVersion(minimumVersion);

      for (let i = 0; i < minimumParts.length; i++) {
        const current = currentParts[i] || 0;
        const minimum = minimumParts[i] || 0;

        if (current > minimum) {
          this.isVersionNewerOrEqual = true;
          return true;
        }
        if (current < minimum) {
          this.isVersionNewerOrEqual = false;
          return false;
        }
      }
      this.isVersionNewerOrEqual = true;
      return true;
    },

    setPageReturnedFromBackground() {
      this.pageReturnedFromBackground = true;
      this.pageReturnTime = Date.now();
      console.log('Page returned from background at:', new Date().toISOString());

      setTimeout(() => {
        this.pageReturnedFromBackground = false;
        this.pageReturnTime = null;
        console.log('Page background suppression ended');
      }, 10000);
    },

    isPageRecentlyReturnedFromBackground() {
      if (!this.pageReturnedFromBackground || !this.pageReturnTime) {
        return false;
      }

      const timeDiff = Date.now() - this.pageReturnTime;
      const isRecent = timeDiff < 10000;

      return isRecent;
    },

    async handleWebSocketMessage(message) {
      //console.log('Handling WebSocket message:', message);

      // Check if message has the expected structure with Response.Event
      if (message.Response && message.Response.Event === 'IMAGE-PREPARED') {
        // Verhindere mehrfache gleichzeitige Anfragen
        if (this.isImageFetching) {
          return;
        }

        this.isImageFetching = true;
        try {
          const settingsStore = useSettingsStore();
          const cameraStore = useCameraStore();

          // Hole Image Quality aus den Settings
          const quality = settingsStore.camera.imageQuality || 90;

          // Rufe getImagePrepared auf
          const imageResponse = await apiService.getImagePrepared(quality);

          if (imageResponse && imageResponse.data) {
            // Convert Blob to URL für Anzeige
            const imageUrl = URL.createObjectURL(imageResponse.data);

            // Speichere im CameraStore
            cameraStore.imageData = imageUrl;
          }
        } catch (error) {
          console.error('Error handling IMAGE-PREPARED message:', error);
        } finally {
          this.isImageFetching = false;
        }
      }
    },
  },
});
