import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useToastStore } from '@/store/toastStore';
import { useImagetStore } from './imageStore';
import { useAutofocusStore } from '@/store/autofocusStore';
import websocketChannelService from '@/services/websocketChannelSocket';
import signalRNotificationService from '@/services/signalRNotificationService';

export const apiStore = defineStore('store', {
  state: () => ({
    apiPort: null,
    isPINS: false,
    intervalId: null,
    intervalIdGraph: null,
    lastEventHistoryFetch: 0,
    profileInfo: {
      CameraSettings: {
        MinFlatExposureTime: 0,
        MaxFlatExposureTime: 0,
      },
      FlatWizardSettings: {
        HistogramTolerance: 0,
        HistogramMeanTarget: 0,
        FlatCount: 0,
      },
      TelescopeSettings: {
        Id: 'Celestron AVX',
      },
      FilterWheelSettings: {
        Id: 'ZWO EFW',
      },
      FocuserSettings: {
        Id: 'ZWO EAF',
      },
      RotatorSettings: {
        Id: 'Mock Rotator',
      },
      GuiderSettings: {
        GuiderName: 'PHD2_Single',
      },
      FlatDeviceSettings: {
        Id: 'Mock Flat Device',
      },
      DomeSettings: {
        Id: 'Mock Dome',
      },
      SwitchSettings: {
        Id: 'Mock Switch',
      },
      WeatherDataSettings: {
        Id: 'Mock Weather',
      },
      SafetyMonitorSettings: {
        Id: 'Mock Safety',
      },
      FramingAssistantSettings: {
        LastSelectedImageSource: 'SKYATLAS',
        CameraWidth: 3001,
        CameraHeight: 1501,
      },
      PlateSolveSettings: {
        Gain: 0,
        ExposureTime: 0,
      },
      ImageFileSettings: {
        FilePattern: '',
        FileType: 'TIFF',
      },
      SnapShotControlSettings: {
        Save: false,
        Gain: 0,
      },
      AstrometrySettings: {
        Latitude: 0,
        Longitude: 0,
        Elevation: 0,
      },
      MeridianFlipSettings: {
        MinutesAfterMeridian: 0,
        MaxMinutesAfterMeridian: 0,
        PauseTimeBeforeMeridian: 0,
        Recenter: false,
        SettleTime: 0,
        UseSideOfPier: false,
        AutoFocusAfterFlip: false,
        RotateImageAfterFlip: false,
      },
    },
    cameraInfo: { Connected: false, IsExposing: false, BinningModes: [], ReadoutModes: [] },
    mountInfo: { Connected: false, TrackingMode: null },
    filterInfo: { Connected: false },
    focuserInfo: { Connected: false, CanReverse: false },
    rotatorInfo: { Connected: false },
    focuserAfInfo: { Connected: false },
    guiderInfo: { Connected: false },
    flatdeviceInfo: { Connected: false },
    domeInfo: { Connected: false },
    safetyInfo: { Connected: false, IsSafe: false },
    switchInfo: { Connected: false },
    weatherInfo: { Connected: false },
    afTimestampLastStart: null,
    afCurveData: [],
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
    imageSavePath: null,
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
    minimumApiVersion: '2.2.11.0',
    minimumTnsPluginVersion: '1.2.0.0',
    currentApiVersion: null,
    currentTnsPluginVersion: null,
    isApiVersionNewerOrEqual: false,
    isTnsPluginVersionNewerOrEqual: false,
    mount: {
      currentTab: 'showMount',
    },
    focuser: {
      currentTab: 'showFocus',
    },
    closeErrorModal: false,
    errorMessageShown: false,
    connectingAttempts: 2,
    setupCheckConnectionDone: false,
    pageReturnedFromBackground: false,
    pageReturnTime: null,
    isRedirecting: false,
    backendReachableTimeoutId: null,
    isMountConnected: false,
    isCameraConnected: false,
    isFilterConnected: false,
    isRotatorConnected: false,
    isFocuserConnected: false,
    isGuiderConnected: false,
    isFlatdeviceConnected: false,
    isDomeConnected: false,
    isSwitchConnected: false,
    isWeatherConnected: false,
    isSafetyConnected: false,
  }),

  actions: {
    async fetchAllInfos(t) {
      const toastStore = useToastStore();
      //const settingsStore = useSettingsStore();
      //this.isPINS = settingsStore.isPinsEnabled;

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

        // Prüfe API-Version bei jedem Durchlauf (validiert auch dass API erreichbar ist)
        if (this.apiPort) {
          //const responseApoVersion = await apiService.fetchApiVersion();
          const responseApiVersion = await tryWithRetry(
            () => apiService.fetchApiVersion(),
            this.connectingAttempts
          );
          //console.log('API Version response:', responseApiVersion);
          if (responseApiVersion?.Success === false) {
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
            return;
          } else {
            // API ist erreichbar!
            this.isApiConnected = true;

            //Check the API version (nur beim ersten Mal)
            if (!this.isApiVersionNewerOrEqual) {
              this.currentApiVersion = responseApiVersion.Response;

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
                return;
              }
              console.log('API Version:', this.currentApiVersion);
              this.isApiVersionNewerOrEqual = true;

              //Check if ist PINS
              await this.checkForPINS();
            }
          }
        }

        // Check if mock API mode is enabled
        const useMockApi = localStorage.getItem('USE_MOCK_API') === 'true';

        // Automatisch Channel WebSocket verbinden wenn Backend erreichbar ist
        if (useMockApi) {
          // In mock mode, skip WebSocket connection
          console.log('[MOCK MODE] Skipping WebSocket connection');
          this.isWebSocketConnected = true;
        } else if (!websocketChannelService.isWebSocketConnected()) {
          // Setup message callback für IMAGE-PREPARED handling
          websocketChannelService.setMessageCallback((message) => {
            this.handleWebSocketMessage(message);
          });

          // Versuche WebSocket zu verbinden (max 1000ms warten)
          try {
            await websocketChannelService.connect(1000);
            this.isWebSocketConnected = true;
          } catch (error) {
            // WebSocket fehlgeschlagen oder Timeout
            console.warn('[API Store] WebSocket connection failed or timeout:', error.message);
            this.isWebSocketConnected = false;
            // WebSocket wird automatisch via onclose-Handler versuchen wiederherzustellen
          }
        } else {
          this.isWebSocketConnected = true;
        }

        // Connect SignalR Notification Service
        if (!useMockApi && this.isPINS && !signalRNotificationService.isSignalRConnected()) {
          // Setup callbacks for SignalR Notifications
          signalRNotificationService.setStatusCallback((status) => {
            console.log('[API Store] SignalR Status:', status);
          });

          signalRNotificationService.setNotificationCallback((notification) => {
            //console.log('[API Store] SignalR Notification:', notification);

            // Show toast notification
            const toastStore = useToastStore();

            // Determine toast type and autoClose based on notification.type
            // 0 = info, 1 = success, 2 = warning, 3 = error
            let toastType = 'info';
            let autoClose = true;
            let autoCloseDelay = notification.lifetimeMs ? notification.lifetimeMs : 5000;

            if (notification.type === 1) {
              toastType = 'success';
            } else if (notification.type === 2) {
              toastType = 'warning';
              autoCloseDelay = 5000;
            } else if (notification.type === 3) {
              toastType = 'error';
              autoClose = false; // Error toasts stay open
            }

            toastStore.showToast({
              type: toastType,
              title: notification.title || '',
              message: notification.message,
              autoClose: autoClose,
              autoCloseDelay: autoCloseDelay,
            });
          });

          // Try to connect SignalR
          try {
            await signalRNotificationService.connect();
            console.log('[API Store] SignalR Notification Service connected');
          } catch (error) {
            console.warn('[API Store] SignalR connection failed:', error.message);
            // SignalR will automatically attempt to reconnect via reconnect logic
          }
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
          // Backend ist NICHT erreichbar - Flag explizit auf false setzen
          this.isBackendReachable = false;
          this.attemptsToConnect += 1;
          // WICHTIG: Bei Backend-Ausfall auch Equipment-Anfragen überspringen!
          console.log(
            'Backend not reachable, attempt',
            this.attemptsToConnect,
            new Date().toLocaleTimeString()
          );
          return; // Equipment-Anfragen überspringen wenn Backend nicht erreichbar
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

        // Fetch event history only every 15 seconds (or on startup if lastEventHistoryFetch = 0)
        const now = Date.now();
        if (this.lastEventHistoryFetch === 0 || now - this.lastEventHistoryFetch >= 15000) {
          //console.log('[Store] Fetch history');
          const eventHistoryResponse = await apiService.getEventHistory();

          // Process event history to determine connection status
          this.processEventHistory(eventHistoryResponse);
          this.lastEventHistoryFetch = now;
        }

        // Build API requests dynamically based on connection status
        const requests = [];
        const requestMap = {};

        requests.push(apiService.imageHistoryAll());
        requestMap['imageHistoryResponse'] = 'imageHistoryResponse';

        if (this.isCameraConnected) {
          requests.push(apiService.cameraAction('info'));
          requestMap[requests.length - 1] = 'cameraResponse';
        }
        if (this.isMountConnected) {
          requests.push(apiService.mountAction('info'));
          requestMap[requests.length - 1] = 'mountResponse';
        }
        if (this.isFilterConnected) {
          requests.push(apiService.filterAction('info'));
          requestMap[requests.length - 1] = 'filterResponse';
        }
        if (this.isRotatorConnected) {
          requests.push(apiService.rotatorAction('info'));
          requestMap[requests.length - 1] = 'rotatorResponse';
        }
        if (this.isFocuserConnected) {
          requests.push(apiService.focusAction('info'));
          requestMap[requests.length - 1] = 'focuserResponse';
        }
        if (this.isFocuserConnected) {
          requests.push(apiService.focuserAfAction('info'));
          requestMap[requests.length - 1] = 'focuserAfResponse';
        }
        if (this.isGuiderConnected) {
          requests.push(apiService.guiderAction('info'));
          requestMap[requests.length - 1] = 'guiderResponse';
        }
        if (this.isFlatdeviceConnected) {
          requests.push(apiService.flatdeviceAction('info'));
          requestMap[requests.length - 1] = 'flatdeviceResponse';
        }
        if (this.isDomeConnected) {
          requests.push(apiService.domeAction('info'));
          requestMap[requests.length - 1] = 'domeResponse';
        }
        if (this.isSafetyConnected) {
          requests.push(apiService.safetyAction('info'));
          requestMap[requests.length - 1] = 'safetyResponse';
        }
        if (this.isWeatherConnected) {
          requests.push(apiService.weatherAction('info'));
          requestMap[requests.length - 1] = 'weatherResponse';
        }
        if (this.isSwitchConnected) {
          requests.push(apiService.switchAction('info'));
          requestMap[requests.length - 1] = 'switchResponse';
        }

        const responses = await Promise.all(requests);

        // Map responses to correct keys
        const responseData = {
          imageHistoryResponse: responses[0],
          cameraResponse: null,
          mountResponse: null,
          filterResponse: null,
          rotatorResponse: null,
          focuserResponse: null,
          focuserAfResponse: null,
          guiderResponse: null,
          flatdeviceResponse: null,
          domeResponse: null,
          safetyResponse: null,
          weatherResponse: null,
          switchResponse: null,
        };

        let responseIndex = 1;
        if (this.isCameraConnected) responseData.cameraResponse = responses[responseIndex++];
        if (this.isMountConnected) responseData.mountResponse = responses[responseIndex++];
        if (this.isFilterConnected) responseData.filterResponse = responses[responseIndex++];
        if (this.isRotatorConnected) responseData.rotatorResponse = responses[responseIndex++];
        if (this.isFocuserConnected) responseData.focuserResponse = responses[responseIndex++];
        if (this.isFocuserConnected) responseData.focuserAfResponse = responses[responseIndex++];
        if (this.isGuiderConnected) responseData.guiderResponse = responses[responseIndex++];
        if (this.isFlatdeviceConnected)
          responseData.flatdeviceResponse = responses[responseIndex++];
        if (this.isDomeConnected) responseData.domeResponse = responses[responseIndex++];
        if (this.isSafetyConnected) responseData.safetyResponse = responses[responseIndex++];
        if (this.isWeatherConnected) responseData.weatherResponse = responses[responseIndex++];
        if (this.isSwitchConnected) responseData.switchResponse = responses[responseIndex++];

        this.handleApiResponses(responseData);
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
      this.isApiConnected = false;
      this.isTnsPluginConnected = false;
      this.isWebSocketConnected = false;
      this.isApiVersionNewerOrEqual = false;
      this.isTnsPluginVersionNewerOrEqual = false;
      this.apiPort = null;
      this.attemptsToConnect = 0;
      this.lastEventHistoryFetch = 0;

      // Disconnect Channel WebSocket when backend is not reachable
      if (websocketChannelService.isWebSocketConnected()) {
        websocketChannelService.disconnect();
      }

      // Disconnect SignalR when backend is not reachable
      if (signalRNotificationService.isSignalRConnected()) {
        signalRNotificationService.disconnect();
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
      if (imageHistoryResponse?.Success) {
        this.imageHistoryInfo = imageHistoryResponse.Response;
      }

      if (cameraResponse?.Success) {
        this.cameraInfo = cameraResponse.Response;
      } else if (cameraResponse) {
        console.error('Error in camera API response:', cameraResponse.Error);
      }

      if (mountResponse?.Success) {
        this.mountInfo = mountResponse.Response;
      } else if (mountResponse) {
        console.error('Error in mount API response:', mountResponse.Error);
      }

      if (filterResponse?.Success) {
        this.filterInfo = filterResponse.Response;
      } else if (filterResponse) {
        console.error('Error in filter API response:', filterResponse.Error);
      }

      if (rotatorResponse?.Success) {
        this.rotatorInfo = rotatorResponse.Response;
      } else if (rotatorResponse) {
        console.error('Error in rotator API response:', rotatorResponse.Error);
      }

      if (focuserResponse?.Success) {
        this.focuserInfo = focuserResponse.Response;
      } else if (focuserResponse) {
        console.error('Error in focuser API response:', focuserResponse.Error);
      }

      if (focuserAfResponse?.Success) {
        this.focuserAfInfo = focuserAfResponse;
      } else if (focuserAfResponse) {
        console.error('Error in focuser AF API response:', focuserAfResponse.Error);
      }

      if (safetyResponse?.Success) {
        this.safetyInfo = safetyResponse.Response;
      } else if (safetyResponse) {
        console.error('Error in safety API response:', safetyResponse.Error);
      }

      if (guiderResponse?.Success) {
        this.guiderInfo = guiderResponse.Response;
      } else if (guiderResponse) {
        console.error('Error in guider API response:', guiderResponse.Error);
      }

      if (flatdeviceResponse?.Success) {
        this.flatdeviceInfo = flatdeviceResponse.Response;
      } else if (flatdeviceResponse) {
        console.error('Error in flat device API response:', flatdeviceResponse.Error);
      }

      if (domeResponse?.Success) {
        this.domeInfo = domeResponse.Response;
      } else if (domeResponse) {
        console.error('Error in dome API response:', domeResponse.Error);
      }

      if (weatherResponse?.Success) {
        this.weatherInfo = weatherResponse.Response;
      } else if (weatherResponse) {
        console.error('Error in weather API response:', weatherResponse.Error);
      }

      if (switchResponse?.Success) {
        this.switchInfo = switchResponse.Response;
      } else if (switchResponse) {
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
        signalRNotificationService.disconnect();
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
          this.imageSavePath = this.profileInfo?.ImageFileSettings?.FilePath || null;
          this.getExistingEquipment(this.profileInfo);
        } else {
          console.error('Error in profile API response:', profileInfoResponse?.Error);
        }
      } catch (error) {
        console.error('Error fetching profile information:', error);
      }
    },

    async setImageSavePath(path) {
      try {
        await apiService.profileChangeValue('ImageFileSettings-FilePath', path);

        this.imageSavePath = path;
      } catch (e) {
        console.error('Failed to set image save path', e);
        throw e;
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
    async checkForPINS() {
      const pinsVersion = await apiService.fetchPinsVersion();
      if (pinsVersion && pinsVersion.Response) {
        this.isPINS = true;
        console.log('[API Store] PINS detected, version:', pinsVersion.Response);
      } else {
        this.isPINS = false;
      }
    },

    setPageReturnedFromBackground() {
      this.pageReturnedFromBackground = true;
      this.pageReturnTime = Date.now();
      console.log('[API Store] Page returned from background at:', new Date().toISOString());

      setTimeout(() => {
        this.pageReturnedFromBackground = false;
        this.pageReturnTime = null;
        //console.log('Page background suppression ended');
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
      const imageStore = useImagetStore();
      // Check if message has the expected structure with Response.Event
      if (message.Response && message.Response.Event === 'IMAGE-PREPARED') {
        //console.log('IMAGE-PREPARED event received');
        // Verhindere mehrfache gleichzeitige Anfragen
        if (imageStore.isImageFetching) {
          return;
        }
        await imageStore.getImage();
      }

      // If a device connection event arrives via WebSocket, fetch event history immediately
      if (message.Response && message.Response.Event) {
        const event = message.Response.Event;
        const deviceEvents = [
          'MOUNT-CONNECTED',
          'MOUNT-DISCONNECTED',
          'CAMERA-CONNECTED',
          'CAMERA-DISCONNECTED',
          'FILTERWHEEL-CONNECTED',
          'FILTERWHEEL-DISCONNECTED',
          'ROTATOR-CONNECTED',
          'ROTATOR-DISCONNECTED',
          'FOCUSER-CONNECTED',
          'FOCUSER-DISCONNECTED',
          'GUIDER-CONNECTED',
          'GUIDER-DISCONNECTED',
          'FLAT-CONNECTED',
          'FLAT-DISCONNECTED',
          'DOME-CONNECTED',
          'DOME-DISCONNECTED',
          'SAFETY-CONNECTED',
          'SAFETY-DISCONNECTED',
          'WEATHER-CONNECTED',
          'WEATHER-DISCONNECTED',
          'SWITCH-CONNECTED',
          'SWITCH-DISCONNECTED',
        ];

        if (deviceEvents.includes(event)) {
          // Fetch event history immediately
          try {
            const eventHistoryResponse = await apiService.getEventHistory();
            this.processEventHistory(eventHistoryResponse);
            this.lastEventHistoryFetch = Date.now();
          } catch (error) {
            console.error('Error fetching event history from WebSocket trigger:', error);
          }
        }

        // Handle autofocus events via WebSocket
        const autofocusEvents = [
          'AUTOFOCUS-STARTING',
          'AUTOFOCUS-POINT-ADDED',
          'AUTOFOCUS-FINISHED',
        ];

        if (autofocusEvents.includes(event)) {
          // Fetch event history immediately for autofocus
          try {
            const eventHistoryResponse = await apiService.getEventHistory();
            this.processEventHistory(eventHistoryResponse);
            this.lastEventHistoryFetch = Date.now();
          } catch (error) {
            console.error('Error fetching event history from autofocus WebSocket trigger:', error);
          }
        }
      }
    },

    processEventHistory(eventHistoryResponse) {
      if (!eventHistoryResponse?.Success || !eventHistoryResponse?.Response) {
        console.warn('Invalid event history response');
        return;
      }

      const events = eventHistoryResponse.Response;
      const deviceMap = {
        MOUNT: 'isMountConnected',
        CAMERA: 'isCameraConnected',
        FILTERWHEEL: 'isFilterConnected',
        ROTATOR: 'isRotatorConnected',
        FOCUSER: 'isFocuserConnected',
        GUIDER: 'isGuiderConnected',
        FLAT: 'isFlatdeviceConnected',
        DOME: 'isDomeConnected',
        SWITCH: 'isSwitchConnected',
        WEATHER: 'isWeatherConnected',
        SAFETY: 'isSafetyConnected',
      };

      // Initialize all devices as disconnected
      Object.values(deviceMap).forEach((key) => {
        this[key] = false;
      });

      // Sort events by timestamp (newest first)
      const sortedEvents = [...events].sort(
        (a, b) => new Date(b.Time).getTime() - new Date(a.Time).getTime()
      );

      // Find the latest event for each device
      const latestEvents = {};
      for (const event of sortedEvents) {
        const eventString = event.Event || '';
        for (const deviceName of Object.keys(deviceMap)) {
          // If we haven't found this device yet and the event contains this device
          // Use exact matching to avoid partial matches (e.g., FOCUSER matching FOCUSER-*)
          if (!latestEvents[deviceName]) {
            const connectedPattern = `${deviceName}-CONNECTED`;
            const disconnectedPattern = `${deviceName}-DISCONNECTED`;
            if (eventString === connectedPattern || eventString === disconnectedPattern) {
              latestEvents[deviceName] = event;
            }
          }
        }
      }

      // Set connection status based on the latest event
      Object.entries(latestEvents).forEach(([deviceName, event]) => {
        const stateKey = deviceMap[deviceName];
        const isConnected = event.Event.endsWith('-CONNECTED');
        this[stateKey] = isConnected;
        //console.log(`Device ${deviceName}: ${event.Event} -> ${isConnected}`);
      });

      // Clear data for disconnected devices
      if (!this.isCameraConnected) this.cameraInfo = { Connected: false, IsExposing: false };
      if (!this.isMountConnected) this.mountInfo = { Connected: false, TrackingMode: null };
      if (!this.isFilterConnected) this.filterInfo = { Connected: false };
      if (!this.isRotatorConnected) this.rotatorInfo = { Connected: false };
      if (!this.isFocuserConnected) {
        this.focuserInfo = { Connected: false };
        this.focuserAfInfo = { Connected: false };
      }
      if (!this.isGuiderConnected) {
        this.guiderInfo = { Connected: false };
        this.afCurveData = [];
        this.afTimestampLastStart = null;
      }
      if (!this.isFlatdeviceConnected) this.flatdeviceInfo = { Connected: false };
      if (!this.isDomeConnected) this.domeInfo = { Connected: false };
      if (!this.isSafetyConnected) this.safetyInfo = { Connected: false, IsSafe: false };
      if (!this.isWeatherConnected) this.weatherInfo = { Connected: false };
      if (!this.isSwitchConnected) this.switchInfo = { Connected: false };

      // Process autofocus events
      const autofocusStore = useAutofocusStore();
      autofocusStore.processAutofocusEvents(sortedEvents);
    },
  },
});
