import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import apiPinsService from '@/services/apiPinsService';
import { useSettingsStore } from '@/store/settingsStore';
import { usePinsStore } from '@/plugins/pins/store/pinsStore';
import { useToastStore } from '@/store/toastStore';
import { useImagetStore } from './imageStore';
import { useAutofocusStore } from '@/store/autofocusStore';
import websocketChannelService from '@/services/websocketChannelSocket';
import signalRNotificationService from '@/services/signalRNotificationService';
import signalRProgressService from '@/services/signalRprogressService';
import signalRDialogService from '@/services/signalRDialogService';
import signalRMessageboxesService from '@/services/signalRMessageboxesService';
import { useProgressStore } from '@/store/progressStore';
import { useLivestackStore } from '@/plugins/livestack/store/livestackStore';
import { useNightSummaryStore } from '@/plugins/nightsummary/store/nightsummaryStore';
import { useGuiderStore } from '@/store/guiderStore';
import { useCameraStore } from '@/store/cameraStore';
import { useFramingStore } from '@/store/framingStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useDialogStore } from '@/store/dialogStore';
import { useLogStore } from '@/store/logStore';
import websocketMountControlService from '@/services/websocketMountControl';
import websocketTppaService from '@/services/websocketTppa';
import { getDeviceDateTimePayload, parsePinsTimeToSeconds } from '@/utils/pinsTimeUtils';
import { createPoller } from '@/utils/poller';
import { abortInFlightRequests } from '@/utils/httpLifecycle';

// Serialized snapshots of the last payload written per state key (module-level,
// deliberately non-reactive). Used by setInfoIfChanged() so the 2s poll only
// touches the store when the backend data actually changed - every write swaps
// the object reference and re-renders all consumers, even for identical data.
let lastWrittenInfoJson = {};

// After a negative PINS-detection result, re-probe on this cadence instead of
// staying silenced for the rest of the session (see checkForPINS()).
const PINS_RECHECK_INTERVAL_MS = 15000;

// Initial profileInfo shape. Also used by switchBackend() to drop the previous
// instance's profile (readers like capturePhoto's SnapShotControlSettings.Save
// must not see another instance's values until the new profile is fetched).
const defaultProfileInfo = () => ({
  CameraSettings: {
    MinFlatExposureTime: 0,
    MaxFlatExposureTime: 0,
  },
  FlatWizardSettings: {
    HistogramTolerance: 0,
    HistogramMeanTarget: 0,
    FlatCount: 0,
    DarkFlatCount: 0,
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
    FilePatternDARK: '',
    FilePatternBIAS: '',
    FilePatternFLAT: '',
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
});

export const apiStore = defineStore('store', {
  state: () => ({
    apiPort: null,
    // Bumped by switchBackend(), i.e. whenever the endpoint changes in place
    // (onboarding; post-onboarding switches reload the page instead).
    // fetchAllInfos() cycles capture it at entry and bail after each await once
    // it moved on, so an in-flight cycle for the OLD instance can neither write
    // its apiPort back nor tear down the freshly built session via its error
    // branches. Deliberately NOT reset in clearAllStates().
    connectionEpoch: 0,
    isPINS: false,
    isPinsCheckDone: false,
    // Latches true after the PINS mode is resolved the first time and stays true
    // across the periodic re-probe (which toggles isPinsCheckDone back to false).
    // The UI gates its "still detecting" spinner on this so a background re-probe
    // never tears the page down and remounts it. Reset only on clearAllStates().
    pinsCheckResolvedOnce: false,
    pinsCheckNegativeCount: 0,
    pinsLastNegativeCheckAt: 0,
    isTimeSynced: false,
    intervalIdGraph: null,
    lastEventHistoryFetch: 0,
    profileInfo: defaultProfileInfo(),
    cameraInfo: { Connected: false, IsExposing: false, BinningModes: [], ReadoutModes: [] },
    mountInfo: { Connected: false, TrackingMode: null },
    filterInfo: { Connected: false },
    focuserInfo: { Connected: false, CanReverse: false, CanSetMaxStep: false },
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
    filterName: 'unbekannt',
    filterNr: null,
    showAfGraph: true,
    imageData: null,
    imageSavePath: null,
    isLoadingImage: false,
    captureRunning: false,
    existingEquipmentList: [],
    currentLanguage: 'en',
    showSettings: false,
    showFocuser: false,
    showMount: false,
    showSkyAtlas: false,
    minimumApiVersion: '2.2.11.0',
    minimumTnsPluginVersion: '1.2.0.0',
    currentApiVersion: null,
    currentTnsPluginVersion: null,
    currentPinsVersion: null,
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
    lastImageStats: null,
  }),

  getters: {
    // Some drivers (e.g. ZWO AM5N) leave Slewing set after a park slew has
    // finished. AtPark rules out a running slew, so AtPark wins.
    mountIsSlewing: (state) => Boolean(state.mountInfo.Slewing) && !state.mountInfo.AtPark,

    // A parked mount rejects tracking changes and axis moves. AtPark is only meaningful
    // while the mount is connected; on disconnect mountInfo is reset to
    // { Connected: false, TrackingMode: null } and AtPark is undefined.
    mountIsParked: (state) => Boolean(state.mountInfo.Connected && state.mountInfo.AtPark),

    // The guider only counts as running while it actually guides or calibrates.
    // Every other PHD2 app state (Stopped, Looping, Selected, Paused, LostLock)
    // still allows changing settings.
    guiderIsRunning: (state) => ['Guiding', 'Calibrating'].includes(state.guiderInfo?.State),
  },

  actions: {
    async fetchAllInfos(t) {
      // Staleness guard: if switchBackend() bumps the epoch while this cycle
      // is parked on an await, every result below belongs to the OLD instance.
      // Each checkpoint bails BEFORE the result is inspected, so a stale cycle
      // can neither write the old apiPort nor hit a clearAllStates() error
      // branch against the new session.
      const startEpoch = this.connectionEpoch;
      const isStale = () => this.connectionEpoch !== startEpoch;

      const toastStore = useToastStore();
      const pinsStore = usePinsStore();
      //const settingsStore = useSettingsStore();
      //this.isPINS = settingsStore.isPinsEnabled;

      const showConnectionErrorToast = (messageKey) => {
        if (pinsStore.shouldSuppressConnectionToasts || this.errorMessageShown) {
          return;
        }

        toastStore.showToast({
          type: 'error',
          title: t('app.connection_error_toast.title'),
          message: t(messageKey),
          autoClose: false,
        });
      };

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

      // While disconnected (or right after a resume, when the pool may hold
      // dead sockets), probe fast and without inner retries: the 2s poller IS
      // the retry loop, and stacking 3 attempts x 10s per probe inside one
      // cycle means the user stares at the splash for ~36s after the network
      // returns. The long timeout + inner retries only stay in place while the
      // backend is reachable, where they prevent a single slow response from
      // tearing the whole session down (clearAllStates).
      const probingWhileDisconnected =
        !this.isBackendReachable || this.isPageRecentlyReturnedFromBackground();
      const probeTimeout = probingWhileDisconnected ? 3000 : undefined;
      const probeRetries = probingWhileDisconnected ? 0 : this.connectingAttempts;

      try {
        //const tnsVersionResponse = await apiService.fetchTnsPluginVersion(); //Check if Plugin is reachable
        const tnsVersionResponse = await tryWithRetry(
          () => apiService.fetchTnsPluginVersion(probeTimeout),
          probeRetries
        );
        if (isStale()) return;
        if (!tnsVersionResponse) {
          console.warn('TNS-Plugin not reachable');
          showConnectionErrorToast('app.connection_error_toast.message_tns');
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
              showConnectionErrorToast('app.connection_error_toast.message_tns_version');
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
            () => apiService.fetchApiPort(probeTimeout),
            probeRetries
          );
          if (isStale()) return;
          //console.log('API Port response:', response);
          if (!response) {
            console.error('API not reachable');
            showConnectionErrorToast('app.connection_error_toast.message_api');
            this.isApiConnected = false;
            this.apiPort = null;
            this.clearAllStates();
            return;
          }
          if (response.data === -1) {
            console.error('API not reachable');
            showConnectionErrorToast('app.connection_error_toast.message_api');
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
            () => apiService.fetchApiVersion(probeTimeout),
            probeRetries
          );
          if (isStale()) return;
          //console.log('API Version response:', responseApiVersion);
          // null = all attempts failed (fetchApiVersion maps network errors to
          // null); without this check a null would fall through to the else
          // branch and mark the API as connected.
          if (!responseApiVersion || responseApiVersion.Success === false) {
            console.warn('API-Plugin not reachable');
            showConnectionErrorToast('app.connection_error_toast.message_api');
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
                showConnectionErrorToast('app.connection_error_toast.message_api_version');
                this.clearAllStates();
                return;
              }
              console.log('API Version:', this.currentApiVersion);
              this.isApiVersionNewerOrEqual = true;
            }
          }
        }

        // checkForPINS() owns its own "already done / re-probe after cooldown"
        // logic internally, so it must be called every cycle - gating it on
        // !isPinsCheckDone here would make the periodic negative-result re-probe
        // (PINS may come up after NINA) permanently unreachable.
        if (this.isApiVersionNewerOrEqual) {
          await this.checkForPINS();
          if (isStale()) return;
        }

        // Automatisch Channel WebSocket verbinden wenn Backend erreichbar ist
        if (!websocketChannelService.isWebSocketConnected()) {
          // Setup message callback for IMAGE-PREPARED handling
          websocketChannelService.setMessageCallback((message) => {
            this.handleWebSocketMessage(message);
          });

          // Register the subscription before connecting: subscribe() always
          // adds to the replay registry regardless of connection state. If
          // registered only after a successful connect() below, a timed-out
          // first attempt would skip it - and once the internal reconnect loop
          // opens the socket on its own later, it replays an empty registry,
          // silently dropping IMAGE-SAVE events until a full clearAllStates().
          websocketChannelService.subscribe('IMAGE-SAVE');

          // The connect timeout is owned by the service (channel socket core);
          // no need to pass one here.
          try {
            await websocketChannelService.connect();
            if (isStale()) return;
            this.isWebSocketConnected = true;
            // Initial image history load after WS connect
            try {
              const historyResponse = await apiService.imageHistoryAll();
              if (isStale()) return;
              if (historyResponse?.Success) {
                this.imageHistoryInfo = historyResponse.Response;
              }
            } catch (e) {
              console.warn('[API Store] Could not load initial image history:', e.message);
            }
          } catch (error) {
            // Connect failed or timed out; the service will keep retrying via its
            // own reconnect loop.
            console.warn('[API Store] WebSocket connection failed or timeout:', error.message);
            this.isWebSocketConnected = false;
          }
        } else {
          this.isWebSocketConnected = true;
          // Socket looks connected: verify it isn't a silent zombie.
          websocketChannelService.checkStaleness();
        }

        // Connect SignalR Notification Service
        if (this.isPINS && !signalRNotificationService.isSignalRConnected()) {
          // Setup callbacks for SignalR Notifications
          signalRNotificationService.setStatusCallback((status) => {
            console.log('[API Store] SignalR Status:', status);
          });

          signalRNotificationService.setNotificationCallback((notification) => {
            //console.log('[API Store] SignalR Notification:', notification);

            if (notification.message === 'Not a 10u mount. 10u utilities disabled.') {
              return;
            }

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

          // Fire-and-forget: SignalR has its own retry loop; awaiting would block fetchAllInfos()
          // indefinitely because connect() never rejects while shouldReconnect is true.
          signalRNotificationService.connect().catch(() => {});
        }

        // If all conditions are met, mark backend as reachable
        if (
          this.isApiConnected &&
          this.isTnsPluginConnected &&
          this.isApiVersionNewerOrEqual &&
          this.isTnsPluginVersionNewerOrEqual &&
          this.isWebSocketConnected
        ) {
          if (!this.isBackendReachable) {
            const settingsStore = useSettingsStore();
            settingsStore.loadAllBackendSettings();
          }
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
          showConnectionErrorToast('app.connection_error_toast.message_api');
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
          if (isStale()) return;

          // Process event history to determine connection status
          this.processEventHistory(eventHistoryResponse);
          this.lastEventHistoryFetch = now;
        }

        // Build API requests dynamically based on connection status
        const requests = [];
        const requestMap = {};

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
        if (isStale()) return;

        // Map responses to correct keys
        const responseData = {
          imageHistoryResponse: null,
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

        let responseIndex = 0;
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
      if (isStale()) return;
      await this.fetchProfilInfos();
      if (isStale()) return;
      //when the backend is accessible again close modal
      if (this.isBackendReachable && !this.closeErrorModal) {
        this.closeErrorModal = true;
        console.log('Backend is reachable');
        toastStore.newMessage = false;
        this.errorMessageShown = false;
      }
    },

    // Writes only when the payload differs from the last written one; returns
    // whether a write happened so callers can skip derived updates too.
    setInfoIfChanged(key, payload) {
      const json = JSON.stringify(payload);
      if (lastWrittenInfoJson[key] === json) return false;
      lastWrittenInfoJson[key] = json;
      this[key] = payload;
      return true;
    },

    clearAllStates() {
      // The reset below writes defaults directly, bypassing the cache; without
      // clearing it, an identical post-reconnect payload would be skipped and
      // the state would stay stuck at the cleared defaults.
      lastWrittenInfoJson = {};
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
      this.isPINS = false;
      this.isPinsCheckDone = false;
      this.pinsCheckResolvedOnce = false;
      this.pinsCheckNegativeCount = 0;
      this.isTimeSynced = false;
      this.imageHistoryInfo = null;
      this.lastImageStats = null;

      // Clear equipment connection flags
      this.isMountConnected = false;
      this.isCameraConnected = false;
      this.isFilterConnected = false;
      this.isRotatorConnected = false;
      this.isFocuserConnected = false;
      this.isGuiderConnected = false;
      this.isFlatdeviceConnected = false;
      this.isDomeConnected = false;
      this.isSwitchConnected = false;
      this.isWeatherConnected = false;
      this.isSafetyConnected = false;

      // Clear equipment info from previous instance
      this.cameraInfo = { Connected: false, IsExposing: false, BinningModes: [], ReadoutModes: [] };
      this.mountInfo = { Connected: false, TrackingMode: null };
      this.filterInfo = { Connected: false };
      this.focuserInfo = { Connected: false, CanReverse: false, CanSetMaxStep: false };
      this.rotatorInfo = { Connected: false };
      this.focuserAfInfo = { Connected: false };
      this.guiderInfo = { Connected: false };
      this.flatdeviceInfo = { Connected: false };
      this.domeInfo = { Connected: false };
      this.safetyInfo = { Connected: false, IsSafe: false };
      this.switchInfo = { Connected: false };
      this.weatherInfo = { Connected: false };

      // Clear other instance-specific state
      this.filterName = 'unbekannt';
      this.filterNr = null;
      this.existingEquipmentList = [];
      this.imageData = null;
      this.afCurveData = [];
      this.afTimestampLastStart = null;
      this.currentApiVersion = null;
      this.currentTnsPluginVersion = null;
      this.currentPinsVersion = null;

      // Disconnect all transports unconditionally: a "connected" check would
      // skip a service that is mid-reconnect, leaving its retry loop armed and
      // pointed at the old instance. disconnect() is idempotent on all of them
      // and also cancels pending reconnect/restart timers.
      websocketChannelService.disconnect();
      websocketMountControlService.disconnect();
      websocketTppaService.disconnect();
      signalRNotificationService.disconnect();
      signalRProgressService.disconnect();
      signalRDialogService.disconnect();
      signalRMessageboxesService.disconnect();

      // Clear progress data from the previous instance
      const progressStore = useProgressStore();
      progressStore.clearAll();

      // Clear autofocus data from the previous instance
      const autofocusStore = useAutofocusStore();
      autofocusStore.clearAutofocusData();

      // Drop the solved camera rotation: it belongs to the previous instance
      // and must not leak into the next one.
      useFramingStore().resetSolvedRotation();

      // Stop any client-driven capture loop/countdown: it would otherwise
      // survive the teardown and start commanding the next backend's camera.
      const cameraStore = useCameraStore();
      cameraStore.resetCaptureState();

      // Clear guider graph data and stop polling
      const guiderStore = useGuiderStore();
      guiderStore.stopFetching();
      guiderStore.stopDarkLibraryBuildPolling();
      guiderStore.$patch({
        RADistanceRaw: [],
        DECDistanceRaw: [],
        raDuration: [],
        decDuration: [],
        chartInfo: [],
        phd2Connection: [],
        phd2Status: [],
        phd2StarLostInfo: [],
        phd2StarLost: false,
        phd2IsConnected: false,
        phd2StarInfo: null,
        phd2CalibrationMessage: null,
        phd2EquipmentProfiles: [],
        phd2CurrentEquipment: [],
        phd2Cameras: [],
        phd2SelectedCameraIndex: null,
        phd2SelectedCameraName: null,
        phd2Mounts: [],
        phd2SelectedMountIndex: null,
        phd2SelectedMountName: null,
      });

      // Stop sequence editor polling and drop its data from the previous
      // instance. The available* lists must be cleared too: their fetchers
      // return early when the list is non-empty, so a stale cache from another
      // instance (different plugins installed) would never be refreshed.
      const sequenceV2Store = useSequenceV2Store();
      sequenceV2Store.stopPolling();
      sequenceV2Store.$patch({
        data: [],
        loaded: false,
        availableItems: [],
        availableTriggers: [],
        availableConditions: [],
      });

      // Clear sequence data from the previous instance
      const sequenceStore = useSequenceStore();
      sequenceStore.$patch({
        sequenceInfo: [],
        sequenceIsLoaded: false,
        sequenceRunning: false,
        targetName: '',
        lastTargetName: '',
        imageTargetNames: {},
        runningItems: [],
        runningConditions: [],
        firstLoad: true,
      });

      // Clear dialog data from the previous instance
      const dialogStore = useDialogStore();
      dialogStore.$patch({
        dialogs: [],
        dialogCount: 0,
        meridianFlipData: null,
        slewAndCenterData: null,
      });

      // Clear log data from the previous instance
      const logStore = useLogStore();
      logStore.$patch({
        LogsInfo: { logs: [] },
        focuserData: [],
        foundPos: 0,
      });

      // Clear livestack state from the previous instance
      const livestackStore = useLivestackStore();
      livestackStore.$patch({
        availableImages: [],
        availableTargets: [],
        availableFilters: [],
        selectedFilter: null,
        selectedTarget: null,
        currentImageTarget: null,
        currentImageFilter: null,
        currentImageUrl: null,
        lastImageUpdate: null,
        status: 'stopped',
      });

      // Clear night summary state from the previous instance
      const nightSummaryStore = useNightSummaryStore();
      nightSummaryStore.$patch({
        pluginInstalled: null,
        settings: null,
        settingsLoading: false,
        settingsSaving: false,
        settingsError: null,
        filterNames: [],
        emailTestStatus: null,
        discordTestStatus: null,
        pushoverTestStatus: null,
        emailTesting: false,
        discordTesting: false,
        pushoverTesting: false,
        sessions: [],
        selectedSessionId: null,
        sessionDetail: null,
        loadingSessions: false,
        loadingDetail: false,
        resendingSession: false,
        resendStatus: null,
        error: null,
        deleteError: null,
      });
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
        this.setInfoIfChanged('imageHistoryInfo', imageHistoryResponse.Response);
      }

      if (cameraResponse?.Success) {
        this.setInfoIfChanged('cameraInfo', cameraResponse.Response);
      } else if (cameraResponse) {
        console.error('Error in camera API response:', cameraResponse.Error);
      }

      if (mountResponse?.Success) {
        this.setInfoIfChanged('mountInfo', mountResponse.Response);
      } else if (mountResponse) {
        console.error('Error in mount API response:', mountResponse.Error);
      }

      if (filterResponse?.Success) {
        this.setInfoIfChanged('filterInfo', filterResponse.Response);
      } else if (filterResponse) {
        console.error('Error in filter API response:', filterResponse.Error);
      }

      if (rotatorResponse?.Success) {
        this.setInfoIfChanged('rotatorInfo', rotatorResponse.Response);
      } else if (rotatorResponse) {
        console.error('Error in rotator API response:', rotatorResponse.Error);
      }

      if (focuserResponse?.Success) {
        this.setInfoIfChanged('focuserInfo', focuserResponse.Response);
      } else if (focuserResponse) {
        console.error('Error in focuser API response:', focuserResponse.Error);
      }

      if (focuserAfResponse?.Success) {
        this.setInfoIfChanged('focuserAfInfo', focuserAfResponse);
      } else if (focuserAfResponse) {
        console.error('Error in focuser AF API response:', focuserAfResponse.Error);
      }

      if (safetyResponse?.Success) {
        this.setInfoIfChanged('safetyInfo', safetyResponse.Response);
      } else if (safetyResponse) {
        console.error('Error in safety API response:', safetyResponse.Error);
      }

      if (guiderResponse?.Success) {
        this.setInfoIfChanged('guiderInfo', guiderResponse.Response);
      } else if (guiderResponse) {
        console.error('Error in guider API response:', guiderResponse.Error);
      }

      if (flatdeviceResponse?.Success) {
        this.setInfoIfChanged('flatdeviceInfo', flatdeviceResponse.Response);
      } else if (flatdeviceResponse) {
        console.error('Error in flat device API response:', flatdeviceResponse.Error);
      }

      if (domeResponse?.Success) {
        this.setInfoIfChanged('domeInfo', domeResponse.Response);
      } else if (domeResponse) {
        console.error('Error in dome API response:', domeResponse.Error);
      }

      if (weatherResponse?.Success) {
        this.setInfoIfChanged('weatherInfo', weatherResponse.Response);
      } else if (weatherResponse) {
        console.error('Error in weather API response:', weatherResponse.Error);
      }

      if (switchResponse?.Success) {
        this.setInfoIfChanged('switchInfo', switchResponse.Response);
      } else if (switchResponse) {
        console.error('Error in switch API response:', switchResponse.Error);
      }
    },

    // In-place teardown + fresh connect when the backend endpoint changes.
    // Only reached during onboarding now: once setup is complete, every endpoint
    // change reloads the page instead, because enumerating the instance-scoped
    // state of ~43 stores by hand never stayed complete. See
    // settingsStore._applyEndpointChange() and utils/instanceSwitchReload.js.
    // Callers mutate settingsStore.connection first, then invoke this
    // synchronously.
    async switchBackend() {
      // Invalidate every in-flight fetchAllInfos cycle before the first await.
      const myEpoch = ++this.connectionEpoch;
      const wasPolling = !!this._infoPoller?.isRunning();
      // Capture BEFORE clearAllStates() latches shouldReconnect to false.
      const mountWasArmed = websocketMountControlService.shouldReconnect;
      const tppaWasArmed = websocketTppaService.shouldReconnect;

      this.stopFetchingInfo();
      abortInFlightRequests('instance-switch');
      this.clearAllStates();

      // Instance-only resets, deliberately NOT in clearAllStates(): that also
      // runs on transient connection losses, where the profile and the last
      // image still belong to the current instance and should survive.
      this.profileInfo = defaultProfileInfo();
      this.imageSavePath = null;
      useImagetStore().clearImageCache();
      // Thumbnails are keyed by history index, which points at different images on
      // another instance. A transient connection loss keeps them: same instance,
      // same indices.
      useImagetStore().clearThumbnailCache();

      // Re-arm the sockets that were live before the switch. connect() with a
      // null URL (apiPort is null right after teardown) arms the idle-recheck
      // loop, which dials as soon as the new handshake sets apiPort.
      if (mountWasArmed) websocketMountControlService.connect().catch(() => {});
      if (tppaWasArmed) websocketTppaService.connect().catch(() => {});

      // Startup (App.vue onMounted) and pause/resume own polling otherwise.
      if (!wasPolling || !this._infoPollerT) return;
      await this.fetchAllInfos(this._infoPollerT);
      // Rapid double-switch: a newer switchBackend() owns the restart.
      if (this.connectionEpoch !== myEpoch) return;
      this.startFetchingInfo(this._infoPollerT);
    },

    startFetchingInfo(t) {
      this._infoPollerT = t;
      if (!this._infoPoller) {
        this._infoPoller = createPoller(() => this.fetchAllInfos(this._infoPollerT), 2000);
      }
      if (!this._infoPoller.isRunning()) {
        this.attemptsToConnect = 0;
        this._infoPoller.start();
        console.log('Started fetching info interval');
      }
    },

    stopFetchingInfo() {
      if (this._infoPoller?.isRunning()) {
        this.attemptsToConnect = 0;
        this._infoPoller.stop();
        websocketChannelService.disconnect();
        signalRNotificationService.disconnect();
        console.log('Stopped fetching info interval');
      }
    },

    async getGuiderInfo() {
      try {
        const response = await apiService.guiderAction('info');
        if (response.Success) {
          this.setInfoIfChanged('guiderInfo', response.Response);
        }
      } catch (error) {
        console.error('Error fetching guider info:', error);
      }
    },

    async fetchProfilInfos() {
      try {
        const profileInfoResponse = await apiService.profileAction('show?active=true');

        if (profileInfoResponse && profileInfoResponse.Response) {
          // imageSavePath and existingEquipmentList are derived purely from the
          // profile, so they only need recomputing when the profile changed.
          if (this.setInfoIfChanged('profileInfo', profileInfoResponse.Response)) {
            this.imageSavePath = this.profileInfo?.ImageFileSettings?.FilePath || null;
            this.getExistingEquipment(this.profileInfo);
          }
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

    async setHorizonFilePath(path) {
      try {
        await apiService.profileChangeValue('AstrometrySettings-HorizonFilePath', path);
        if (this.profileInfo?.AstrometrySettings) {
          this.profileInfo.AstrometrySettings.HorizonFilePath = path;
        }
      } catch (e) {
        console.error('Failed to set horizon file path', e);
        throw e;
      }
    },

    async fetchLastImageStats() {
      if (!this.isPINS) return; // Nur abrufen wenn PINS aktiv ist
      try {
        const [statsResult, histResult] = await Promise.all([
          apiService.getCaptureStatisticsFull().catch(() => null),
          apiService.getPreparedImageStatistics().catch(() => null),
        ]);
        const base = histResult?.Response ?? statsResult?.Response ?? null;
        if (!base) {
          if (
            statsResult?.Error === 'No capture processed' ||
            histResult?.Error === 'No capture processed'
          )
            return;
          console.error('[Store] fetchLastImageStats: both calls failed or returned no data');
          return;
        }
        this.lastImageStats = {
          ...base,
          ...(statsResult?.Response ?? {}),
          Histogram: histResult?.Response?.Histogram ?? null,
        };
      } catch (error) {
        console.error('Error fetching last image stats:', error);
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

    checkVersionNewerOrEqual(currentVersion, minimumVersion) {
      if (!currentVersion || !minimumVersion) return true;
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
      if (this.isPinsCheckDone) {
        if (this.isPINS) {
          await this.syncSystemTime();
          return;
        }
        // A negative result isn't permanent: re-probe periodically instead of
        // staying silenced for the rest of the session (PINS may come up after
        // NINA, or the earlier negative may have been a transient hiccup).
        if (Date.now() - this.pinsLastNegativeCheckAt < PINS_RECHECK_INTERVAL_MS) {
          return;
        }
        this.isPinsCheckDone = false;
        this.pinsCheckNegativeCount = 0;
      }
      if (!this.isApiVersionNewerOrEqual) {
        return;
      }
      const pinsVersion = await apiService.fetchPinsVersion();
      if (pinsVersion === null) {
        // Timeout / kein Response — Zähler reset, nächster Polling-Cycle retries
        this.pinsCheckNegativeCount = 0;
        return;
      }
      if (pinsVersion?.Response) {
        this.isPINS = true;
        this.currentPinsVersion = pinsVersion.Response;
        this.pinsCheckNegativeCount = 0;
        this.isPinsCheckDone = true;
        this.pinsCheckResolvedOnce = true;
        console.log('[API Store] PINS detected, version:', pinsVersion.Response);
        await this.syncSystemTime();
        return;
      }
      // Negativ-Antwort (z.B. 404 von Standard-NINA) — erst nach 2x cachen
      this.pinsCheckNegativeCount++;
      console.log(`[API Store] PINS check negative (${this.pinsCheckNegativeCount}/2)`);
      if (this.pinsCheckNegativeCount >= 2) {
        this.isPINS = false;
        this.currentPinsVersion = null;
        this.isPinsCheckDone = true;
        this.pinsCheckResolvedOnce = true;
        this.pinsLastNegativeCheckAt = Date.now();
        console.log('[API Store] No PINS endpoint — assuming NINA, rechecking in 15s');
      }
    },

    async syncSystemTime() {
      const pinsStore = usePinsStore();

      if (!pinsStore.timeSyncEnabled) {
        //console.log('[Time Sync] Time sync is disabled in settings.');
        return;
      }

      if (this.isTimeSynced) return;

      const serverTime = await apiPinsService.fetchSystemTime();
      if (!serverTime) return;

      const clientTime = new Date();
      const clientTimestamp = clientTime.getTime() / 1000; // Seconds
      const serverTimestamp = parsePinsTimeToSeconds(serverTime);
      if (serverTimestamp === null) {
        console.warn('[Time Sync] Could not parse server time payload:', serverTime);
        return;
      }
      const serverIso =
        serverTime.iso || serverTime.dateTime || new Date(serverTimestamp * 1000).toISOString();

      console.log(`[Time Sync] Client: ${clientTime.toISOString()} (${clientTimestamp})`);
      console.log(`[Time Sync] Server: ${serverIso} (${serverTimestamp})`);

      const diff = Math.abs(clientTimestamp - serverTimestamp);
      console.log(`[Time Sync] Difference: ${diff.toFixed(3)}s`);

      // If difference is more than 5 seconds, sync it
      if (diff > 5) {
        console.log('[Time Sync] Difference too large, updating server time...');
        const success = await apiPinsService.setSystemTime(getDeviceDateTimePayload(clientTime));
        if (success) {
          console.log('[Time Sync] Server time updated successfully.');
        } else {
          console.error('[Time Sync] Failed to update server time.');
        }
      } else {
        console.log('[Time Sync] Time is synchronized.');
      }
      this.isTimeSynced = true;
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
        console.log('[WS] IMAGE-PREPARED received, isImageFetching =', imageStore.isImageFetching);
        // Verhindere mehrfache gleichzeitige Anfragen
        if (imageStore.isImageFetching) {
          return;
        }
        await imageStore.getImage();
      }

      if (message.Response && message.Response.Event === 'IMAGE-SAVE') {
        const stats = message.Response.ImageStatistics;
        if (stats && Array.isArray(this.imageHistoryInfo)) {
          this.imageHistoryInfo = [...this.imageHistoryInfo, stats];
        }
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

      // Clear data for disconnected devices. Must go through setInfoIfChanged:
      // a direct write would leave the cache holding the pre-disconnect payload,
      // and a reconnect returning identical data would then be skipped, leaving
      // the state stuck at the cleared defaults.
      if (!this.isCameraConnected)
        this.setInfoIfChanged('cameraInfo', { Connected: false, IsExposing: false });
      if (!this.isMountConnected)
        this.setInfoIfChanged('mountInfo', { Connected: false, TrackingMode: null });
      if (!this.isFilterConnected) this.setInfoIfChanged('filterInfo', { Connected: false });
      if (!this.isRotatorConnected) this.setInfoIfChanged('rotatorInfo', { Connected: false });
      if (!this.isFocuserConnected) {
        this.setInfoIfChanged('focuserInfo', { Connected: false });
        this.setInfoIfChanged('focuserAfInfo', { Connected: false });
      }
      if (!this.isGuiderConnected) {
        if (this.setInfoIfChanged('guiderInfo', { Connected: false })) {
          this.afCurveData = [];
          this.afTimestampLastStart = null;
        }
      }
      if (!this.isFlatdeviceConnected)
        this.setInfoIfChanged('flatdeviceInfo', { Connected: false });
      if (!this.isDomeConnected) this.setInfoIfChanged('domeInfo', { Connected: false });
      if (!this.isSafetyConnected)
        this.setInfoIfChanged('safetyInfo', { Connected: false, IsSafe: false });
      if (!this.isWeatherConnected) this.setInfoIfChanged('weatherInfo', { Connected: false });
      if (!this.isSwitchConnected) this.setInfoIfChanged('switchInfo', { Connected: false });

      // Process autofocus events
      const autofocusStore = useAutofocusStore();
      autofocusStore.processAutofocusEvents(sortedEvents);
    },
  },
});
