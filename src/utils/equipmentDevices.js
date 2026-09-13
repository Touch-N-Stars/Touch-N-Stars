// src/utils/equipmentDevices.js
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';

/**
 * Everything that maps an equipment apiAction onto the device behind it: where its
 * selection lives in the profile, which rescan key it uses, and whether it can be driven
 * by an INDI driver.
 */

// apiAction -> profile section, equipmentStore.rescanTrigger key, profile field holding the
// selected device, and whether the device can run through an INDI driver.
// The guider is the only one whose selection is not stored under `Id`.
export const DEVICE_MAP = {
  cameraAction: { section: 'CameraSettings', rescanKey: 'camera', idKey: 'Id', indi: true },
  mountAction: { section: 'TelescopeSettings', rescanKey: 'mount', idKey: 'Id', indi: true },
  focusAction: { section: 'FocuserSettings', rescanKey: 'focus', idKey: 'Id', indi: true },
  filterAction: { section: 'FilterWheelSettings', rescanKey: 'filter', idKey: 'Id', indi: true },
  rotatorAction: { section: 'RotatorSettings', rescanKey: 'rotator', idKey: 'Id', indi: true },
  switchAction: { section: 'SwitchSettings', rescanKey: 'switch', idKey: 'Id', indi: true },
  weatherAction: { section: 'WeatherDataSettings', rescanKey: 'weather', idKey: 'Id', indi: true },
  flatdeviceAction: {
    section: 'FlatDeviceSettings',
    rescanKey: 'flatdevice',
    idKey: 'Id',
    indi: true,
  },
  domeAction: { section: 'DomeSettings', rescanKey: 'dome', idKey: 'Id', indi: true },
  safetyAction: { section: 'SafetyMonitorSettings', rescanKey: 'safety', idKey: 'Id', indi: true },
  guiderAction: {
    section: 'GuiderSettings',
    rescanKey: 'guider',
    idKey: 'GuiderName',
    indi: false,
  },
};

// existingEquipmentList (store.getExistingEquipment) names the focuser 'focuser', while the
// rescan key is 'focus' — so this cannot be derived from DEVICE_MAP alone.
const API_NAME_TO_ACTION = {
  camera: 'cameraAction',
  mount: 'mountAction',
  focuser: 'focusAction',
  filter: 'filterAction',
  rotator: 'rotatorAction',
  switch: 'switchAction',
  weather: 'weatherAction',
  flatdevice: 'flatdeviceAction',
  dome: 'domeAction',
  safety: 'safetyAction',
  guider: 'guiderAction',
};

export function apiActionForApiName(apiName) {
  return API_NAME_TO_ACTION[apiName] || null;
}

/**
 * Writes the selected device into the profile, the way NINA's own device dropdowns do.
 * Without this the selection would only ever live in the component and get overwritten by
 * the next device list refresh — which also made 'No device' impossible to choose.
 */
export async function setProfileDevice(apiAction, deviceId) {
  const mapping = DEVICE_MAP[apiAction];
  if (!mapping) return false;

  const store = apiStore();
  await apiService.profileChangeValue(`${mapping.section}-${mapping.idKey}`, deviceId);
  await store.fetchProfilInfos();
  return true;
}

/**
 * INDI drivers enumerate their hardware only once, at driver start. A device that gets
 * powered up afterwards (the usual case when a power box switches its ports) is therefore
 * invisible to the already running driver, and PINS lists it from the profile cache with
 * `Category: 'OFFLINE'`. Connecting to such an entry always fails; the only way out is to
 * restart the driver, which is what users currently do by hand in the INDI setup dialog.
 */

/**
 * A device PINS remembers from the profile but cannot see on the INDI server.
 */
export function isOfflineDevice(device) {
  if (!device) return false;
  if (device.Category === 'OFFLINE') return true;
  // Fallback in case the category is not set but the label still carries the marker.
  return typeof device.DisplayName === 'string' && device.DisplayName.endsWith('(OFFLINE)');
}

const OFFLINE_SUFFIX = /\s*\(OFFLINE\)\s*$/;

/**
 * Finds the real device that replaced an OFFLINE placeholder after a driver reload.
 *
 * The placeholder is synthesized by PINS from the profile, so its Id is whatever the profile
 * happened to store — the restarted driver derives the Id from the INDI device name and may
 * well produce a different one. Connecting with the stale Id would fail exactly like before
 * the reload.
 *
 * Matches on the Id first, then on the DisplayName without the '(OFFLINE)' marker
 * ('X (INDI) (OFFLINE)' becomes 'X (INDI)'). Deliberately does not fall back to "the only
 * INDI device in the list": with two devices of the same type that would silently connect
 * something the user never picked.
 *
 * @returns the matching device, or null when it did not come back.
 */
export function resolveReloadedDevice(offlineEntry, devices) {
  if (!offlineEntry || !Array.isArray(devices)) return null;

  const byId = devices.find((d) => String(d.Id) === String(offlineEntry.Id));
  if (byId) return isOfflineDevice(byId) ? null : byId;

  if (typeof offlineEntry.DisplayName !== 'string') return null;
  const name = offlineEntry.DisplayName.replace(OFFLINE_SUFFIX, '');
  if (!name) return null;

  const byName = devices.find((d) => d.DisplayName === name);
  // A match that is still OFFLINE means the reload changed nothing — the hardware really is
  // missing, so this counts as unresolved rather than as something to connect to.
  if (!byName || isOfflineDevice(byName)) return null;
  return byName;
}

/**
 * Returns the configured INDI driver for an apiAction, or null when the device is not
 * INDI-backed (no mapping, no INDI support, no driver, or explicitly 'None').
 */
export function getIndiDriver(apiAction) {
  const mapping = DEVICE_MAP[apiAction];
  if (!mapping || !mapping.indi) return null;
  const store = apiStore();
  const driver = store.profileInfo?.[mapping.section]?.IndiDriver;
  if (!driver || driver === 'None') return null;
  return driver;
}

/**
 * Restarts the INDI driver of a device by unloading it and loading it again — the same
 * sequence selectIndi.vue runs when the user picks a driver, just applied twice.
 *
 * Deliberately does not call equipmentStore.triggerRescan(): that would push the calling
 * selectDevices instance into a concurrent rescan and clash with its fetch generation.
 * Callers refresh their own list afterwards.
 *
 * @returns {Promise<boolean>} true when a reload actually ran.
 */
export async function reloadIndiDriver(apiAction) {
  const mapping = DEVICE_MAP[apiAction];
  const driver = getIndiDriver(apiAction);
  if (!driver) return false;

  const store = apiStore();
  const settingPath = `${mapping.section}-IndiDriver`;

  await apiService.profileChangeValue(settingPath, 'None');
  await apiService[apiAction]('list-devices');
  await apiService.profileChangeValue(settingPath, driver);
  await apiService[apiAction]('list-devices');
  await store.fetchProfilInfos();

  console.log('[equipmentDevices] reloaded', driver, 'for', apiAction);
  return true;
}

// NINA's built-in manual filter wheel. It prompts through MyMessageBox, which PINS forwards
// to the app's message box modal — so this is the one manual wheel that actually asks the
// user to swap the filter.
export const MANUAL_FILTER_WHEEL_ID = 'Manual Filter Wheel';

// The INDI counterpart. It never opens a dialog: it parks FILTER_SLOT in Busy and waits for
// someone to press its CONFIRM_FILTER_SET switch, which nothing in NINA or the app does. The
// filter change then hangs until the move times out. The plugin server lists it under the
// same label as NINA's wheel, so the app hides it and redirects existing selections.
export const INDI_MANUAL_WHEEL_DRIVER = 'indi_manual_wheel';

// INDI drivers the app does not offer, per getINDIDeviceList device type. Gemini focusers
// run through indi_myfocuserpro2_focus (renamed 'Gemini / MyFocuserPro2' in the dropdowns).
const HIDDEN_INDI_DRIVERS = {
  filterwheel: [INDI_MANUAL_WHEEL_DRIVER],
  focuser: ['indi_gemini_focus'],
};

export function isHiddenIndiDriver(deviceType, driverName) {
  return (HIDDEN_INDI_DRIVERS[deviceType] || []).includes(driverName);
}

/**
 * Swaps a configured INDI manual wheel for NINA's built-in one before a connect: unloads
 * the driver, refreshes the device list and writes the new Id into the profile. Triggered by
 * the profile's IndiDriver or, when the profile was already cleared, by the selected device's
 * DriverInfo.
 *
 * Like reloadIndiDriver, this does not call equipmentStore.triggerRescan(); callers refresh
 * their own list.
 *
 * @returns {Promise<string|null>} the new device Id, or null when nothing had to change.
 */
export async function redirectManualFilterWheel(device = null) {
  const isIndiManualWheel =
    getIndiDriver('filterAction') === INDI_MANUAL_WHEEL_DRIVER ||
    device?.DriverInfo === INDI_MANUAL_WHEEL_DRIVER;
  if (!isIndiManualWheel) return null;

  const { section } = DEVICE_MAP.filterAction;
  await apiService.profileChangeValue(`${section}-IndiDriver`, 'None');
  await apiService.filterAction('list-devices');
  await setProfileDevice('filterAction', MANUAL_FILTER_WHEEL_ID);

  console.log(
    '[equipmentDevices] redirected',
    INDI_MANUAL_WHEEL_DRIVER,
    'to',
    MANUAL_FILTER_WHEEL_ID
  );
  return MANUAL_FILTER_WHEEL_ID;
}
