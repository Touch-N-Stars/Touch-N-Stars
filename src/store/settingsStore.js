import { defineStore } from 'pinia';
import tutorialContent from '@/assets/tutorial.json';
import { apiStore } from '@/store/store';
import { useSequenceStore } from './sequenceStore';
import { useTppaStore } from './tppaStore';
import apiService from '@/services/apiService';
import { reloadForInstanceSwitch } from '@/utils/instanceSwitchReload';
import {
  createDefaultCelestiaAtlasSettings,
  migrateCelestiaAtlasSettingsStorage,
} from '@/store/utils/celestiaAtlasSettingsMigration';
import { serializeRigSharedSettings } from '@/services/rigSharedSettingsService';

// Upgrade the persisted state before Pinia's persistence plugin hydrates it.
// Existing installations keep all Atlas preferences, while the obsolete key is
// removed from the next serialized snapshot.
migrateCelestiaAtlasSettingsStorage();

// Status bar chips in their factory order. Also the source of truth for which
// chips exist, so stored orders from older versions can be topped up on load.
const DEFAULT_STATUSBAR_ORDER = [
  'screenlock',
  'camera',
  'guider',
  'mount',
  'filter',
  'weather',
  'safety',
  'progress',
  'log',
  'instance',
];

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    language: 'en',
    setupCompleted: localStorage.getItem('setupCompleted') === 'true',
    showDebugConsole: false,
    showSpecial: false,
    useBetaFeatures: false,
    // Hidden dev update channel, revealed via the tap sequence in the About modal
    devChannelUnlocked: false,
    useDevUpdateChannel: false,
    touchOptimized: true,
    hapticsEnabled: true,
    livestack: {
      showFilters: true,
    },
    connection: {
      ip: '',
      port: '',
      instances: [],
    },
    selectedInstanceId: null,
    lastCreatedInstanceId: null,
    monitorViewSetting: {
      showImage: true,
      showImageStats: true,
      showImgStatsGraph: true,
      showGuiderGraph: true,
      showGuiderAfGraph: true,
      showSequenceCurrentState: true,
      displayStatusUnderImage: false,
      showHistoryImageStats: true,
      historyTimeRange: {
        startIndex: 0, // Index des ersten anzuzeigenden Datenpunkts
        endIndex: null, // null bedeutet: alle Daten anzeigen
      },
      graphDataSource1: 'HFR', // Erste Datenquelle für Graph
      graphDataSource2: 'Stars', // Zweite Datenquelle für Graph
      imageFilter: {
        selectedTarget: null,
        selectedFilter: null,
        selectedNight: null,
        selectedImageType: null,
      },
    },
    useImperialUnits: localStorage.getItem('useImperialUnits') === 'true',
    tutorial: {
      completed: localStorage.getItem('tutorialCompleted') === 'true',
      steps: tutorialContent.steps,
      histogramVisited: false,
      selectTargetVisited: false,
      statusBarButtonsVisited: false,
    },
    // Guided first-run configuration: language/instance for everyone, plus the
    // rig steps on PINS. currentStepId is persisted because a PINS upgrade
    // restarts the daemon and reloads the app mid-wizard.
    setupWizard: {
      completed: localStorage.getItem('setupWizardCompleted') === 'true',
      // An id, not an index: the step list grows once isPINS flips, so a numeric
      // position would point at a different step than the user was on.
      currentStepId: localStorage.getItem('setupWizardStepId') || '',
      // Bumped by resetSetupWizard(). App.vue watches it as the explicit "open the
      // wizard now" signal - `completed` alone cannot express it, because after
      // a cancel it is already false and toggling it changes nothing.
      openRequest: 0,
      // Set by App.vue while the overlay is up. An instance change must not
      // hard-reload the page underneath a running wizard.
      isOpen: false,
    },
    framing: {
      useNinaCache: true,
    },
    // Sky chart moon overlay: kept here, not in apiStore, because this store is
    // persisted as a whole - the toggle has to survive a restart and an instance
    // switch, while clearAllStates() would wipe it from apiStore.
    skyChart: {
      showMoon: false,
    },
    mount: {
      slewRate: 9,
      slewRateIndex: 0,
      reversePrimaryAxis: false,
      reverseSecondaryAxis: false,
      useCenter: false,
      useRotate: false,
      settingsVisited: false,
    },
    camera: {
      exposureTime: 2,
      gain: 0,
      offset: 0,
      useSolve: false,
      useSyncSolveToMount: false,
      imageScale: 100,
      imageQuality: 90,
      maxDimension: 2048,
      snapshotTargetName: 'Snapshot',
    },
    flats: {
      activeMode: 'single',
      selectedOption: 'AutoExposure',
      altitudeSite: 'EAST',
      minBrightness: 0,
      maxBrightness: 100,
      brightness: 50,
      exposureTime: 2,
      keepClosed: false,
      // Stamps ImageMetaData.Target.Name on flat frames so $$TARGETNAME$$ resolves.
      // Opt-in: the plugin-side hook stays a no-op while this is false.
      targetNameEnabled: false,
      targetName: 'Flat Wizard',
      multiMode: {
        selectedMode: 'AutoExposure',
        keepClosed: false,
        activeFilterIds: [],
        expandedFilterIds: [],
        filterConfigs: {},
      },
    },
    celestiaAtlas: createDefaultCelestiaAtlasSettings(),
    guider: {
      phd2ForceCalibration: false,
      phd2ImageGamma: 0.5,
    },
    instanceColorClasses: [
      'bg-gray-900/95',
      'bg-gray-800',
      'bg-blue-900',
      'bg-sky-900',
      'bg-indigo-900',
      'bg-cyan-900',
      'bg-amber-900',
      'bg-slate-800',
      'bg-zinc-800',
      'bg-fuchsia-900',
      'bg-emerald-900',
      'bg-teal-900',
      'bg-gray-900',
      'bg-red-900',
      'bg-orange-900',
      'bg-lime-900',
      'bg-neutral-900',
      'bg-stone-900',
      'bg-green-900',
      'bg-purple-900',
      'bg-rose-900',
    ],
    // Device/screen behavior
    keepAwakeEnabled: false,
    // Android: bind app process to Wi-Fi when the instance IP is in its subnet
    wifiBindingEnabled: true,
    _sharedRigSettingsReady: false,
    _sharedRigSettingsLoading: false,
    _sharedRigSettingsSnapshot: '',
    // Modal Positionen
    modalPositions: {},
    // Navbar customization
    navbar: {
      itemOrder: [
        'equipment',
        'camera',
        'autofocus',
        'mount',
        'dome',
        'flat',
        'switch',
        'filter',
        'rotator',
        'guider',
        'sequence',
        'monitoring',
        'flats',
        'framing',
        'skyview',
        'settings',
        'about',
      ],
      hiddenItems: [],
    },
    // Status bar customization
    statusbar: {
      itemOrder: [...DEFAULT_STATUSBAR_ORDER],
      hiddenItems: [],
    },
    // Screen lock (screen-lock plugin): guards against accidental touches.
    // Lives here, not in apiStore, because this store is persisted as a whole -
    // the lock has to survive a restart and an instance switch (which reloads
    // the page), while clearAllStates() would wipe it from apiStore.
    screenLock: {
      active: false,
    },
  }),
  getters: {
    currentImageRotation(state) {
      const instance = state.connection.instances.find((i) => i.id === state.selectedInstanceId);
      return instance?.imageRotation ?? 0;
    },
  },
  actions: {
    async loadAllBackendSettings() {
      const sequenceStore = useSequenceStore();
      const tppaStore = useTppaStore();
      await Promise.all([
        this.loadMountSettings(),
        this.loadUseNinaCache(),
        this.loadCameraSettings(),
        this.loadFlatsSettings(),
        this.loadGuiderSettings(),
        this.loadNavbarSettings(),
        this.loadStatusBarSettings(),
        this.loadSharedRigUiSettings(),
        sequenceStore.loadSequenceControlsLocked(),
        sequenceStore.loadAutoLockControlsOnStart(),
        tppaStore.loadTppaSettings(),
      ]);
    },

    async loadSharedRigUiSettings() {
      if (this._sharedRigSettingsLoading) return;
      const wasReady = this._sharedRigSettingsReady;
      const localSnapshotAtStart = serializeRigSharedSettings(this);
      this._sharedRigSettingsLoading = true;
      if (!wasReady) this._sharedRigSettingsReady = false;

      try {
        const response = await apiService.getSetting('rig_ui_settings_v1');
        if (wasReady && serializeRigSharedSettings(this) !== localSnapshotAtStart) {
          return;
        }

        if (response?.Response?.Value !== undefined) {
          const parsed = JSON.parse(response.Response.Value);
          const settings = parsed?.data || parsed;
          if (settings?.monitorViewSetting) {
            Object.assign(this.monitorViewSetting, settings.monitorViewSetting);
          }
          if (settings?.livestack) {
            Object.assign(this.livestack, settings.livestack);
          }
          if (settings?.celestiaAtlas) {
            Object.assign(this.celestiaAtlas, settings.celestiaAtlas);
          }
        }

        this._sharedRigSettingsSnapshot = serializeRigSharedSettings(this);
        this._sharedRigSettingsReady = true;

        if (response?.StatusCode === 404) {
          await this.saveSharedRigUiSettings();
        }
      } finally {
        this._sharedRigSettingsLoading = false;
      }
    },

    async saveSharedRigUiSettings() {
      if (!this._sharedRigSettingsReady) return;
      const value = serializeRigSharedSettings(this);
      const res = await apiService.createSetting({
        Key: 'rig_ui_settings_v1',
        Value: value,
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('rig_ui_settings_v1', value);
      }
      this._sharedRigSettingsSnapshot = value;
    },

    async loadMountSettings() {
      const response = await apiService.getSetting('mount_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.mount, JSON.parse(response.Response.Value));
      } else if (response?.StatusCode === 404) {
        this.saveMountSettings();
      }
    },

    async saveMountSettings() {
      const res = await apiService.createSetting({
        Key: 'mount_settings',
        Value: JSON.stringify(this.mount),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('mount_settings', JSON.stringify(this.mount));
      }
    },

    async loadFlatsSettings() {
      const response = await apiService.getSetting('flats_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.flats, JSON.parse(response.Response.Value));
      } else if (response?.StatusCode === 404) {
        this.saveFlatsSettings();
      }
    },

    async saveFlatsSettings() {
      const res = await apiService.createSetting({
        Key: 'flats_settings',
        Value: JSON.stringify(this.flats),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('flats_settings', JSON.stringify(this.flats));
      }
    },

    async loadNavbarSettings() {
      const response = await apiService.getSetting('navbar_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.navbar, JSON.parse(response.Response.Value));
      } else if (response?.StatusCode === 404) {
        this.saveNavbarSettings();
      }
    },

    async saveNavbarSettings() {
      const res = await apiService.createSetting({
        Key: 'navbar_settings',
        Value: JSON.stringify(this.navbar),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('navbar_settings', JSON.stringify(this.navbar));
      }
    },

    async loadStatusBarSettings() {
      const response = await apiService.getSetting('statusbar_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.statusbar, JSON.parse(response.Response.Value));
        // A stored order from an older version does not know about chips added
        // since. Append them instead of leaving them at the fallback position.
        const missing = DEFAULT_STATUSBAR_ORDER.filter(
          (id) => !this.statusbar.itemOrder.includes(id)
        );
        if (missing.length) {
          this.statusbar.itemOrder = [...this.statusbar.itemOrder, ...missing];
        }
      } else if (response?.StatusCode === 404) {
        this.saveStatusBarSettings();
      }
    },

    async saveStatusBarSettings() {
      const res = await apiService.createSetting({
        Key: 'statusbar_settings',
        Value: JSON.stringify(this.statusbar),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('statusbar_settings', JSON.stringify(this.statusbar));
      }
    },

    async loadGuiderSettings() {
      const response = await apiService.getSetting('guider_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.guider, JSON.parse(response.Response.Value));
      } else if (response?.StatusCode === 404) {
        this.saveGuiderSettings();
      }
    },

    async saveGuiderSettings() {
      const res = await apiService.createSetting({
        Key: 'guider_settings',
        Value: JSON.stringify(this.guider),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('guider_settings', JSON.stringify(this.guider));
      }
    },

    async loadCameraSettings() {
      const response = await apiService.getSetting('camera_settings');
      if (response?.Response?.Value !== undefined) {
        Object.assign(this.camera, JSON.parse(response.Response.Value));
      } else if (response?.StatusCode === 404) {
        this.saveCameraSettings();
      }
    },

    async saveCameraSettings() {
      const res = await apiService.createSetting({
        Key: 'camera_settings',
        Value: JSON.stringify(this.camera),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('camera_settings', JSON.stringify(this.camera));
      }
    },

    async loadUseNinaCache() {
      const response = await apiService.getSetting('framing_useNinaCache');
      if (response?.Response?.Value !== undefined) {
        this.framing.useNinaCache = response.Response.Value === 'true';
      } else if (response?.StatusCode === 404) {
        this.saveUseNinaCache(this.framing.useNinaCache);
      }
    },

    async saveUseNinaCache(value) {
      this.framing.useNinaCache = value;
      const res = await apiService.createSetting({
        Key: 'framing_useNinaCache',
        Value: String(value),
      });
      if (res?.StatusCode === 409) {
        await apiService.updateSetting('framing_useNinaCache', String(value));
      }
    },

    setImageRotation(degrees) {
      if (!this.selectedInstanceId) return;
      const instance = this.connection.instances.find((i) => i.id === this.selectedInstanceId);
      if (instance) {
        instance.imageRotation = degrees;
      }
    },

    _getApiStore() {
      return apiStore();
    },

    /**
     * Single choke point for "the active backend endpoint just changed".
     *
     * Normal operation reloads the page: the in-place teardown had to enumerate
     * every instance-scoped store by hand and always missed some, so the new
     * instance inherited stale data. See utils/instanceSwitchReload.js.
     *
     * An open setup wizard is the exception - its progress lives in component
     * state, so there the app must stay alive and falls back to the in-place
     * teardown. See _canReloadOnEndpointChange().
     */
    _applyEndpointChange({ allowReload = true } = {}) {
      if (allowReload && this._canReloadOnEndpointChange()) {
        // The persistence plugin writes through a detached $subscribe watcher,
        // i.e. only on the next Vue tick. A synchronous reload would beat it and
        // the fresh page would hydrate the PREVIOUS endpoint. $persist() writes
        // localStorage right now. Optional call: the unit tests build a Pinia
        // without the persistence plugin.
        this.$persist?.();
        this._reloadForInstanceSwitch(this.getInstance(this.selectedInstanceId)?.name ?? '');
        return;
      }

      // Tear down the old instance's session and connect to the new one.
      // switchBackend() also clears the image cache.
      void this._getApiStore().switchBackend();
    },

    _canReloadOnEndpointChange() {
      // setupCompleted === false IS the first-run state, and an open wizard is the
      // same situation on a second pass: both keep their progress in component
      // state, which a page reload would throw away mid-flow.
      if (!this.setupCompleted || this.setupWizard.isOpen) return false;
      return typeof window !== 'undefined' && typeof window.location?.reload === 'function';
    },

    // Seam for tests, same pattern as _getApiStore().
    _reloadForInstanceSwitch(instanceName) {
      reloadForInstanceSwitch(instanceName);
    },

    completeSetup() {
      this.setupCompleted = true;
      localStorage.setItem('setupCompleted', 'true');
    },

    resetSetup() {
      this.setupCompleted = false;
      localStorage.removeItem('setupCompleted');
    },

    isSetupComplete() {
      return this.setupCompleted;
    },

    async setConnection(connection, options = {}) {
      this.connection.ip = connection.ip;
      this.connection.port = connection.port;

      this._applyEndpointChange(options);
    },

    addInstance(instance, options = {}) {
      const existingInstance = this.getInstanceByNameIpPort(
        instance.name || 'Instance',
        instance.ip,
        instance.port
      );
      if (existingInstance) {
        this.setSelectedInstanceId(existingInstance.id, options);
      } else {
        const newInstance = {
          ...instance,
          id: Date.now().toString(),
          name: instance.name || 'Instance',
          ip: instance.ip,
          port: instance.port,
          candidateHosts: Array.from(
            new Set([instance.ip, ...(instance.candidateHosts || [])].filter(Boolean))
          ),
        };
        this.connection.instances.push(newInstance);
        this.lastCreatedInstanceId = newInstance.id;
        this.setSelectedInstanceId(newInstance.id, options);
      }
    },

    isLastCreatedInstance(id) {
      return this.lastCreatedInstanceId === id;
    },

    updateInstance(id, updatedInstance, options = {}) {
      const index = this.connection.instances.findIndex((i) => i.id === id);
      if (index !== -1) {
        // Merge the existing instance with updated properties
        const mergedInstance = {
          ...this.connection.instances[index],
          ...updatedInstance,
        };
        this.connection.instances[index] = mergedInstance;

        // If the updated instance is the selected one, update connection details
        if (this.selectedInstanceId === id) {
          // Only tear down the live session when the endpoint actually changed;
          // a name-only edit must not kill the connection.
          const endpointChanged =
            this.connection.ip !== mergedInstance.ip ||
            this.connection.port !== mergedInstance.port;
          this.connection.ip = mergedInstance.ip;
          this.connection.port = mergedInstance.port;

          if (endpointChanged) {
            this._applyEndpointChange(options);
          }
        }
      }
    },

    removeInstance(id) {
      this.connection.instances = this.connection.instances.filter((i) => i.id !== id);
      if (this.selectedInstanceId === id) {
        this.selectedInstanceId = null;
      }
    },

    getInstance(id) {
      return this.connection.instances.find((i) => i.id === id);
    },

    getInstanceByNameIpPort(name, ip, port) {
      return this.connection.instances.find(
        (i) => i.name === name && i.ip === ip && i.port === port
      );
    },

    promoteInstanceEndpoint(id, { host, rigId }) {
      const instance = this.getInstance(id);
      if (!instance || !host) return false;

      const candidateHosts = Array.from(
        new Set(
          [
            host,
            instance.ip,
            instance.preferredEndpoint?.host,
            ...(instance.candidateHosts || []),
          ].filter(Boolean)
        )
      );

      instance.rigId = rigId || instance.rigId || '';
      instance.ip = host;
      instance.candidateHosts = candidateHosts;
      instance.preferredEndpoint = {
        protocol: instance.preferredEndpoint?.protocol || 'http',
        host,
        port: instance.port,
      };

      if (this.selectedInstanceId === id) {
        this.connection.ip = host;
        this.connection.port = instance.port;
      }
      return true;
    },

    getInstanceColorByIndex(index) {
      return this.instanceColorClasses[index % this.instanceColorClasses.length];
    },

    getInstanceColorById(id) {
      const index = this.connection.instances.findIndex((i) => i.id === id);
      return index !== -1 ? this.getInstanceColorByIndex(index) : 'bg-gray-900/95';
    },

    setSelectedInstanceId(id, options = {}) {
      const instance = this.getInstance(id);
      // No-op when re-selecting the already-active instance, so tapping the
      // current instance doesn't tear down (or reload) a healthy session.
      if (
        id === this.selectedInstanceId &&
        instance &&
        this.connection.ip === instance.ip &&
        this.connection.port === instance.port
      ) {
        return;
      }
      this.selectedInstanceId = id;
      if (instance) {
        this.connection.ip = instance.ip;
        this.connection.port = instance.port;
        console.log('[SettingsStore] Selected instance set to:', id);

        // Must stay last: this usually reloads the page and never returns.
        this._applyEndpointChange(options);
      }
    },

    setActiveConnection(ip, port, options = {}) {
      this.connection.ip = ip;
      this.connection.port = port;

      this._applyEndpointChange(options);
    },

    setLanguage(lang) {
      this.language = lang;
    },

    getLanguage() {
      return this.language;
    },

    completeTutorial() {
      this.tutorial.completed = true;
      localStorage.setItem('tutorialCompleted', 'true');
    },

    resetTutorial() {
      this.tutorial.completed = false;
      localStorage.removeItem('tutorialCompleted');
    },

    setSetupWizardStep(stepId) {
      this.setupWizard.currentStepId = stepId;
      localStorage.setItem('setupWizardStepId', String(stepId));
    },

    setSetupWizardOpen(isOpen) {
      this.setupWizard.isOpen = isOpen;
    },

    // Cancelling and finishing are the same transaction: the app becomes usable
    // and the wizard stops offering itself. Only the wording differs.
    completeSetupWizard() {
      this.setupWizard.completed = true;
      this.setupWizard.currentStepId = '';
      this.completeSetup();
      localStorage.setItem('setupWizardCompleted', 'true');
      localStorage.removeItem('setupWizardStepId');
    },

    resetSetupWizard() {
      this.setupWizard.completed = false;
      this.setupWizard.currentStepId = '';
      this.setupWizard.openRequest += 1;
      localStorage.removeItem('setupWizardCompleted');
      localStorage.removeItem('setupWizardStepId');
    },

    toggleUnits() {
      this.useImperialUnits = !this.useImperialUnits;
      localStorage.setItem('useImperialUnits', this.useImperialUnits);
    },

    togglePluginsVisibility() {
      this.showPlugins = !this.showPlugins;
    },

    setPhd2ForceCalibration(value) {
      this.guider.phd2ForceCalibration = value;
      this.saveGuiderSettings();
    },

    setPhd2ImageGamma(value) {
      this.guider.phd2ImageGamma = value;
      this.saveGuiderSettings();
    },

    setKeepAwakeEnabled(value) {
      this.keepAwakeEnabled = value;
    },

    setWifiBindingEnabled(value) {
      this.wifiBindingEnabled = value;
    },

    setHistoryTimeRange(startIndex, endIndex) {
      this.monitorViewSetting.historyTimeRange.startIndex = startIndex;
      this.monitorViewSetting.historyTimeRange.endIndex = endIndex;
    },

    resetHistoryTimeRange() {
      this.monitorViewSetting.historyTimeRange.startIndex = 0;
      this.monitorViewSetting.historyTimeRange.endIndex = null;
    },

    setGraphDataSource1(dataSource) {
      this.monitorViewSetting.graphDataSource1 = dataSource;
    },

    setGraphDataSource2(dataSource) {
      this.monitorViewSetting.graphDataSource2 = dataSource;
    },

    setImageFilterTarget(target) {
      this.monitorViewSetting.imageFilter.selectedTarget = target;
      this.monitorViewSetting.imageFilter.selectedFilter = null;
      this.monitorViewSetting.imageFilter.selectedNight = null;
    },
    setImageFilterFilter(filter) {
      this.monitorViewSetting.imageFilter.selectedFilter = filter;
    },
    setImageFilterNight(night) {
      this.monitorViewSetting.imageFilter.selectedNight = night;
    },
    setImageFilterImageType(imageType) {
      this.monitorViewSetting.imageFilter.selectedImageType = imageType;
    },
    resetImageFilter() {
      this.monitorViewSetting.imageFilter.selectedTarget = null;
      this.monitorViewSetting.imageFilter.selectedFilter = null;
      this.monitorViewSetting.imageFilter.selectedNight = null;
      this.monitorViewSetting.imageFilter.selectedImageType = null;
    },

    setModalPosition(modalId, orientation, position) {
      if (!this.modalPositions[modalId]) {
        this.modalPositions[modalId] = {};
      }
      this.modalPositions[modalId][orientation] = { top: position.top, left: position.left };
    },

    setNavbarOrder(order) {
      this.navbar.itemOrder = order;
      this.saveNavbarSettings();
    },

    toggleNavbarItem(id) {
      const idx = this.navbar.hiddenItems.indexOf(id);
      if (idx === -1) {
        this.navbar.hiddenItems.push(id);
      } else {
        this.navbar.hiddenItems.splice(idx, 1);
      }
      this.saveNavbarSettings();
    },

    setStatusBarOrder(order) {
      this.statusbar.itemOrder = order;
      this.saveStatusBarSettings();
    },

    lockScreen() {
      this.screenLock.active = true;
    },

    unlockScreen() {
      this.screenLock.active = false;
    },

    toggleStatusBarItem(id) {
      const idx = this.statusbar.hiddenItems.indexOf(id);
      if (idx === -1) {
        this.statusbar.hiddenItems.push(id);
      } else {
        this.statusbar.hiddenItems.splice(idx, 1);
      }
      this.saveStatusBarSettings();
    },
  },
  // pinia-plugin-persistedstate 4.x uses the store id (`settings`) as the key.
  // Keep the current whole-store behavior so existing installations hydrate without migration.
  persist: true,
});
