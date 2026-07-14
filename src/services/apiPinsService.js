import axios from 'axios';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { getDeviceDateTimePayload } from '@/utils/pinsTimeUtils';

const PINS_PORT = 8000;
const PINS_TOKEN = 'zZDqJ3IKeFaIZqG2JIFvsxzA5E48GC2gyGVagHFZqC0OMtgoupUDZCPhQDYKm35d';

const getBaseUrl = () => {
  const settingsStore = useSettingsStore();
  const store = apiStore();
  const protocol = settingsStore.backendProtocol || 'http';
  const host = settingsStore.connection.ip || window.location.hostname;
  let port = settingsStore.connection.port || window.location.port || 80;
  const apiPort = store.apiPort;

  // devport auf 5000 umleiten
  const isDev = import.meta.env.DEV;
  if (isDev && port === 8080) {
    port = 5000;
  }

  return {
    base: `${protocol}://${host}:${apiPort}/v2/api`,
    api: `${protocol}://${host}:${port}/api/`,
    targetpic: `${protocol}://${host}:${port}/api/targetpic`,
    pluginServer: `${protocol}://${host}:${port}`,
    pinsSystem: `${protocol}://${host}:${PINS_PORT}`,
    pinsDaemon: `${protocol}://${host}:8000`,
  };
};

const getUrls = () => {
  const urls = getBaseUrl();
  return {
    BASE_URL: urls.base,
    API_URL: urls.api,
    TARGETPIC_URL: urls.targetpic,
    PLUGINSERVER_URL: urls.pluginServer,
    PINS_SYSTEM_URL: urls.pinsSystem,
    PINSDAEMON_URL: urls.pinsDaemon,
  };
};

export default {
  //-------------------System Time Sync------------------------
  async fetchSystemTime() {
    const { PINS_SYSTEM_URL } = getUrls();
    try {
      const response = await axios.get(`${PINS_SYSTEM_URL}/system/time`, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
        },
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system time:', error);
      return null;
    }
  },

  async setSystemTime(timestamp) {
    const { PINS_SYSTEM_URL } = getUrls();
    try {
      const payload =
        typeof timestamp === 'number'
          ? getDeviceDateTimePayload(new Date(timestamp * 1000))
          : timestamp;

      await axios.post(`${PINS_SYSTEM_URL}/system/time`, payload, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      return true;
    } catch (error) {
      console.error('Failed to set system time:', error);
      return false;
    }
  },

  async fetchSystemTemperature() {
    const { PINS_SYSTEM_URL } = getUrls();
    try {
      const response = await axios.get(`${PINS_SYSTEM_URL}/system/temperature`, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
        },
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system temperature:', error);
      return null;
    }
  },

  //-------------------INDI------------------------
  //query the list of available INDI devices for a given type
  //(focuser, filterwheel, rotator, telescope, weather switches, flatpanel.)
  getINDIDeviceList(device) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}indi/${device}`);
  },

  //-------------------INDI Control Panel------------------------
  // List INDI devices currently live on the embedded indiserver (loaded drivers only).
  getINDIActiveDevices() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}indi/devices`);
  },

  // Full property tree for all devices, or a single device when `device` is provided.
  getINDIProperties(device) {
    const { API_URL } = getUrls();
    const url = device
      ? `${API_URL}indi/properties?device=${encodeURIComponent(device)}`
      : `${API_URL}indi/properties`;
    return this._simpleGetRequest(url);
  },

  // Ask the server to re-send property definitions for all devices, or a single device.
  refreshINDIProperties(device) {
    const { API_URL } = getUrls();
    const url = device
      ? `${API_URL}indi/properties/refresh?device=${encodeURIComponent(device)}`
      : `${API_URL}indi/properties/refresh`;
    return this._simplePostRequest(url, {});
  },

  // Write a writable property. `elements` is a map of element name -> value
  // (number, string, or boolean for switches).
  setINDIProperty(device, property, elements) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}indi/properties/set`, {
      device,
      property,
      elements,
    });
  },

  // Recent human-readable INDI messages (driver/server log lines), oldest first.
  getINDIMessages(limit = 200) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}indi/messages?limit=${encodeURIComponent(limit)}`);
  },

  //-------------------Focuser------------------------
  focuserAction(action) {
    const { BASE_URL } = getUrls();
    return this._simpleGetRequest(`${BASE_URL}/equipment/focuser/${action}`);
  },

  //-------------------PHD2------------------------

  getPHD2CameraList() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/list`);
  },

  getPHD2SelectedCamera() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/selected`);
  },

  setPHD2SelectedCamera(index) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/camera/selected`, { index });
  },

  getPHD2MountList() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/mount/list`);
  },

  getPHD2SelectedMount() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/mount/selected`);
  },

  setPHD2SelectedMount(index) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/mount/selected`, { index });
  },

  getPHD2Focallength() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/focal-length`);
  },

  setPHD2Focallength(focalLength) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/focal-length`, { focalLength });
  },

  getPHD2CalibrationStep() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/step`);
  },

  setPHD2CalibrationStep(calibrationStep) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/step`, { calibrationStep });
  },

  getPHD2CalibrationDistance() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/distance`);
  },

  setPHD2CalibrationDistance(calibrationDistance) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/distance`, { calibrationDistance });
  },

  getPHD2ReverseDecAfterFlip() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/reverse-dec-after-flip`);
  },

  setPHD2ReverseDecAfterFlip(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/reverse-dec-after-flip`, { enabled });
  },

  getPHD2FastRecenter() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/fast-recenter`);
  },

  setPHD2FastRecenter(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/fast-recenter`, { enabled });
  },

  getPHD2MountGuideOutput() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/mount-guide-output`);
  },

  setPHD2MountGuideOutput(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/mount-guide-output`, { enabled });
  },

  getPHD2DitherMode() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/guide/dither-mode`);
  },

  setPHD2DitherMode(mode) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/guide/dither-mode`, { mode });
  },

  getPHD2DitherRaOnly() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/guide/dither-ra-only`);
  },

  setPHD2DitherRaOnly(raOnly) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/guide/dither-ra-only`, { ra_only: raOnly });
  },

  getPHD2DitherScale() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/guide/dither-scale`);
  },

  setPHD2DitherScale(scale) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/guide/dither-scale`, { scale });
  },

  getPHD2UseMultipleStars() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/multistar`);
  },

  setPHD2UseMultipleStars(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/multistar`, { enabled });
  },

  getPHD2GuideAlgorithmRA() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/guide/algorithm-ra`);
  },

  setPHD2GuideAlgorithmRA(algorithm) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/guide/algorithm-ra`, { algorithm });
  },

  getPHD2GuideAlgorithmDEC() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/guide/algorithm-dec`);
  },

  setPHD2GuideAlgorithmDEC(algorithm) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/guide/algorithm-dec`, { algorithm });
  },

  getAlgoParamNames(axis) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(
      `${API_URL}phd2/get-algo-param-names?axis=${encodeURIComponent(axis)}`
    );
  },

  getAlgoParam(axis, name) {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(
      `${API_URL}phd2/get-algo-param?axis=${encodeURIComponent(axis)}&name=${encodeURIComponent(name)}`
    );
  },

  getDecGuideMode() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/get-dec-guide-mode`);
  },

  setDecGuideMode(mode) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/set-dec-guide-mode`, { mode });
  },

  getMaxRaDuration() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/get-max-ra-duration`);
  },

  setMaxRaDuration(ms) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/set-max-ra-duration`, { ms });
  },

  getMaxDecDuration() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/get-max-dec-duration`);
  },

  setMaxDecDuration(ms) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/set-max-dec-duration`, { ms });
  },

  setPHD2SelectedProfile(id) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/profile/select`, { id });
  },

  renamePHD2Profile(name) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/profile/rename`, { name });
  },

  deletePHD2Profile(name) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/profile/delete`, { name });
  },

  createPHD2Profile(name) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/profile/create`, { name });
  },

  getGuideCam() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/ids`);
  },

  // TPPA/OAT (OpenAstroTech polar alignment) plugin settings
  getTppaOatOptions() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}tppa/oat/options`);
  },
  postTppaOatOptions(options) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}tppa/oat/options`, options);
  },
  postTppaOatReset() {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}tppa/oat/reset`, {});
  },

  getPHD2CameraGain() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/gain`);
  },

  setPHD2CameraGain(gain) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/camera/gain`, { gain });
  },

  getPHD2CameraBinning() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/binning`);
  },

  setPHD2CameraBinning(binning) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/camera/binning`, { binning });
  },

  getPHD2CameraInfo() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/info`);
  },

  getPHD2RestoreCalibration() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/auto-restore`);
  },

  setPHD2RestoreCalibration(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/auto-restore`, { enabled });
  },

  getPHD2AssumeDecOrthogonal() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/assume-dec-orthogonal`);
  },

  setPHD2AssumeDecOrthogonal(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/assume-dec-orthogonal`, { enabled });
  },

  getPHD2UseDecCompensation() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/calibration/use-dec-compensation`);
  },

  setPHD2UseDecCompensation(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/calibration/use-dec-compensation`, { enabled });
  },

  //-------------------PHD2 Star Detection------------------------

  getPHD2SearchRegion() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/search-region`);
  },

  setPHD2SearchRegion(pixels) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/search-region`, { pixels });
  },

  getPHD2MinStarHFD() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/min-star-hfr`);
  },

  setPHD2MinStarHFD(hfd) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/min-star-hfr`, { hfr: hfd });
  },

  getPHD2MaxStarHFD() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/max-star-hfr`);
  },

  setPHD2MaxStarHFD(hfd) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/max-star-hfr`, { hfr: hfd });
  },

  getPHD2MassChangeEnabled() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/star-mass-detection`);
  },

  setPHD2MassChangeEnabled(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/star-mass-detection`, { enabled });
  },

  getPHD2MassChangeThreshold() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/star-mass-detection/threshold`);
  },

  setPHD2MassChangeThreshold(threshold) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/star-mass-detection/threshold`, {
      threshold,
    });
  },

  getPHD2BacklashComp() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/backlash/comp`);
  },

  setPHD2BacklashEnabled(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/backlash/comp`, { enabled });
  },

  setPHD2BacklashPulseWidth(pulseWidth) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/backlash/comp`, { pulseWidth });
  },

  setPHD2BacklashFloor(floor) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/backlash/comp`, { floor });
  },

  setPHD2BacklashCeiling(ceiling) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/backlash/comp`, { ceiling });
  },

  getPHD2MinStarSNR() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/min-star-snr`);
  },

  setPHD2MinStarSNR(snr) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/min-star-snr`, { snr });
  },

  getPHD2AutoSelectDownsample() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/downsample`);
  },

  setPHD2AutoSelectDownsample(value) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/downsample`, { value });
  },

  getPHD2SaturationByADU() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/saturation-by-adu`);
  },

  setPHD2SaturationByADU(byAdu) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/camera/saturation-by-adu`, { by_adu: byAdu });
  },

  getPHD2SaturationADUValue() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/camera/saturation-adu-value`);
  },

  setPHD2SaturationADUValue(aduValue) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/camera/saturation-adu-value`, {
      adu_value: aduValue,
    });
  },

  getPHD2BeepForLostStar() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/tracking/beep-for-lost-star`);
  },

  setPHD2BeepForLostStar(enabled) {
    const { API_URL } = getUrls();
    return this._simplePutRequest(`${API_URL}phd2/tracking/beep-for-lost-star`, { enabled });
  },

  //-------------------PHD2 Dark Library------------------------

  getPHD2DarkLibraryInfo() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/dark-library/info`);
  },

  loadPHD2DarkLibrary() {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/dark-library/load`, {});
  },

  unloadPHD2DarkLibrary() {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/dark-library/unload`, {});
  },

  deletePHD2DarkLibrary() {
    const { API_URL } = getUrls();
    return this._simpleDeleteRequest(`${API_URL}phd2/dark-library`);
  },

  buildPHD2DarkLibrary(expTimesMs, frameCount) {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/dark-library/build`, {
      expTimesMs,
      frameCount,
    });
  },

  cancelPHD2DarkLibraryBuild() {
    const { API_URL } = getUrls();
    return this._simplePostRequest(`${API_URL}phd2/dark-library/cancel-build`, {});
  },

  getPHD2DarkLibraryBuildStatus() {
    const { API_URL } = getUrls();
    return this._simpleGetRequest(`${API_URL}phd2/dark-library/build-status`);
  },

  //-------------------PINS Daemon ASTAP------------------------

  getAstapStarDatabases({ onlyNotInstalled = true, q } = {}) {
    const { PINSDAEMON_URL } = getUrls();
    const params = {
      onlyNotInstalled,
      ...(q?.trim() ? { q: q.trim() } : {}),
    };

    return this._pinsDaemonGetRequest('/packages/astap/stardatabases', {
      baseUrl: PINSDAEMON_URL,
      params,
      timeout: 15000,
    });
  },

  installAstapStarDatabase(databaseId) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      '/packages/astap/stardatabases/install',
      {
        databaseId,
      },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 30000,
      }
    );
  },

  getPinsDaemonJob(jobId) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest(`/jobs/${jobId}`, {
      baseUrl: PINSDAEMON_URL,
      timeout: 8000,
    });
  },

  getPinsDaemonLatestJob() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/jobs/latest', {
      baseUrl: PINSDAEMON_URL,
      timeout: 8000,
    });
  },

  getPinsIndi3rdpartyPackages({ onlyNotInstalled = true, q } = {}) {
    const { PINSDAEMON_URL } = getUrls();
    const params = {
      onlyNotInstalled,
      ...(q?.trim() ? { q: q.trim() } : {}),
    };

    return this._pinsDaemonGetRequest('/packages/indi3rdparty', {
      baseUrl: PINSDAEMON_URL,
      params,
      timeout: 15000,
    });
  },

  installPinsIndi3rdparty(payload) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest('/packages/indi3rdparty/install', payload, {
      baseUrl: PINSDAEMON_URL,
      timeout: 30000,
    });
  },

  getPinsIndi3rdpartyRegistry() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/packages/indi3rdparty/registry', {
      baseUrl: PINSDAEMON_URL,
      timeout: 15000,
    });
  },

  updatePinsIndi3rdpartyRegistryEntry(entryName, payload) {
    const { PINSDAEMON_URL } = getUrls();
    const normalizedEntryName = String(entryName || '').trim();
    if (!normalizedEntryName) {
      throw new Error('entryName is required to update INDI registry entry.');
    }

    return this._pinsDaemonPatchRequest(
      `/packages/indi3rdparty/registry/${encodeURIComponent(normalizedEntryName)}`,
      payload,
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 15000,
      }
    );
  },

  getPinsPlugins() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/plugins', {
      baseUrl: PINSDAEMON_URL,
      timeout: 15000,
    });
  },

  runPinsPluginAction(action, packageName) {
    const normalizedAction = String(action || '').toLowerCase();
    if (normalizedAction !== 'install' && normalizedAction !== 'uninstall') {
      throw new Error(`Unsupported plugin action: ${action}`);
    }

    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      `/plugins/${normalizedAction}`,
      { packageName },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 15000,
      }
    );
  },

  getPinsUpdatesCheck() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/updates/check', {
      baseUrl: PINSDAEMON_URL,
      timeout: 10000,
    });
  },

  getPinsSambaStatus() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/samba', {
      baseUrl: PINSDAEMON_URL,
      timeout: 5000,
    });
  },

  setPinsSambaStatus(enable) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      '/samba',
      { enable },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 5000,
      }
    );
  },

  getPinsPhd2Status() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/phd2', {
      baseUrl: PINSDAEMON_URL,
      timeout: 5000,
    });
  },

  setPinsPhd2Status(enable) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      '/phd2',
      { enable },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 10000,
      }
    );
  },

  getPinsDhcpClients() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/clients', {
      baseUrl: PINSDAEMON_URL,
      timeout: 5000,
    });
  },

  getPinsWifiStatus() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/status', {
      baseUrl: PINSDAEMON_URL,
      timeout: 5000,
    });
  },

  scanPinsWifi() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/scan', {
      baseUrl: PINSDAEMON_URL,
      timeout: 15000,
    });
  },

  connectPinsWifi(payload) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest('/wifi/connect', payload, {
      baseUrl: PINSDAEMON_URL,
      timeout: 30000,
    });
  },

  disablePinsWifi() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest('/wifi/disable', null, {
      baseUrl: PINSDAEMON_URL,
      timeout: 30000,
    });
  },

  startPinsUpgrade({ dryRun = false } = {}) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      '/upgrade',
      { dryRun },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 5000,
      }
    );
  },

  getPinsWifiAdapters() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/adapters', {
      baseUrl: PINSDAEMON_URL,
      timeout: 10000,
    });
  },

  getPinsWifiInterfaces() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/interfaces', {
      baseUrl: PINSDAEMON_URL,
      timeout: 10000,
    });
  },

  setPinsWifiInterfaces({ clientInterface = null, hotspotInterface = null } = {}) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest(
      '/wifi/interfaces',
      {
        client_interface: clientInterface,
        hotspot_interface: hotspotInterface,
      },
      {
        baseUrl: PINSDAEMON_URL,
        timeout: 10000,
      }
    );
  },

  getPinsHotspotSettings() {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonGetRequest('/wifi/hotspot/settings', {
      baseUrl: PINSDAEMON_URL,
      timeout: 8000,
    });
  },

  setPinsHotspotSettings(payload) {
    const { PINSDAEMON_URL } = getUrls();
    return this._pinsDaemonPostRequest('/wifi/hotspot/settings', payload, {
      baseUrl: PINSDAEMON_URL,
      timeout: 30000,
    });
  },

  // Private method for simple GET requests
  _simpleGetRequest(url) {
    return axios
      .get(url)
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  // Private method for simple PUT requests
  _simplePutRequest(url, data) {
    return axios
      .put(url, data)
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  // Private method for simple POST requests
  _simplePostRequest(url, data) {
    return axios
      .post(url, data)
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  // Private method for simple DELETE requests
  _simpleDeleteRequest(url) {
    return axios
      .delete(url)
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  _pinsDaemonGetRequest(path, { baseUrl, params, timeout = 10000 } = {}) {
    return axios
      .get(`${baseUrl}${path}`, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
        },
        params,
        timeout,
      })
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  _pinsDaemonPostRequest(path, data, { baseUrl, timeout = 10000 } = {}) {
    return axios
      .post(`${baseUrl}${path}`, data, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout,
      })
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },

  _pinsDaemonPatchRequest(path, data, { baseUrl, timeout = 10000 } = {}) {
    return axios
      .patch(`${baseUrl}${path}`, data, {
        headers: {
          Authorization: `Bearer ${PINS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout,
      })
      .then((response) => response.data)
      .catch((error) => {
        throw error;
      });
  },
};
