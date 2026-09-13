import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { createPoller } from '@/utils/poller';
import { useStatusBarStore } from '@/store/statusBarStore';

export const useGuiderStore = defineStore('guiderStore', {
  state: () => ({
    guidecamOk: false,
    guidecamManualVnc: false,
    RADistanceRaw: [],
    DECDistanceRaw: [],
    raDuration: [],
    decDuration: [],
    chartInfo: [],

    phd2Connection: [],
    phd2Status: [],
    phd2StarLostInfo: [],
    phd2StarLost: false,
    isFetchingPhd2Infos: false,
    phd2EquipmentProfiles: [],
    phd2CurrentEquipment: [],
    phd2IsConnected: false,
    phd2StarInfo: null,
    phd2CalibrationMessage: null,

    // PHD2 Camera State (PINS)
    phd2Cameras: [],
    phd2SelectedCameraIndex: null,
    phd2SelectedCameraName: null,
    phd2CamerasLoading: false,

    // PHD2 Mount State (PINS)
    phd2Mounts: [],
    phd2SelectedMountIndex: null,
    phd2SelectedMountName: null,
    phd2MountsLoading: false,

    // PHD2 Focal Length State (PINS)
    phd2FocalLength: null,
    phd2FocalLengthLoading: false,

    // PHD2 Calibration Step State (PINS)
    phd2CalibrationStep: null,
    phd2CalibrationStepLoading: false,

    // PHD2 Calibration Distance State (PINS)
    phd2CalibrationDistance: null,
    phd2CalibrationDistanceLoading: false,

    // PHD2 Reverse DEC After Flip State (PINS)
    phd2ReverseDecAfterFlip: false,
    phd2ReverseDecAfterFlipLoading: false,

    // PHD2 Use Multiple Stars State (PINS)
    phd2UseMultipleStars: false,
    phd2UseMultipleStarsLoading: false,

    // PHD2 Shared Parameters State (PINS)
    phd2FastRecenter: false,
    phd2FastRecenterLoading: false,
    phd2MountGuideOutput: false,
    phd2MountGuideOutputLoading: false,

    // PHD2 Dither State (PINS)
    phd2DitherMode: 'random',
    phd2DitherModeLoading: false,
    phd2DitherRaOnly: false,
    phd2DitherRaOnlyLoading: false,
    phd2DitherScale: null,
    phd2DitherScaleLoading: false,

    // PHD2 Guide Algorithm RA State (PINS)
    phd2GuideAlgorithmRA: null,
    phd2GuideAlgorithmRALoading: false,

    // PHD2 Guide Algorithm DEC State (PINS)
    phd2GuideAlgorithmDEC: null,
    phd2GuideAlgorithmDECLoading: false,

    // PHD2 Camera Gain State (PINS)
    phd2CameraGain: null,
    phd2CameraGainLoading: false,

    // PHD2 Camera Binning State (PINS)
    phd2CameraBinning: null,
    phd2CameraBinningLoading: false,

    // PHD2 Pixel Size State (PINS)
    phd2PixelSize: null,

    // PHD2 Pixel Scale State (PINS) - arcsec/px as PHD2 itself computes it
    phd2PixelScale: null,

    // PHD2 Restore Calibration State (PINS)
    phd2RestoreCalibration: false,
    phd2RestoreCalibrationLoading: false,

    // PHD2 Star Detection State (PINS)
    phd2SearchRegion: null,
    phd2SearchRegionLoading: false,
    phd2MinStarHFD: null,
    phd2MinStarHFDLoading: false,
    phd2MaxStarHFD: null,
    phd2MaxStarHFDLoading: false,
    phd2MassChangeEnabled: false,
    phd2MassChangeEnabledLoading: false,
    phd2MassChangeThreshold: null,
    phd2MassChangeThresholdLoading: false,
    phd2BacklashEnabled: false,
    phd2BacklashPulseWidth: null,
    phd2BacklashFloor: null,
    phd2BacklashCeiling: null,
    phd2BacklashLoading: false,
    phd2MinStarSNR: null,
    phd2MinStarSNRLoading: false,
    phd2AutoSelectDownsample: 'Auto',
    phd2AutoSelectDownsampleLoading: false,
    phd2SaturationByADU: false,
    phd2SaturationByADULoading: false,
    phd2SaturationADUValue: null,
    phd2SaturationADUValueLoading: false,
    phd2BeepForLostStar: false,
    phd2BeepForLostStarLoading: false,

    // PHD2 Calibration Options State (PINS)
    phd2AssumeDecOrthogonal: false,
    phd2AssumeDecOrthogonalLoading: false,
    phd2UseDecCompensation: false,
    phd2UseDecCompensationLoading: false,

    // Mount Guide Rate State (PINS)
    mountGuideRateRA: null,
    mountGuideRateDec: null,
    mountCanSetGuideRate: false,
    mountGuideRateLoading: false,

    // PHD2 Dark Library State (PINS)
    phd2DarkLibraryInfo: null,
    phd2DarkLibraryInfoLoading: false,
    phd2DarkLibraryBuildStatus: null,
    phd2DarkLibraryBuildLoading: false,
    phd2DarkLibraryPollHandle: null,
    phd2DarkLibraryLastResult: null,
  }),
  getters: {
    isDarkLibraryBuildActive(state) {
      return state.phd2DarkLibraryBuildStatus?.Active === true;
    },
    // The graph flyout is one of the status bar panels; keep the old name so
    // the poller and the graph components need not know about the status bar.
    showGuiderGraph() {
      return useStatusBarStore().isPanelOpen('guider');
    },
  },
  actions: {
    async fetchGraphInfos() {
      const store = apiStore();
      try {
        if (!store.isBackendReachable) {
          console.warn('Backend is not reachable log');
          return;
        }
        // Only fetch the (large) guide-step history while the graph flyout is
        // actually open — it is its only consumer. The PHD2 status below keeps
        // polling regardless, because the status bar star-lost indicator
        // depends on it.
        if (this.showGuiderGraph) {
          const response = await apiService.guiderAction('graph');
          this.chartInfo = response.Response;
        }
      } catch (error) {
        console.error('Error fetching the information:', error);
      }
      if (store.guiderInfo?.DeviceId === 'PHD2_Single' && store.isBackendReachable) {
        this.fetchPhd2Infos();
      }
    },

    // PINS only: the official ninaAPI build has no graph/clear route.
    async clearGraph() {
      const store = apiStore();
      if (!store.isPINS) return;
      try {
        await apiService.guiderClearGraph();
        // Refresh immediately so the chart empties without waiting for the 1s poll tick.
        await this.fetchGraphInfos();
      } catch (error) {
        console.error('Error clearing the guider graph:', error);
        throw error;
      }
    },

    async fetchPhd2Infos() {
      if (this.isFetchingPhd2Infos) {
        return;
      }

      this.isFetchingPhd2Infos = true;
      try {
        const response1 = await apiService.getPhd2AllInfos();

        this.phd2Connection = response1.Response?.Connection;

        if (!this.phd2Connection.IsConnected) {
          await apiService.connectPHD2();
          return;
        }
        const response2 = await apiService.getPhd2CurrentEquipment();

        this.phd2Status = response1.Response.Status;
        //console.log('appstate' , response1.Response.Status);

        this.phd2StarLostInfo = response1.Response.StarLostInfo;

        const mainStore = apiStore();
        const phd2AppState = response1.Response.Status?.AppState;

        // Only flag star lost if PHD2 itself says LostLock — not during a normal stop
        // (PHD2 briefly emits StarLost before GuidingStopped when stopping intentionally)
        this.phd2StarLost =
          phd2AppState === 'LostLock' &&
          this.checkStarLostByState(phd2AppState, mainStore.guiderInfo?.State);
        if (this.phd2StarLost) {
          console.log('Star lost');
          console.log(this.phd2StarLostInfo);

          // Prüfe, ob die Seite kürzlich aus dem Hintergrund zurückgekehrt ist
          if (!mainStore.isPageRecentlyReturnedFromBackground()) {
            console.log('Show star lost toast');
          } else {
            console.log('Page recently returned from background, skipping star lost toast');
          }
        }

        this.phd2EquipmentProfiles = response1.Response.EquipmentProfiles;

        // Calibration step message from PHD2 Calibrating events
        const calStep = response1.Response.Status?.CalibrationStep;
        this.phd2CalibrationMessage = calStep?.Message || null;

        // Show star profile only when get_star_image succeeded (StarImage.Available = true),
        // which means PHD2 actually has a star selected/tracked right now.
        // Use top-level StarInfo (direct from CurrentStar events) as it's more up-to-date;
        // fall back to StarImage.StarInfo. Only show when Available=true (star actively tracked).
        const starImageInfo = response1.Response.StarImage;
        const topLevelStarInfo = response1.Response.StarInfo;
        this.phd2StarInfo = starImageInfo?.Available
          ? topLevelStarInfo || starImageInfo?.StarInfo || null
          : null;

        this.phd2CurrentEquipment = response2.Response.CurrentEquipment;
        this.phd2IsConnected =
          this.phd2CurrentEquipment.camera?.connected || this.phd2CurrentEquipment.mount?.connected;
      } catch (error) {
        console.error('Error fetching the information:', error);
      } finally {
        this.isFetchingPhd2Infos = false;
      }
    },

    checkStarLostByState(phd2AppState, guiderState) {
      const normalizedPhd2Status = String(phd2AppState || '').toLowerCase();
      const normalizedGuiderState = String(guiderState || '').toLowerCase();

      return (
        normalizedPhd2Status.includes('lostlock') || normalizedGuiderState.includes('lostlock')
      );
    },

    startFetching() {
      console.log('Start fetching graph data...');
      if (!this._graphPoller) {
        this._graphPoller = createPoller(() => this.fetchGraphInfos(), 1000);
      }
      this._graphPoller.start();
    },

    stopFetching() {
      console.log('Stop fetching graph data...');
      this._graphPoller?.stop();
    },

    isFetchingGraph() {
      return this._graphPoller?.isRunning() ?? false;
    },

    async setPHD2Profil(id) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2Profil');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SelectedProfile(id);
        if (response.Success && response.Response) {
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 profile:', error);
        throw error;
      }
    },

    // PHD2 Camera Actions (PINS)
    async fetchPHD2Cameras() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2CamerasLoading = true;
      try {
        const response = await apiPinsService.getPHD2CameraList();
        if (response.Success && response.Response) {
          this.phd2Cameras = response.Response.Cameras;
          this.phd2SelectedCameraIndex = response.Response.SelectedIndex;
          this.phd2SelectedCameraName = response.Response.Cameras[response.Response.SelectedIndex];
        }
      } catch (error) {
        console.error('Error fetching PHD2 cameras:', error);
      } finally {
        this.phd2CamerasLoading = false;
      }
    },

    async setPHD2Camera(index) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2Camera');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SelectedCamera(index);
        if (response.Success && response.Response) {
          this.phd2SelectedCameraIndex = response.Response.Index;
          this.phd2SelectedCameraName = response.Response.Name;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 camera:', error);
        throw error;
      }
    },

    async refreshPHD2SelectedCamera() {
      const store = apiStore();
      if (!store.isPINS) return;
      try {
        const response = await apiPinsService.getPHD2SelectedCamera();
        if (response.Success && response.Response) {
          this.phd2SelectedCameraIndex = response.Response.Index;
          this.phd2SelectedCameraName = response.Response.Name;
        }
      } catch (error) {
        console.error('Error refreshing PHD2 selected camera:', error);
      }
    },

    // PHD2 Mount Actions (PINS)
    async fetchPHD2Mounts() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MountsLoading = true;
      try {
        const response = await apiPinsService.getPHD2MountList();
        if (response.Success && response.Response) {
          this.phd2Mounts = response.Response.Mounts;
          this.phd2SelectedMountIndex = response.Response.SelectedIndex;
          this.phd2SelectedMountName = response.Response.Mounts[response.Response.SelectedIndex];
        }
      } catch (error) {
        console.error('Error fetching PHD2 mounts:', error);
      } finally {
        this.phd2MountsLoading = false;
      }
    },

    async setPHD2Mount(index) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2Mount');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SelectedMount(index);
        if (response.Success && response.Response) {
          this.phd2SelectedMountIndex = response.Response.Index;
          this.phd2SelectedMountName = response.Response.Name;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 mount:', error);
        throw error;
      }
    },

    async refreshPHD2SelectedMount() {
      const store = apiStore();
      if (!store.isPINS) return;
      try {
        const response = await apiPinsService.getPHD2SelectedMount();
        if (response.Success && response.Response) {
          this.phd2SelectedMountIndex = response.Response.Index;
          this.phd2SelectedMountName = response.Response.Name;
        }
      } catch (error) {
        console.error('Error refreshing PHD2 selected mount:', error);
      }
    },

    // PHD2 Focal Length Actions (PINS)
    async fetchPHD2FocalLength() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2FocalLengthLoading = true;
      try {
        const response = await apiPinsService.getPHD2Focallength();
        if (response.Success && response.Response) {
          this.phd2FocalLength = response.Response.FocalLength;
        }
      } catch (error) {
        console.error('Error fetching PHD2 focal length:', error);
      } finally {
        this.phd2FocalLengthLoading = false;
      }
    },

    async setPHD2FocalLength(focalLength) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2FocalLength');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2Focallength(focalLength);
        if (response.Success && response.Response) {
          this.phd2FocalLength = response.Response.FocalLength;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 focal length:', error);
        throw error;
      }
    },

    // PHD2 Calibration Step Actions (PINS)
    async fetchPHD2CalibrationStep() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2CalibrationStepLoading = true;
      try {
        const response = await apiPinsService.getPHD2CalibrationStep();
        if (response.Success && response.Response) {
          this.phd2CalibrationStep = response.Response.CalibrationStep;
        }
      } catch (error) {
        console.error('Error fetching PHD2 calibration step:', error);
      } finally {
        this.phd2CalibrationStepLoading = false;
      }
    },

    async setPHD2CalibrationStep(calibrationStep) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2CalibrationStep');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2CalibrationStep(calibrationStep);
        if (response.Success && response.Response) {
          this.phd2CalibrationStep = response.Response.CalibrationStep;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 calibration step:', error);
        throw error;
      }
    },

    async fetchPHD2CalibrationDistance() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2CalibrationDistanceLoading = true;
      try {
        const response = await apiPinsService.getPHD2CalibrationDistance();
        if (response.Success && response.Response) {
          this.phd2CalibrationDistance = response.Response.CalibrationDistance;
        }
      } catch (error) {
        console.error('Error fetching PHD2 calibration distance:', error);
      } finally {
        this.phd2CalibrationDistanceLoading = false;
      }
    },

    async setPHD2CalibrationDistance(calibrationDistance) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2CalibrationDistance');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2CalibrationDistance(calibrationDistance);
        if (response.Success && response.Response) {
          this.phd2CalibrationDistance = response.Response.CalibrationDistance;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 calibration distance:', error);
        throw error;
      }
    },

    // PHD2 Reverse DEC After Flip Actions (PINS)
    async fetchPHD2ReverseDecAfterFlip() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2ReverseDecAfterFlipLoading = true;
      try {
        const response = await apiPinsService.getPHD2ReverseDecAfterFlip();
        if (response.Success && response.Response) {
          this.phd2ReverseDecAfterFlip = response.Response.ReverseDecAfterFlip;
        }
      } catch (error) {
        console.error('Error fetching PHD2 reverse DEC after flip:', error);
      } finally {
        this.phd2ReverseDecAfterFlipLoading = false;
      }
    },

    async setPHD2ReverseDecAfterFlip(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2ReverseDecAfterFlip');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2ReverseDecAfterFlip(enabled);
        if (response.Success && response.Response) {
          this.phd2ReverseDecAfterFlip = response.Response.ReverseDecAfterFlip;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 reverse DEC after flip:', error);
        throw error;
      }
    },

    // PHD2 Fast Recenter Actions (PINS)
    async fetchPHD2FastRecenter() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2FastRecenterLoading = true;
      try {
        const response = await apiPinsService.getPHD2FastRecenter();
        if (response.Success && response.Response) {
          this.phd2FastRecenter = response.Response.FastRecenterEnabled;
        }
      } catch (error) {
        console.error('Error fetching PHD2 fast recenter:', error);
      } finally {
        this.phd2FastRecenterLoading = false;
      }
    },

    async setPHD2FastRecenter(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2FastRecenter');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2FastRecenter(enabled);
        if (response.Success && response.Response) {
          this.phd2FastRecenter = response.Response.FastRecenterEnabled;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 fast recenter:', error);
        throw error;
      }
    },

    // PHD2 Mount Guide Output Actions (PINS)
    async fetchPHD2MountGuideOutput() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MountGuideOutputLoading = true;
      try {
        const response = await apiPinsService.getPHD2MountGuideOutput();
        if (response.Success && response.Response) {
          this.phd2MountGuideOutput = response.Response.MountGuideOutputEnabled;
        }
      } catch (error) {
        console.error('Error fetching PHD2 mount guide output:', error);
      } finally {
        this.phd2MountGuideOutputLoading = false;
      }
    },

    async setPHD2MountGuideOutput(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MountGuideOutput');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MountGuideOutput(enabled);
        if (response.Success && response.Response) {
          this.phd2MountGuideOutput = response.Response.MountGuideOutputEnabled;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 mount guide output:', error);
        throw error;
      }
    },

    // PHD2 Dither Mode Actions (PINS)
    async fetchPHD2DitherMode() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2DitherModeLoading = true;
      try {
        const response = await apiPinsService.getPHD2DitherMode();
        if (response.Success && response.Response) {
          this.phd2DitherMode = response.Response.DitherMode;
        }
      } catch (error) {
        console.error('Error fetching PHD2 dither mode:', error);
      } finally {
        this.phd2DitherModeLoading = false;
      }
    },

    async setPHD2DitherMode(mode) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2DitherMode');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2DitherMode(mode);
        if (response.Success && response.Response) {
          this.phd2DitherMode = response.Response.DitherMode;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 dither mode:', error);
        throw error;
      }
    },

    // PHD2 Dither RA Only Actions (PINS)
    async fetchPHD2DitherRaOnly() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2DitherRaOnlyLoading = true;
      try {
        const response = await apiPinsService.getPHD2DitherRaOnly();
        if (response.Success && response.Response) {
          this.phd2DitherRaOnly = response.Response.DitherRaOnly;
        }
      } catch (error) {
        console.error('Error fetching PHD2 dither RA only:', error);
      } finally {
        this.phd2DitherRaOnlyLoading = false;
      }
    },

    async setPHD2DitherRaOnly(raOnly) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2DitherRaOnly');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2DitherRaOnly(raOnly);
        if (response.Success && response.Response) {
          this.phd2DitherRaOnly = response.Response.DitherRaOnly;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 dither RA only:', error);
        throw error;
      }
    },

    // PHD2 Dither Scale Actions (PINS)
    async fetchPHD2DitherScale() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2DitherScaleLoading = true;
      try {
        const response = await apiPinsService.getPHD2DitherScale();
        if (response.Success && response.Response) {
          this.phd2DitherScale = response.Response.DitherScale;
        }
      } catch (error) {
        console.error('Error fetching PHD2 dither scale:', error);
      } finally {
        this.phd2DitherScaleLoading = false;
      }
    },

    async setPHD2DitherScale(scale) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2DitherScale');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2DitherScale(scale);
        if (response.Success && response.Response) {
          this.phd2DitherScale = response.Response.DitherScale;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 dither scale:', error);
        throw error;
      }
    },

    // PHD2 Use Multiple Stars Actions (PINS)
    async fetchPHD2UseMultipleStars() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2UseMultipleStarsLoading = true;
      try {
        const response = await apiPinsService.getPHD2UseMultipleStars();
        if (response.Success && response.Response) {
          this.phd2UseMultipleStars = response.Response.UseMultipleStars;
        }
      } catch (error) {
        console.error('Error fetching PHD2 use multiple stars:', error);
      } finally {
        this.phd2UseMultipleStarsLoading = false;
      }
    },

    async setPHD2UseMultipleStars(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2UseMultipleStars');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2UseMultipleStars(enabled);
        if (response.Success && response.Response) {
          this.phd2UseMultipleStars = response.Response.UseMultipleStars;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 use multiple stars:', error);
        throw error;
      }
    },

    // PHD2 Guide Algorithm RA Actions (PINS)
    async fetchPHD2GuideAlgorithmRA() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2GuideAlgorithmRALoading = true;
      try {
        const response = await apiPinsService.getPHD2GuideAlgorithmRA();
        if (response.Success && response.Response) {
          this.phd2GuideAlgorithmRA = response.Response.GuideAlgorithmRA;
        }
      } catch (error) {
        console.error('Error fetching PHD2 guide algorithm RA:', error);
      } finally {
        this.phd2GuideAlgorithmRALoading = false;
      }
    },

    async setPHD2GuideAlgorithmRA(algorithm) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2GuideAlgorithmRA');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2GuideAlgorithmRA(algorithm);
        if (response.Success && response.Response) {
          this.phd2GuideAlgorithmRA = response.Response.GuideAlgorithmRA;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 guide algorithm RA:', error);
        throw error;
      }
    },

    // PHD2 Guide Algorithm DEC Actions (PINS)
    async fetchPHD2GuideAlgorithmDEC() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2GuideAlgorithmDECLoading = true;
      try {
        const response = await apiPinsService.getPHD2GuideAlgorithmDEC();
        if (response.Success && response.Response) {
          this.phd2GuideAlgorithmDEC = response.Response.GuideAlgorithmDEC;
        }
      } catch (error) {
        console.error('Error fetching PHD2 guide algorithm DEC:', error);
      } finally {
        this.phd2GuideAlgorithmDECLoading = false;
      }
    },

    async setPHD2GuideAlgorithmDEC(algorithm) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2GuideAlgorithmDEC');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2GuideAlgorithmDEC(algorithm);
        if (response.Success && response.Response) {
          this.phd2GuideAlgorithmDEC = response.Response.GuideAlgorithmDEC;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 guide algorithm DEC:', error);
        throw error;
      }
    },

    // PHD2 Camera Gain Actions (PINS)
    async fetchPHD2CameraGain() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2CameraGainLoading = true;
      try {
        const response = await apiPinsService.getPHD2CameraGain();
        if (response.Success && response.Response) {
          this.phd2CameraGain = response.Response.CameraGain;
        }
      } catch (error) {
        console.error('Error fetching PHD2 camera gain:', error);
      } finally {
        this.phd2CameraGainLoading = false;
      }
    },

    async setPHD2CameraGain(gain) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2CameraGain');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2CameraGain(gain);
        if (response.Success && response.Response) {
          this.phd2CameraGain = response.Response.CameraGain;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 camera gain:', error);
        throw error;
      }
    },

    // PHD2 Camera Binning Actions (PINS)
    async fetchPHD2CameraBinning() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2CameraBinningLoading = true;
      try {
        const response = await apiPinsService.getPHD2CameraBinning();
        if (response.Success && response.Response) {
          this.phd2CameraBinning = response.Response.CameraBinning;
        }
      } catch (error) {
        console.error('Error fetching PHD2 camera binning:', error);
      } finally {
        this.phd2CameraBinningLoading = false;
      }
    },

    async setPHD2CameraBinning(binning) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2CameraBinning');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2CameraBinning(binning);
        if (response.Success && response.Response) {
          this.phd2CameraBinning = response.Response.CameraBinning;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 camera binning:', error);
        throw error;
      }
    },

    async fetchPHD2PixelSize() {
      const store = apiStore();
      if (!store.isPINS) return;
      try {
        const response = await apiPinsService.getPHD2CameraInfo();
        if (response.Success && response.Response) {
          this.phd2PixelSize = response.Response.pixel_size ?? null;
        }
      } catch (error) {
        console.error('Error fetching PHD2 pixel size:', error);
      }
    },

    async fetchPHD2PixelScale() {
      const store = apiStore();
      if (!store.isPINS) return;
      try {
        const response = await apiPinsService.getPHD2PixelScale();
        if (response.Success && response.Response) {
          this.phd2PixelScale = response.Response.PixelScale ?? null;
        }
      } catch (error) {
        console.error('Error fetching PHD2 pixel scale:', error);
      }
    },

    // PHD2 Restore Calibration Actions (PINS)
    async fetchPHD2RestoreCalibration() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2RestoreCalibrationLoading = true;
      try {
        const response = await apiPinsService.getPHD2RestoreCalibration();
        if (response.Success && response.Response) {
          this.phd2RestoreCalibration = response.Response.AutoRestoreCalibration;
        }
      } catch (error) {
        console.error('Error fetching PHD2 restore calibration:', error);
      } finally {
        this.phd2RestoreCalibrationLoading = false;
      }
    },

    async setPHD2RestoreCalibration(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2RestoreCalibration');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2RestoreCalibration(enabled);
        if (response.Success && response.Response) {
          this.phd2RestoreCalibration = response.Response.AutoRestoreCalibration;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 restore calibration:', error);
        throw error;
      }
    },

    // PHD2 Search Region Actions (PINS)
    async fetchPHD2SearchRegion() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2SearchRegionLoading = true;
      try {
        const response = await apiPinsService.getPHD2SearchRegion();
        if (response.Success && response.Response) {
          this.phd2SearchRegion = response.Response.SearchRegion;
        }
      } catch (error) {
        console.error('Error fetching PHD2 search region:', error);
      } finally {
        this.phd2SearchRegionLoading = false;
      }
    },

    async setPHD2SearchRegion(pixels) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2SearchRegion');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SearchRegion(pixels);
        if (response.Success && response.Response) {
          this.phd2SearchRegion = response.Response.SearchRegion;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 search region:', error);
        throw error;
      }
    },

    // PHD2 Min Star HFD Actions (PINS)
    async fetchPHD2MinStarHFD() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MinStarHFDLoading = true;
      try {
        const response = await apiPinsService.getPHD2MinStarHFD();
        if (response.Success && response.Response) {
          this.phd2MinStarHFD = response.Response.MinStarHFR;
        }
      } catch (error) {
        console.error('Error fetching PHD2 min star HFD:', error);
      } finally {
        this.phd2MinStarHFDLoading = false;
      }
    },

    async setPHD2MinStarHFD(hfd) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MinStarHFD');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MinStarHFD(hfd);
        if (response.Success && response.Response) {
          this.phd2MinStarHFD = response.Response.MinStarHFR;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 min star HFD:', error);
        throw error;
      }
    },

    // PHD2 Max Star HFD Actions (PINS)
    async fetchPHD2MaxStarHFD() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MaxStarHFDLoading = true;
      try {
        const response = await apiPinsService.getPHD2MaxStarHFD();
        if (response.Success && response.Response) {
          this.phd2MaxStarHFD = response.Response.MaxStarHFR;
        }
      } catch (error) {
        console.error('Error fetching PHD2 max star HFD:', error);
      } finally {
        this.phd2MaxStarHFDLoading = false;
      }
    },

    async setPHD2MaxStarHFD(hfd) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MaxStarHFD');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MaxStarHFD(hfd);
        if (response.Success && response.Response) {
          this.phd2MaxStarHFD = response.Response.MaxStarHFR;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 max star HFD:', error);
        throw error;
      }
    },

    // PHD2 Mass Change Threshold Enabled Actions (PINS)
    async fetchPHD2MassChangeEnabled() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MassChangeEnabledLoading = true;
      try {
        const response = await apiPinsService.getPHD2MassChangeEnabled();
        if (response.Success && response.Response) {
          this.phd2MassChangeEnabled = response.Response.MassChangeThresholdEnabled;
        }
      } catch (error) {
        console.error('Error fetching PHD2 mass change enabled:', error);
      } finally {
        this.phd2MassChangeEnabledLoading = false;
      }
    },

    async setPHD2MassChangeEnabled(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MassChangeEnabled');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MassChangeEnabled(enabled);
        if (response.Success && response.Response) {
          this.phd2MassChangeEnabled = response.Response.MassChangeThresholdEnabled;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 mass change enabled:', error);
        throw error;
      }
    },

    // PHD2 Mass Change Threshold Actions (PINS)
    async fetchPHD2MassChangeThreshold() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MassChangeThresholdLoading = true;
      try {
        const response = await apiPinsService.getPHD2MassChangeThreshold();
        if (response.Success && response.Response) {
          this.phd2MassChangeThreshold = response.Response.MassChangeThreshold;
        }
      } catch (error) {
        console.error('Error fetching PHD2 mass change threshold:', error);
      } finally {
        this.phd2MassChangeThresholdLoading = false;
      }
    },

    async setPHD2MassChangeThreshold(threshold) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MassChangeThreshold');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MassChangeThreshold(threshold);
        if (response.Success && response.Response) {
          this.phd2MassChangeThreshold = response.Response.MassChangeThreshold;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 mass change threshold:', error);
        throw error;
      }
    },

    // PHD2 Backlash Compensation Actions (PINS)
    async fetchPHD2BacklashComp() {
      const store = apiStore();
      // All four backlash components share this single endpoint and call it on mount,
      // so guard against duplicate concurrent requests in the same tick.
      if (!store.isPINS || this.phd2BacklashLoading) return;
      this.phd2BacklashLoading = true;
      try {
        const response = await apiPinsService.getPHD2BacklashComp();
        if (response.Success && response.Response) {
          this.phd2BacklashEnabled = response.Response.Enabled;
          this.phd2BacklashPulseWidth = response.Response.PulseWidth;
          this.phd2BacklashFloor = response.Response.Floor;
          this.phd2BacklashCeiling = response.Response.Ceiling;
        }
      } catch (error) {
        console.error('Error fetching PHD2 backlash comp:', error);
      } finally {
        this.phd2BacklashLoading = false;
      }
    },

    async setPHD2BacklashEnabled(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2BacklashEnabled');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2BacklashEnabled(enabled);
        if (response.Success && response.Response) {
          // PUT echoes back only the sent field; fall back to the sent value if it is null.
          this.phd2BacklashEnabled = response.Response.Enabled ?? enabled;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 backlash enabled:', error);
        throw error;
      }
    },

    async setPHD2BacklashPulseWidth(pulseWidth) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2BacklashPulseWidth');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2BacklashPulseWidth(pulseWidth);
        if (response.Success) {
          // PHD2 may silently clamp limits to its valid range, so reload the real state.
          await this.fetchPHD2BacklashComp();
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 backlash pulse width:', error);
        throw error;
      }
    },

    async setPHD2BacklashFloor(floor) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2BacklashFloor');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2BacklashFloor(floor);
        if (response.Success) {
          await this.fetchPHD2BacklashComp();
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 backlash floor:', error);
        throw error;
      }
    },

    async setPHD2BacklashCeiling(ceiling) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2BacklashCeiling');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2BacklashCeiling(ceiling);
        if (response.Success) {
          await this.fetchPHD2BacklashComp();
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 backlash ceiling:', error);
        throw error;
      }
    },

    // PHD2 Auto-Find Min Star SNR Actions (PINS)
    async fetchPHD2MinStarSNR() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2MinStarSNRLoading = true;
      try {
        const response = await apiPinsService.getPHD2MinStarSNR();
        if (response.Success && response.Response) {
          this.phd2MinStarSNR = response.Response.AFMinStarSNR;
        }
      } catch (error) {
        console.error('Error fetching PHD2 min star SNR:', error);
      } finally {
        this.phd2MinStarSNRLoading = false;
      }
    },

    async setPHD2MinStarSNR(snr) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2MinStarSNR');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2MinStarSNR(snr);
        if (response.Success && response.Response) {
          this.phd2MinStarSNR = response.Response.AFMinStarSNR;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 min star SNR:', error);
        throw error;
      }
    },

    // PHD2 Auto-Select Downsample Actions (PINS)
    async fetchPHD2AutoSelectDownsample() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2AutoSelectDownsampleLoading = true;
      try {
        const response = await apiPinsService.getPHD2AutoSelectDownsample();
        if (response.Success && response.Response) {
          this.phd2AutoSelectDownsample = response.Response.AutoSelectDownsample;
        }
      } catch (error) {
        console.error('Error fetching PHD2 auto-select downsample:', error);
      } finally {
        this.phd2AutoSelectDownsampleLoading = false;
      }
    },

    async setPHD2AutoSelectDownsample(value) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2AutoSelectDownsample');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2AutoSelectDownsample(value);
        if (response.Success && response.Response) {
          this.phd2AutoSelectDownsample = response.Response.AutoSelectDownsample;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 auto-select downsample:', error);
        throw error;
      }
    },

    // PHD2 Saturation by ADU Actions (PINS)
    async fetchPHD2SaturationByADU() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2SaturationByADULoading = true;
      try {
        const response = await apiPinsService.getPHD2SaturationByADU();
        if (response.Success && response.Response) {
          this.phd2SaturationByADU = response.Response.SaturationByADU;
        }
      } catch (error) {
        console.error('Error fetching PHD2 saturation by ADU:', error);
      } finally {
        this.phd2SaturationByADULoading = false;
      }
    },

    async setPHD2SaturationByADU(byAdu) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2SaturationByADU');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SaturationByADU(byAdu);
        if (response.Success && response.Response) {
          this.phd2SaturationByADU = response.Response.SaturationByADU;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 saturation by ADU:', error);
        throw error;
      }
    },

    // PHD2 Saturation ADU Value Actions (PINS)
    async fetchPHD2SaturationADUValue() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2SaturationADUValueLoading = true;
      try {
        const response = await apiPinsService.getPHD2SaturationADUValue();
        if (response.Success && response.Response) {
          this.phd2SaturationADUValue = response.Response.SaturationADUValue;
        }
      } catch (error) {
        console.error('Error fetching PHD2 saturation ADU value:', error);
      } finally {
        this.phd2SaturationADUValueLoading = false;
      }
    },

    async setPHD2SaturationADUValue(aduValue) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2SaturationADUValue');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2SaturationADUValue(aduValue);
        if (response.Success && response.Response) {
          this.phd2SaturationADUValue = response.Response.SaturationADUValue;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 saturation ADU value:', error);
        throw error;
      }
    },

    // PHD2 Beep For Lost Star Actions (PINS)
    async fetchPHD2BeepForLostStar() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2BeepForLostStarLoading = true;
      try {
        const response = await apiPinsService.getPHD2BeepForLostStar();
        if (response.Success && response.Response) {
          this.phd2BeepForLostStar = response.Response.BeepForLostStar;
        }
      } catch (error) {
        console.error('Error fetching PHD2 beep for lost star:', error);
      } finally {
        this.phd2BeepForLostStarLoading = false;
      }
    },

    async setPHD2BeepForLostStar(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2BeepForLostStar');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2BeepForLostStar(enabled);
        if (response.Success && response.Response) {
          this.phd2BeepForLostStar = response.Response.BeepForLostStar;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 beep for lost star:', error);
        throw error;
      }
    },

    // PHD2 Assume Dec Orthogonal Actions (PINS)
    async fetchPHD2AssumeDecOrthogonal() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2AssumeDecOrthogonalLoading = true;
      try {
        const response = await apiPinsService.getPHD2AssumeDecOrthogonal();
        if (response.Success && response.Response) {
          this.phd2AssumeDecOrthogonal = response.Response.AssumeDecOrthogonal;
        }
      } catch (error) {
        console.error('Error fetching PHD2 assume dec orthogonal:', error);
      } finally {
        this.phd2AssumeDecOrthogonalLoading = false;
      }
    },

    async setPHD2AssumeDecOrthogonal(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2AssumeDecOrthogonal');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2AssumeDecOrthogonal(enabled);
        if (response.Success && response.Response) {
          this.phd2AssumeDecOrthogonal = response.Response.AssumeDecOrthogonal;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 assume dec orthogonal:', error);
        throw error;
      }
    },

    // PHD2 Use Dec Compensation Actions (PINS)
    async fetchPHD2UseDecCompensation() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2UseDecCompensationLoading = true;
      try {
        const response = await apiPinsService.getPHD2UseDecCompensation();
        if (response.Success && response.Response) {
          this.phd2UseDecCompensation = response.Response.UseDecCompensation;
        }
      } catch (error) {
        console.error('Error fetching PHD2 use dec compensation:', error);
      } finally {
        this.phd2UseDecCompensationLoading = false;
      }
    },

    async setPHD2UseDecCompensation(enabled) {
      if (this.isDarkLibraryBuildActive) {
        console.warn('PHD2 dark library build active – aborting setPHD2UseDecCompensation');
        return;
      }
      try {
        const response = await apiPinsService.setPHD2UseDecCompensation(enabled);
        if (response.Success && response.Response) {
          this.phd2UseDecCompensation = response.Response.UseDecCompensation;
          return response;
        }
      } catch (error) {
        console.error('Error setting PHD2 use dec compensation:', error);
        throw error;
      }
    },

    // PHD2 Profile Management Actions
    async createPHD2Profile(profileName) {
      try {
        const response = await apiPinsService.createPHD2Profile(profileName);
        if (response.Success && response.Response) {
          // Reload profiles list after creation
          const profilesResponse = await apiService.getPhd2Profile();
          if (profilesResponse.Response && profilesResponse.Response.EquipmentProfiles) {
            this.phd2EquipmentProfiles = profilesResponse.Response.EquipmentProfiles;
          }
          return response;
        }
      } catch (error) {
        console.error('Error creating PHD2 profile:', error);
        throw error;
      }
    },

    async renamePHD2Profile(newName, profileId) {
      try {
        console.log('Renaming profile ID', profileId, 'to', newName);
        await this.setPHD2Profil(profileId);
        const response = await apiPinsService.renamePHD2Profile(newName);
        if (response.Success) {
          // Reload profiles list after rename
          const profilesResponse = await apiService.getPhd2Profile();
          if (profilesResponse.Response && profilesResponse.Response.EquipmentProfiles) {
            this.phd2EquipmentProfiles = profilesResponse.Response.EquipmentProfiles;
          }
          return response;
        }
      } catch (error) {
        console.error('Error renaming PHD2 profile:', error);
        throw error;
      }
    },

    async deletePHD2Profile(profileName) {
      try {
        // Validate that at least 2 profiles exist before deletion
        if (this.phd2EquipmentProfiles.length <= 1) {
          throw new Error('Cannot delete the last profile');
        }

        // Get current profile before deletion
        const currentProfileResponse = await apiService.getPhd2CurrentProfile();
        const currentProfileName = currentProfileResponse.Response?.Profile?.name;
        const isCurrentProfileDeleted = currentProfileName === profileName;

        // Delete the profile
        const response = await apiPinsService.deletePHD2Profile(profileName);
        if (response.Success) {
          // Reload profiles list after deletion
          const profilesResponse = await apiService.getPhd2Profile();
          if (profilesResponse.Response && profilesResponse.Response.EquipmentProfiles) {
            this.phd2EquipmentProfiles = profilesResponse.Response.EquipmentProfiles;

            // If current profile was deleted, switch to first available profile
            if (isCurrentProfileDeleted && this.phd2EquipmentProfiles.length > 0) {
              const newProfileId = 1; // First profile ID is 1
              await this.setPHD2Profil(newProfileId);

              // Reload all PHD2 settings
              await this.fetchPHD2Cameras();
              await this.refreshPHD2SelectedMount();
              await this.fetchPHD2FocalLength();
              await this.fetchPHD2CalibrationStep();
              await this.fetchPHD2ReverseDecAfterFlip();
              await this.fetchPHD2UseMultipleStars();
              await this.fetchPHD2GuideAlgorithmRA();
              await this.fetchPHD2GuideAlgorithmDEC();
            }
          }
          return response;
        }
      } catch (error) {
        console.error('Error deleting PHD2 profile:', error);
        throw error;
      }
    },

    // PHD2 Dark Library Actions (PINS)
    async fetchPHD2DarkLibraryInfo() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.phd2DarkLibraryInfoLoading = true;
      try {
        const response = await apiPinsService.getPHD2DarkLibraryInfo();
        if (response.Success && response.Response) {
          this.phd2DarkLibraryInfo = response.Response;
        }
      } catch (error) {
        console.error('Error fetching PHD2 dark library info:', error);
      } finally {
        this.phd2DarkLibraryInfoLoading = false;
      }
    },

    async fetchPHD2DarkLibraryBuildStatus() {
      const store = apiStore();
      if (!store.isPINS) return null;
      try {
        const response = await apiPinsService.getPHD2DarkLibraryBuildStatus();
        if (response.Success && response.Response) {
          this.phd2DarkLibraryBuildStatus = response.Response;
          return response.Response;
        }
      } catch (error) {
        console.error('Error fetching PHD2 dark library build status:', error);
      }
      return null;
    },

    startDarkLibraryBuildPolling() {
      if (this.phd2DarkLibraryPollHandle) return;
      this.phd2DarkLibraryPollHandle = createPoller(async () => {
        const status = await this.fetchPHD2DarkLibraryBuildStatus();
        if (!status || status.Complete) {
          this.stopDarkLibraryBuildPolling();
          if (status) {
            this.phd2DarkLibraryLastResult = {
              success: status.Success === true,
              error: status.Error || null,
              frame: status.Frame,
              totalFrames: status.TotalFrames,
            };
          }
          await this.fetchPHD2DarkLibraryInfo();
          if (this.phd2DarkLibraryBuildStatus) {
            this.phd2DarkLibraryBuildStatus = {
              ...this.phd2DarkLibraryBuildStatus,
              Active: false,
            };
          }
        }
      }, 1000);
      this.phd2DarkLibraryPollHandle.start();
    },

    stopDarkLibraryBuildPolling() {
      this.phd2DarkLibraryPollHandle?.stop();
      this.phd2DarkLibraryPollHandle = null;
    },

    isDarkLibraryBuildPolling() {
      return this.phd2DarkLibraryPollHandle?.isRunning() === true;
    },

    async buildPHD2DarkLibrary(expTimesMs, frameCount) {
      this.phd2DarkLibraryBuildLoading = true;
      this.phd2DarkLibraryLastResult = null;
      try {
        const response = await apiPinsService.buildPHD2DarkLibrary(expTimesMs, frameCount);
        if (response.Success) {
          this.phd2DarkLibraryBuildStatus = {
            Active: true,
            Complete: false,
            Frame: 0,
            TotalFrames: expTimesMs.length * frameCount,
            ExposureMs: expTimesMs[0],
          };
          this.startDarkLibraryBuildPolling();
        }
        return response;
      } catch (error) {
        console.error('Error starting PHD2 dark library build:', error);
        throw error;
      } finally {
        this.phd2DarkLibraryBuildLoading = false;
      }
    },

    async cancelPHD2DarkLibraryBuild() {
      try {
        const response = await apiPinsService.cancelPHD2DarkLibraryBuild();
        return response;
      } catch (error) {
        console.error('Error cancelling PHD2 dark library build:', error);
        throw error;
      }
    },

    async loadPHD2DarkLibrary() {
      if (this.isDarkLibraryBuildActive) return;
      try {
        const response = await apiPinsService.loadPHD2DarkLibrary();
        await this.fetchPHD2DarkLibraryInfo();
        return response;
      } catch (error) {
        console.error('Error loading PHD2 dark library:', error);
        throw error;
      }
    },

    async unloadPHD2DarkLibrary() {
      if (this.isDarkLibraryBuildActive) return;
      try {
        const response = await apiPinsService.unloadPHD2DarkLibrary();
        await this.fetchPHD2DarkLibraryInfo();
        return response;
      } catch (error) {
        console.error('Error unloading PHD2 dark library:', error);
        throw error;
      }
    },

    async deletePHD2DarkLibrary() {
      if (this.isDarkLibraryBuildActive) return;
      try {
        const response = await apiPinsService.deletePHD2DarkLibrary();
        await this.fetchPHD2DarkLibraryInfo();
        return response;
      } catch (error) {
        console.error('Error deleting PHD2 dark library:', error);
        throw error;
      }
    },

    async fetchMountGuideRate() {
      const store = apiStore();
      if (!store.isPINS) return;
      this.mountGuideRateLoading = true;
      try {
        const response = await apiService.getMountGuideRate();
        if (response?.success) {
          this.mountGuideRateRA = response.raSiderealMultiplier;
          this.mountGuideRateDec = response.decSiderealMultiplier;
          this.mountCanSetGuideRate = response.canSetGuideRate ?? false;
        }
      } catch (error) {
        console.error('Error fetching mount guide rate:', error);
      } finally {
        this.mountGuideRateLoading = false;
      }
    },

    async setMountGuideRate(raSiderealMultiplier, decSiderealMultiplier) {
      try {
        return await apiService.setMountGuideRate(raSiderealMultiplier, decSiderealMultiplier);
      } catch (error) {
        console.error('Error setting mount guide rate:', error);
        throw error;
      }
    },

    // Disconnect and reconnect the guider (e.g. to apply settings that only take
    // effect on reconnect, like PHD2 auto-restore calibration).
    async reconnectGuider() {
      try {
        await apiService.guiderAction('disconnect');
        // Give NINA/PHD2 a moment to fully tear down the connection before
        // reconnecting, otherwise the connect can race the pending disconnect.
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await apiService.guiderAction('connect');
      } catch (error) {
        console.error('Error reconnecting guider:', error);
        throw error;
      }
    },
  },
});
