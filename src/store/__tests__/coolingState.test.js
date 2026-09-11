import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { nextTick } = await import('vue');
const { apiStore } = await import('@/store/store');
const { useCameraStore } = await import('@/store/cameraStore');
const { default: apiService } = await import('@/services/apiService');

// Stub the four cooler endpoints for one test; restored afterwards.
function stubCoolerApi(t, impl = async () => ({ Success: true })) {
  const names = [
    'startCameraCooling',
    'stopCameraCooling',
    'startCameraWarming',
    'stopCameraWarming',
  ];
  const originals = Object.fromEntries(names.map((n) => [n, apiService[n]]));
  for (const n of names) apiService[n] = impl;
  t.after(() => Object.assign(apiService, originals));
}

async function poll(store, patch) {
  store.cameraInfo = { ...store.cameraInfo, ...patch };
  await nextTick();
}

function setup(cameraInfo = {}, cameraSettings = null) {
  freshPinia();
  const store = apiStore();
  const cameraStore = useCameraStore();
  if (cameraSettings) {
    store.profileInfo = {
      ...store.profileInfo,
      CameraSettings: { ...store.profileInfo.CameraSettings, ...cameraSettings },
    };
  }
  store.cameraInfo = {
    Connected: true,
    CanSetTemperature: true,
    CoolerOn: false,
    AtTargetTemp: false,
    Temperature: 15,
    TemperatureSetPoint: 15,
    ...cameraInfo,
  };
  return { store, cameraStore };
}

// --- real state via TempChangeRunning (PINS / newer ninaAPI) -----------------

test('TempChangeRunning=true with the setpoint below temperature reads as cooling', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TargetTemp: -10,
    TemperatureSetPoint: 10,
    Temperature: 15,
  });
  assert.equal(cameraStore.isRampRunning, true);
  assert.equal(cameraStore.coolingState, 'cooling');
});

test('warming is detected although TargetTemp still holds the stale cool-down target', () => {
  // Regression: TargetTemp keeps the cool-down target (-10) during a warm-up
  // ramp, so direction must come from the moving setpoint, not TargetTemp.
  const { cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TargetTemp: -10,
    TemperatureSetPoint: -8,
    Temperature: -10,
  });
  assert.equal(cameraStore.coolingState, 'warming');
});

test('the setpoint trend flips the direction latch (external warm-up)', async () => {
  const { store, cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TargetTemp: -10,
    TemperatureSetPoint: -10,
    Temperature: -10,
  });
  store.cameraInfo = { ...store.cameraInfo, TemperatureSetPoint: -9, Temperature: -9.8 };
  await nextTick();
  assert.equal(cameraStore.coolingState, 'warming');
});

test('a user-set direction latch wins over the instant setpoint guess', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TemperatureSetPoint: 10,
    Temperature: 15,
  });
  cameraStore.rampDirection = 'warming';
  assert.equal(cameraStore.coolingState, 'warming');
});

test('TempChangeRunning=false wins over a temperature delta (holding)', () => {
  // Real state says "no ramp" even though temps differ - must NOT guess.
  const { cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: false,
    TargetTemp: -10,
    Temperature: 15,
  });
  assert.equal(cameraStore.isRampRunning, false);
  assert.equal(cameraStore.coolingState, 'holding');
});

// --- heuristic fallback (official ninaAPI without the field) -----------------

test('heuristic: cooler on, far from target, setpoint below -> cooling', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TargetTemp: -10,
    TemperatureSetPoint: 10,
    Temperature: 15,
  });
  assert.equal(cameraStore.coolingState, 'cooling');
});

test('heuristic: warm-up with stale cool-down TargetTemp -> warming', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TargetTemp: -10,
    TemperatureSetPoint: -4,
    Temperature: -5,
  });
  assert.equal(cameraStore.coolingState, 'warming');
});

test('heuristic: AtTargetTemp stops the ramp state (holding)', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    AtTargetTemp: true,
    TargetTemp: -10,
    Temperature: -10.2,
  });
  assert.equal(cameraStore.coolingState, 'holding');
});

test('heuristic: within 1°C of target counts as holding', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TargetTemp: -10,
    TemperatureSetPoint: -10,
    Temperature: -9.5,
  });
  assert.equal(cameraStore.coolingState, 'holding');
});

test('heuristic: a setpoint stepped above the cool target is a warm-up (external start)', () => {
  // NINA's first warm-up step sits 1°C above the target while the sensor
  // has not moved yet - the distance rule alone would say "holding".
  const { cameraStore } = setup({
    CoolerOn: true,
    TargetTemp: -10,
    TemperatureSetPoint: -9,
    Temperature: -10,
  });
  assert.equal(cameraStore.isRampRunning, true);
  assert.equal(cameraStore.coolingState, 'warming');
});

test('heuristic: TemperatureSetPoint is the fallback when TargetTemp is missing', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TemperatureSetPoint: -10,
    Temperature: 15,
  });
  assert.equal(cameraStore.coolingState, 'cooling');
});

// --- target temperature ------------------------------------------------------

test('the profile setting wins over a stale CameraInfo.TargetTemp', () => {
  // Regression: NINA only refreshes CameraVM.TargetTemp when the value is
  // edited in its own UI, so after a target change from TNS it still reported
  // the old -10 while the camera was cooling to 25.
  const { cameraStore } = setup(
    { CoolerOn: true, TargetTemp: -10, TemperatureSetPoint: 25, Temperature: 25 },
    { Temperature: 25 }
  );
  assert.equal(cameraStore.targetTemp, 25);
  // ...and the stale target must not fake a running ramp either.
  assert.equal(cameraStore.isRampRunning, false);
  assert.equal(cameraStore.coolingState, 'holding');
});

test('targetTemp falls back to TargetTemp, then to the setpoint', () => {
  assert.equal(setup({ CoolerOn: true, TargetTemp: -10 }).cameraStore.targetTemp, -10);
  assert.equal(setup({ CoolerOn: true, TemperatureSetPoint: -5 }).cameraStore.targetTemp, -5);
});

// --- off states --------------------------------------------------------------

test('cooler off, disconnected or no temperature control -> off', () => {
  assert.equal(setup({ CoolerOn: false }).cameraStore.coolingState, 'off');
  assert.equal(
    setup({ Connected: false, CoolerOn: true, TempChangeRunning: true }).cameraStore.coolingState,
    'off'
  );
  assert.equal(setup({ CanSetTemperature: false, CoolerOn: true }).cameraStore.coolingState, 'off');
});

// --- optimistic pending flag -------------------------------------------------

test('pending "cooling" shows immediately even before CoolerOn is reported', () => {
  const { cameraStore } = setup({ CoolerOn: false });
  cameraStore.coolingPending = 'cooling';
  assert.equal(cameraStore.coolingState, 'cooling');
});

test('pending "cancel" masks a still-running ramp as holding', () => {
  const { cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TargetTemp: -10,
    Temperature: 15,
  });
  cameraStore.coolingPending = 'cancel';
  assert.equal(cameraStore.coolingState, 'holding');
});

test('pending flag is cleared once the poll confirms the ramp', async () => {
  const { store, cameraStore } = setup({ CoolerOn: false, TempChangeRunning: false });
  cameraStore.coolingPending = 'cooling';
  store.cameraInfo = {
    ...store.cameraInfo,
    CoolerOn: true,
    TempChangeRunning: true,
    TargetTemp: -10,
    Temperature: 15,
  };
  await nextTick();
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'cooling');
});

// --- real flag vs. stale CoolerOn --------------------------------------------

test('TempChangeRunning=true counts as running although CoolerOn still reads false', () => {
  // CameraInfo lags one NINA device poll behind the flag, and INDI reports
  // CoolerOn from the cooler power, which is 0 during a warm-up.
  const { cameraStore } = setup({
    CoolerOn: false,
    TempChangeRunning: true,
    TemperatureSetPoint: -8,
    Temperature: -10,
  });
  assert.equal(cameraStore.isRampRunning, true);
  assert.equal(cameraStore.coolingState, 'warming');
});

// --- intent lifecycle ----------------------------------------------------------

test('startCooling shows the intent before the first request completes', async (t) => {
  let resolveStart;
  stubCoolerApi(t, () => new Promise((resolve) => (resolveStart = resolve)));
  const { cameraStore } = setup({ CoolerOn: false });
  const done = cameraStore.startCooling(-10, 10);
  assert.equal(cameraStore.coolingPending, 'cooling');
  assert.equal(cameraStore.rampDirection, 'cooling');
  assert.equal(cameraStore.coolingState, 'cooling');
  resolveStart({ Success: true });
  await nextTick();
  resolveStart({ Success: true });
  await done;
  cameraStore.coolingPending = null;
});

test('a failed start request drops the intent again', async (t) => {
  stubCoolerApi(t, async () => {
    throw new Error('offline');
  });
  const { cameraStore } = setup({ CoolerOn: false });
  await assert.rejects(cameraStore.startCooling(-10, 10));
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.rampDirection, null);
  assert.equal(cameraStore.coolingState, 'off');
});

test('a re-cool within 1°C of the target is instant and shows no pending', async (t) => {
  stubCoolerApi(t);
  const { cameraStore } = setup({ CoolerOn: true, TemperatureSetPoint: -10, Temperature: -9.4 });
  await cameraStore.startCooling(-10, 10);
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'holding');
});

test('pending survives a stale payload and only the confirming one clears it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  stubCoolerApi(t);
  const { store, cameraStore } = setup({ CoolerOn: false, TempChangeRunning: false });
  await cameraStore.startCooling(-10, 10);

  // Stale payload (fetched before NINA's device poll caught up).
  await poll(store, { CoolerOn: false, TempChangeRunning: false, Temperature: 15.1 });
  t.mock.timers.tick(7000);
  assert.equal(cameraStore.coolingState, 'cooling');
  assert.equal(cameraStore.coolingPending, 'cooling');

  await poll(store, { CoolerOn: true, TempChangeRunning: true, TemperatureSetPoint: 14 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'cooling');
});

test('the confirming payload clears pending even without a running transition', async (t) => {
  // The ramp was already running (started elsewhere) when the button was
  // pressed, so isRampRunning never flips - the check must run per payload.
  stubCoolerApi(t);
  const { store, cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TemperatureSetPoint: 10,
    Temperature: 15,
  });
  await nextTick(); // the setup payload is processed before the press
  await cameraStore.startCooling(-10, 10);
  assert.equal(cameraStore.coolingPending, 'cooling');
  await poll(store, { Temperature: 14.9 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'cooling');
});

test('an unconfirmed intent falls after the safety timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  stubCoolerApi(t);
  const { cameraStore } = setup({ CoolerOn: false, TempChangeRunning: false });
  await cameraStore.startCooling(-10, 10);
  t.mock.timers.tick(14999);
  assert.equal(cameraStore.coolingState, 'cooling');
  t.mock.timers.tick(1);
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'off');
});

test('pending "cancel" is cleared by the first payload without a ramp', async (t) => {
  stubCoolerApi(t);
  const { store, cameraStore } = setup({
    CoolerOn: true,
    TempChangeRunning: true,
    TemperatureSetPoint: 10,
    Temperature: 15,
  });
  await cameraStore.cancelTempChange();
  assert.equal(cameraStore.coolingState, 'holding');
  await poll(store, { TempChangeRunning: true, Temperature: 14.9 }); // stale
  assert.equal(cameraStore.coolingPending, 'cancel');
  await poll(store, { TempChangeRunning: false, TemperatureSetPoint: 14.8, Temperature: 14.8 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'holding');
});

// --- heuristic latches for TNS-commanded actions ------------------------------

test('heuristic: a warm-up started at the cool target stays "warming" until the cooler is off', async (t) => {
  stubCoolerApi(t);
  const { store, cameraStore } = setup(
    { CoolerOn: true, TargetTemp: -10, TemperatureSetPoint: -10, Temperature: -10 },
    { Temperature: -10 }
  );
  assert.equal(cameraStore.coolingState, 'holding');
  await cameraStore.startWarming(10);
  // Confirmed by the next payload, sensor and setpoint still unchanged.
  await poll(store, { Temperature: -9.9 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'warming');
  // ...and long after the old 6s window, still within 1°C of the target.
  await poll(store, { TemperatureSetPoint: -10, Temperature: -9.3 });
  assert.equal(cameraStore.coolingState, 'warming');
  // NINA switches the cooler off at the end of the warm-up.
  await poll(store, { CoolerOn: false, TemperatureSetPoint: 20, Temperature: 19.5 });
  assert.equal(cameraStore.coolingState, 'off');
});

test('heuristic: after a cancel the held setpoint reads as holding until it moves', async (t) => {
  stubCoolerApi(t);
  const { store, cameraStore } = setup(
    { CoolerOn: true, TargetTemp: -10, TemperatureSetPoint: -4, Temperature: -5 },
    { Temperature: -10 }
  );
  assert.equal(cameraStore.coolingState, 'warming');
  await cameraStore.cancelTempChange();
  // NINA wrote setpoint = temperature; exact equality marks that write.
  await poll(store, { AtTargetTemp: true, TemperatureSetPoint: -5, Temperature: -5 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'holding');
  // Sensor drifts, setpoint unchanged: still holding (used to flicker).
  await poll(store, { AtTargetTemp: false, Temperature: -5.2 });
  assert.equal(cameraStore.coolingState, 'holding');
  await poll(store, { Temperature: -4.9 });
  assert.equal(cameraStore.coolingState, 'holding');
  // A new ramp (from anywhere) moves the setpoint and releases the hold.
  await poll(store, { TemperatureSetPoint: -4, Temperature: -4.9 });
  assert.equal(cameraStore.coolingState, 'warming');
});

test('heuristic: the held setpoint is captured by time when equality never shows', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  stubCoolerApi(t);
  const { store, cameraStore } = setup(
    { CoolerOn: true, TargetTemp: -10, TemperatureSetPoint: -4, Temperature: -5 },
    { Temperature: -10 }
  );
  await cameraStore.cancelTempChange();
  // Too early: could still be the pre-cancel setpoint.
  await poll(store, { TemperatureSetPoint: -5.3, Temperature: -5.2 });
  assert.equal(cameraStore.coolingPending, 'cancel');
  t.mock.timers.tick(3000); // default DevicePollingInterval 2s + 1s margin
  await poll(store, { TemperatureSetPoint: -5.3, Temperature: -5.1 });
  assert.equal(cameraStore.coolingPending, null);
  assert.equal(cameraStore.coolingState, 'holding');
});

test('heuristic: a "not running" payload during the cancel requests does not end the hold early', async (t) => {
  // AtTargetTemp can be a coincidence of the old ramp (integer setpoint ==
  // sensor reading). Until the cancel completed nothing is captured, and the
  // cancel stays pending so the distance heuristic cannot flicker in between.
  const pendingRequests = [];
  stubCoolerApi(t, () => new Promise((resolve) => pendingRequests.push(resolve)));
  const { store, cameraStore } = setup(
    { CoolerOn: true, TargetTemp: -10, TemperatureSetPoint: -4, Temperature: -5 },
    { Temperature: -10 }
  );
  await nextTick();
  const cancel = cameraStore.cancelTempChange();
  await poll(store, { AtTargetTemp: true, TemperatureSetPoint: -4, Temperature: -4 });
  assert.equal(cameraStore.coolingPending, 'cancel');
  assert.equal(cameraStore.coolingState, 'holding');
  pendingRequests.shift()({ Success: true });
  await nextTick();
  pendingRequests.shift()({ Success: true });
  await cancel;
  // Payload of the old ramp, then NINA's post-cancel write.
  await poll(store, { AtTargetTemp: false, TemperatureSetPoint: -4, Temperature: -4.1 });
  assert.equal(cameraStore.coolingState, 'holding');
  await poll(store, { AtTargetTemp: true, TemperatureSetPoint: -4.2, Temperature: -4.2 });
  assert.equal(cameraStore.coolingPending, null);
  await poll(store, { AtTargetTemp: false, Temperature: -4.4 });
  assert.equal(cameraStore.coolingState, 'holding');
});
