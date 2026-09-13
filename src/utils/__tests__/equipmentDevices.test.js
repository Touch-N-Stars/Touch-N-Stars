import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the store's transitive imports touch browser APIs
// at module load.
const { apiStore } = await import('@/store/store');
const apiService = (await import('@/services/apiService')).default;
const {
  apiActionForApiName,
  getIndiDriver,
  isHiddenIndiDriver,
  isOfflineDevice,
  redirectManualFilterWheel,
  reloadIndiDriver,
  resolveReloadedDevice,
  setProfileDevice,
  MANUAL_FILTER_WHEEL_ID,
} = await import('@/utils/equipmentDevices');

// Records every API call the reload makes, in order, and keeps the real methods out of
// the network.
function stubApi(calls) {
  const original = {
    profileChangeValue: apiService.profileChangeValue,
    rotatorAction: apiService.rotatorAction,
  };
  apiService.profileChangeValue = async (path, value) => {
    calls.push(`profileChangeValue:${path}=${value}`);
  };
  apiService.rotatorAction = async (action) => {
    calls.push(`rotatorAction:${action}`);
    return { Response: [], Success: true };
  };
  return () => Object.assign(apiService, original);
}

function setup(indiDriver, calls) {
  freshPinia();
  const store = apiStore();
  store.profileInfo = { RotatorSettings: { IndiDriver: indiDriver } };
  store.fetchProfilInfos = async () => {
    calls.push('fetchProfilInfos');
  };
  return store;
}

test('reloadIndiDriver unloads and reloads the configured driver', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('indi_asi_rotator', calls);

  try {
    assert.equal(await reloadIndiDriver('rotatorAction'), true);
  } finally {
    restore();
  }

  assert.deepEqual(calls, [
    'profileChangeValue:RotatorSettings-IndiDriver=None',
    'rotatorAction:list-devices',
    'profileChangeValue:RotatorSettings-IndiDriver=indi_asi_rotator',
    'rotatorAction:list-devices',
    'fetchProfilInfos',
  ]);
});

test('reloadIndiDriver does nothing when no INDI driver is configured', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('None', calls);

  try {
    assert.equal(await reloadIndiDriver('rotatorAction'), false);
    setup(undefined, calls);
    assert.equal(await reloadIndiDriver('rotatorAction'), false);
  } finally {
    restore();
  }

  assert.deepEqual(calls, []);
});

test('reloadIndiDriver ignores devices without an INDI driver setting', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('indi_asi_rotator', calls);

  try {
    // PHD2 has no IndiDriver, so guiderAction is not part of the map.
    assert.equal(await reloadIndiDriver('guiderAction'), false);
  } finally {
    restore();
  }

  assert.deepEqual(calls, []);
});

test('getIndiDriver reads the driver from the matching profile section', () => {
  const calls = [];
  setup('indi_asi_rotator', calls);
  assert.equal(getIndiDriver('rotatorAction'), 'indi_asi_rotator');
  assert.equal(getIndiDriver('cameraAction'), null);
  assert.equal(getIndiDriver('guiderAction'), null);
});

test('isOfflineDevice detects the category and the label fallback', () => {
  assert.equal(isOfflineDevice({ Category: 'OFFLINE' }), true);
  assert.equal(
    isOfflineDevice({ Category: '', DisplayName: 'ZWO CAA CAA (INDI) (OFFLINE)' }),
    true
  );
  assert.equal(isOfflineDevice({ Category: 'INDI', DisplayName: 'ZWO CAA CAA (INDI)' }), false);
  assert.equal(isOfflineDevice(null), false);
  assert.equal(isOfflineDevice(undefined), false);
  assert.equal(isOfflineDevice({}), false);
});

test('apiActionForApiName bridges the focuser/focus naming mismatch', () => {
  // existingEquipmentList says 'focuser', the rescan key is 'focus'.
  assert.equal(apiActionForApiName('focuser'), 'focusAction');
  assert.equal(apiActionForApiName('rotator'), 'rotatorAction');
  assert.equal(apiActionForApiName('guider'), 'guiderAction');
  assert.equal(apiActionForApiName('nonsense'), null);
});

test('setProfileDevice writes the device id into the profile', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('indi_asi_rotator', calls);

  try {
    assert.equal(await setProfileDevice('rotatorAction', 'No_Device'), true);
  } finally {
    restore();
  }

  assert.deepEqual(calls, ['profileChangeValue:RotatorSettings-Id=No_Device', 'fetchProfilInfos']);
});

test('setProfileDevice uses GuiderName instead of Id for the guider', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('None', calls);

  try {
    assert.equal(await setProfileDevice('guiderAction', 'No_Guider'), true);
  } finally {
    restore();
  }

  // The guider is the only device whose selection is not stored under `Id`.
  assert.deepEqual(calls, [
    'profileChangeValue:GuiderSettings-GuiderName=No_Guider',
    'fetchProfilInfos',
  ]);
});

test('setProfileDevice ignores an unknown apiAction', async () => {
  const calls = [];
  const restore = stubApi(calls);
  setup('None', calls);

  try {
    assert.equal(await setProfileDevice('nonsenseAction', 'No_Device'), false);
  } finally {
    restore();
  }

  assert.deepEqual(calls, []);
});

// --- resolveReloadedDevice --------------------------------------------------
// The OFFLINE entry is a placeholder PINS builds from the profile; the restarted driver
// derives the Id from the INDI device name and need not reproduce it.

const OFFLINE_ENTRY = {
  Id: 'ZWO CAA CAA',
  DisplayName: 'ZWO CAA CAA (INDI) (OFFLINE)',
  Category: 'OFFLINE',
};
const ONLINE_ENTRY = {
  Id: 'ZWO CAA CAA',
  DisplayName: 'ZWO CAA CAA (INDI)',
  Category: 'INDI',
};

test('resolveReloadedDevice matches on the id first', () => {
  const other = { Id: 'other', DisplayName: 'ZWO CAA CAA (INDI)', Category: 'INDI' };
  assert.equal(resolveReloadedDevice(OFFLINE_ENTRY, [other, ONLINE_ENTRY]), ONLINE_ENTRY);
});

test('resolveReloadedDevice falls back to the name without the OFFLINE suffix', () => {
  // The reloaded driver handed out a different id than the profile had stored.
  const stale = { ...OFFLINE_ENTRY, Id: 'stale-profile-id' };
  assert.equal(resolveReloadedDevice(stale, [ONLINE_ENTRY]), ONLINE_ENTRY);
});

test('resolveReloadedDevice treats a still-offline match as unresolved', () => {
  // Reload changed nothing: the hardware really is missing.
  assert.equal(resolveReloadedDevice(OFFLINE_ENTRY, [OFFLINE_ENTRY]), null);

  const stale = { ...OFFLINE_ENTRY, Id: 'stale-profile-id' };
  assert.equal(resolveReloadedDevice(stale, [OFFLINE_ENTRY]), null);
});

test('resolveReloadedDevice never guesses another device', () => {
  const unrelated = { Id: 'other', DisplayName: 'Manual rotator', Category: 'N.I.N.A.' };
  assert.equal(resolveReloadedDevice(OFFLINE_ENTRY, [unrelated]), null);
});

test('resolveReloadedDevice tolerates empty and missing input', () => {
  assert.equal(resolveReloadedDevice(OFFLINE_ENTRY, []), null);
  assert.equal(resolveReloadedDevice(null, [ONLINE_ENTRY]), null);
  assert.equal(resolveReloadedDevice(OFFLINE_ENTRY, null), null);
  assert.equal(resolveReloadedDevice({ Id: 'x' }, [ONLINE_ENTRY]), null);
});

test('isHiddenIndiDriver hides drivers only for their own device type', () => {
  assert.equal(isHiddenIndiDriver('filterwheel', 'indi_manual_wheel'), true);
  assert.equal(isHiddenIndiDriver('focuser', 'indi_gemini_focus'), true);
  assert.equal(isHiddenIndiDriver('focuser', 'indi_manual_wheel'), false);
  assert.equal(isHiddenIndiDriver('filterwheel', 'indi_simulator_wheel'), false);
  assert.equal(isHiddenIndiDriver('camera', 'indi_gemini_focus'), false);
});

// Records the calls redirectManualFilterWheel makes and seeds the filter wheel profile.
function stubFilterApi(calls, indiDriver) {
  const original = {
    profileChangeValue: apiService.profileChangeValue,
    filterAction: apiService.filterAction,
  };
  apiService.profileChangeValue = async (path, value) => {
    calls.push(`profileChangeValue:${path}=${value}`);
  };
  apiService.filterAction = async (action) => {
    calls.push(`filterAction:${action}`);
    return { Response: [], Success: true };
  };

  freshPinia();
  const store = apiStore();
  store.profileInfo = { FilterWheelSettings: { IndiDriver: indiDriver } };
  store.fetchProfilInfos = async () => {
    calls.push('fetchProfilInfos');
  };
  return () => Object.assign(apiService, original);
}

const REDIRECT_CALLS = [
  'profileChangeValue:FilterWheelSettings-IndiDriver=None',
  'filterAction:list-devices',
  `profileChangeValue:FilterWheelSettings-Id=${MANUAL_FILTER_WHEEL_ID}`,
  'fetchProfilInfos',
];

test('redirectManualFilterWheel swaps the configured INDI manual wheel for the NINA one', async () => {
  const calls = [];
  const restore = stubFilterApi(calls, 'indi_manual_wheel');

  try {
    assert.equal(await redirectManualFilterWheel(), MANUAL_FILTER_WHEEL_ID);
  } finally {
    restore();
  }

  assert.deepEqual(calls, REDIRECT_CALLS);
});

test('redirectManualFilterWheel also triggers on the selected device when the profile is clear', async () => {
  const calls = [];
  const restore = stubFilterApi(calls, 'None');

  try {
    const device = { Id: 'Manual Filter', DriverInfo: 'indi_manual_wheel', Category: 'INDI' };
    assert.equal(await redirectManualFilterWheel(device), MANUAL_FILTER_WHEEL_ID);
  } finally {
    restore();
  }

  assert.deepEqual(calls, REDIRECT_CALLS);
});

test('redirectManualFilterWheel leaves other wheels alone', async () => {
  const calls = [];
  const restore = stubFilterApi(calls, 'indi_simulator_wheel');

  try {
    assert.equal(await redirectManualFilterWheel(), null);
    assert.equal(await redirectManualFilterWheel({ Id: 'Manual Filter Wheel' }), null);
    assert.equal(await redirectManualFilterWheel({ DriverInfo: 'n.A.' }), null);
  } finally {
    restore();
  }

  assert.deepEqual(calls, []);
});
