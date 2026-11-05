import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { nextTick } = await import('vue');
const { apiStore } = await import('@/store/store');
const { useCameraStore } = await import('@/store/cameraStore');
const { useSequenceStore } = await import('@/store/sequenceStore');
const { useToastStore } = await import('@/store/toastStore');
const { default: apiService } = await import('@/services/apiService');

const settle = () => new Promise((resolve) => setImmediate(resolve));

const history = (...events) => ({
  Success: true,
  Response: events.map(([Event, minute]) => ({
    Event,
    Time: `2026-11-05T20:${String(minute).padStart(2, '0')}:00Z`,
  })),
});
const DISCONNECTED = history(['CAMERA-DISCONNECTED', 1]);
const CONNECTED = history(['CAMERA-DISCONNECTED', 1], ['CAMERA-CONNECTED', 2]);

const CAMERA = {
  Connected: true,
  CanSetTemperature: true,
  CoolerOn: false,
  HasDewHeater: true,
  DewHeaterOn: false,
  Temperature: 15,
  TemperatureSetPoint: 15,
  TempChangeRunning: false,
};

const PROFILE_A = 'profile-a';
const PROFILE_B = 'profile-b';
const settingKey = (profileId) => `camera_auto_start_${profileId}`;
const stored = (cool, dewHeater = false) => JSON.stringify({ cool, dewHeater });

// A fake backend: `settings` is its key-value store, `profileId` its active profile.
// Records the commanding calls; `results` overrides the answer per method.
function stubBackend(t, results = {}) {
  const backend = {
    settings: {},
    profileId: PROFILE_A,
    calls: [],
    commands: () => backend.calls.filter(([name]) => name !== 'stopCameraWarming'),
  };
  const names = [
    'startCameraCooling',
    'stopCameraWarming',
    'startStoppDewheater',
    'cameraAction',
    'profileAction',
    'getSetting',
    'createSetting',
  ];
  const originals = Object.fromEntries(names.map((name) => [name, apiService[name]]));
  for (const name of ['startCameraCooling', 'stopCameraWarming', 'startStoppDewheater']) {
    apiService[name] = async (...args) => {
      backend.calls.push([name, ...args]);
      return results[name] ?? { Success: true };
    };
  }
  apiService.cameraAction = async () => ({ Success: true, Response: {} });
  apiService.profileAction = async () => ({
    Success: true,
    Response: profileOf(backend.profileId),
  });
  apiService.getSetting = async (key) =>
    key in backend.settings
      ? { Success: true, StatusCode: 200, Response: { Key: key, Value: backend.settings[key] } }
      : (results.getSetting ?? { Success: false, StatusCode: 404, Error: 'not found' });
  apiService.createSetting = async ({ Key, Value }) => {
    if (results.createSetting) return results.createSetting;
    backend.settings[Key] = Value;
    return { Success: true, StatusCode: 200 };
  };
  t.after(() => Object.assign(apiService, originals));
  return backend;
}

function profileOf(Id) {
  return { Id, Name: Id, CameraSettings: { Temperature: -10, CoolingDuration: 5 } };
}

function setup(backend, { cool = true, dewHeater = false } = {}) {
  freshPinia();
  const store = apiStore();
  const cameraStore = useCameraStore();
  // Also empties the module-level payload cache, which outlives a fresh Pinia.
  store.clearAllStates();
  store.profileInfo = { ...store.profileInfo, ...profileOf(backend.profileId) };
  backend.settings[settingKey(backend.profileId)] = stored(cool, dewHeater);
  return { store, cameraStore };
}

async function poll(store, patch = {}) {
  store.cameraInfo = { ...CAMERA, ...patch };
  await nextTick();
  await settle();
  await settle();
}

// The usual session: camera off at attach, then connected while the app watches.
function connect(store) {
  store.processEventHistory(DISCONNECTED);
  store.processEventHistory(CONNECTED);
}

test('a connect seen by the app starts the cooling with the profile target and duration', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store);
  assert.deepEqual(backend.commands(), [['startCameraCooling', -10, 5]]);
  assert.match(useToastStore().currentToast.message, /-10/);
});

test('the option off commands nothing', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend, { cool: false, dewHeater: true });
  connect(store);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a camera already connected when the app attaches is not commanded', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  store.processEventHistory(CONNECTED);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('re-attaching after a lost backend does not count as a connect', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  store.processEventHistory(DISCONNECTED);
  store.clearAllStates();
  store.processEventHistory(CONNECTED);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a cooler that is already on stays as it is', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store, { CoolerOn: true, TemperatureSetPoint: -5, Temperature: -5 });
  assert.deepEqual(backend.calls, []);
});

test('a running ramp is not replaced', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store, { TempChangeRunning: true });
  assert.deepEqual(backend.calls, []);
});

test('the dew heater joins the cooling in one toast when chosen', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend, { dewHeater: true });
  connect(store);
  await poll(store);
  assert.deepEqual(backend.commands(), [
    ['startCameraCooling', -10, 5],
    ['startStoppDewheater', true],
  ]);
  const { message } = useToastStore().currentToast;
  assert.match(message, /-10/);
  assert.match(message, /dew heater/i);
});

test('the dew heater stays off unless chosen, and a heater that is on is not commanded', async (t) => {
  const backend = stubBackend(t);
  const first = setup(backend);
  connect(first.store);
  await poll(first.store);
  assert.deepEqual(backend.commands(), [['startCameraCooling', -10, 5]]);

  backend.calls.length = 0;
  const second = setup(backend, { dewHeater: true });
  connect(second.store);
  await poll(second.store, { DewHeaterOn: true });
  assert.deepEqual(backend.commands(), [['startCameraCooling', -10, 5]]);
});

test('a camera without cooler or dew heater gets no command and no toast', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend, { dewHeater: true });
  connect(store);
  await poll(store, { CanSetTemperature: false, HasDewHeater: false });
  assert.deepEqual(backend.calls, []);
  assert.equal(useToastStore().currentToast, null);
});

test('capabilities reported after Connected still start the action, but only once', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store, { CanSetTemperature: false });
  assert.deepEqual(backend.calls, []);
  await poll(store);
  await poll(store, { Temperature: 14.9 });
  assert.deepEqual(backend.commands(), [['startCameraCooling', -10, 5]]);
});

test('capabilities later than the window start nothing', async (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store, { CanSetTemperature: false });
  t.mock.timers.tick(30000);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a running sequence keeps the camera to itself', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend, { dewHeater: true });
  useSequenceStore().sequenceRunning = true;
  connect(store);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a refused start stays on screen and clears the cooling intent', async (t) => {
  const backend = stubBackend(t, {
    startCameraCooling: { Success: false, Error: 'Camera not connected', StatusCode: 409 },
  });
  const { store, cameraStore } = setup(backend);
  connect(store);
  await poll(store);
  const toast = useToastStore().currentToast;
  assert.equal(toast.type, 'error');
  assert.equal(toast.message, 'Camera not connected');
  assert.equal(toast.autoClose, false);
  assert.equal(cameraStore.coolingPending, null);
});

test('a teardown during the settings read drops the auto start', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  store.clearAllStates();
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a teardown drops an auto start waiting for capabilities', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend);
  connect(store);
  await poll(store, { CanSetTemperature: false });
  store.clearAllStates();
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

// --- per profile and backend ---------------------------------------------------

test('a profile without a stored choice has it off, although another profile is on', async (t) => {
  const backend = stubBackend(t);
  const { store, cameraStore } = setup(backend);
  backend.profileId = PROFILE_B;
  await store.fetchProfilInfos();
  await cameraStore.loadAutoStartConfig();
  assert.deepEqual(cameraStore.autoStartConfig, { cool: false, dewHeater: false });
  connect(store);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('the profile active at the connect decides, even if switched elsewhere just before', async (t) => {
  const backend = stubBackend(t);
  const { store } = setup(backend, { cool: false });
  backend.settings[settingKey(PROFILE_B)] = stored(true);
  backend.profileId = PROFILE_B; // the app has not refreshed the profile yet
  assert.equal(store.profileInfo.Id, PROFILE_A);
  connect(store);
  await poll(store);
  assert.deepEqual(backend.commands(), [['startCameraCooling', -10, 5]]);
});

test('the same profile id on another backend keeps its own value', async (t) => {
  const backend = stubBackend(t);
  const { store, cameraStore } = setup(backend);
  await cameraStore.loadAutoStartConfig();
  assert.equal(cameraStore.autoStartConfig.cool, true);

  store.clearAllStates();
  assert.equal(cameraStore.autoStartConfig, null);
  backend.settings = {}; // the next backend knows nothing about this profile
  await cameraStore.loadAutoStartConfig();
  assert.equal(cameraStore.autoStartConfig.cool, false);
  connect(store);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});

test('a save writes the key of the active profile only', async (t) => {
  const backend = stubBackend(t);
  const { store, cameraStore } = setup(backend, { cool: false });
  backend.settings = {};
  await cameraStore.loadAutoStartConfig();
  await cameraStore.saveAutoStartConfig({ cool: true });
  assert.deepEqual(backend.settings, { [settingKey(PROFILE_A)]: stored(true) });
  assert.equal(store.profileInfo.Id, PROFILE_A);
});

test('a refused save snaps back and says so', async (t) => {
  const backend = stubBackend(t, {
    createSetting: { Success: false, Error: 'Disk full', StatusCode: 500 },
  });
  const { cameraStore } = setup(backend, { cool: false });
  await cameraStore.loadAutoStartConfig();
  await cameraStore.saveAutoStartConfig({ cool: true });
  assert.equal(cameraStore.autoStartConfig.cool, false);
  assert.equal(useToastStore().currentToast.message, 'Disk full');
});

test('an unreadable choice stays unknown and starts nothing', async (t) => {
  const backend = stubBackend(t, { getSetting: { Success: false, StatusCode: 500 } });
  const { store, cameraStore } = setup(backend);
  backend.settings = {};
  await cameraStore.loadAutoStartConfig();
  assert.equal(cameraStore.autoStartConfig, null);
  await cameraStore.saveAutoStartConfig({ cool: true }); // the toggle is disabled, still a no-op
  assert.deepEqual(backend.settings, {});
  connect(store);
  await poll(store);
  assert.deepEqual(backend.calls, []);
});
