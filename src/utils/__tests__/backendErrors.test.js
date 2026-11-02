import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { apiStore } = await import('@/store/store');
const { useToastStore } = await import('@/store/toastStore');
const { autofocusStartRefusal, describeFailureEvent, isBackendRefusal, reportBackendRefusal } =
  await import('@/utils/backendErrors');

test('a park failure event raises an error toast that stays until dismissed', async () => {
  freshPinia();
  const toastStore = useToastStore();

  await apiStore().handleWebSocketMessage({
    Response: { Event: 'MOUNT-PARK-FAILED', Error: 'Mount did not reach park' },
  });

  assert.equal(toastStore.newMessage, true);
  assert.equal(toastStore.type, 'error');
  assert.equal(toastStore.title, 'Parking failed');
  assert.equal(toastStore.message, 'Mount did not reach park');
  assert.equal(toastStore.autoClose, false);
});

test('only the listed background failures map to a toast', () => {
  assert.equal(describeFailureEvent({ Event: 'PLATESOLVE-FAILED' }), null);
  assert.equal(describeFailureEvent({ Event: 'MOUNT-PARKED' }), null);
  assert.deepEqual(describeFailureEvent({ Event: 'FOCUSER-MOVE-FAILED' }), {
    titleKey: 'components.backendErrors.focuserMove',
    persistent: false,
  });
});

test('the dome shutter failure names the direction', () => {
  assert.equal(
    describeFailureEvent({ Event: 'DOME-SHUTTER-FAILED', Action: 'closing' }).titleKey,
    'components.backendErrors.domeClose'
  );
  assert.equal(
    describeFailureEvent({ Event: 'DOME-SHUTTER-FAILED' }).titleKey,
    'components.backendErrors.domeShutter'
  );
});

test('a request canceled on resume is no refusal', () => {
  assert.equal(isBackendRefusal({ Success: false, StatusCode: 499 }), false);
  assert.equal(isBackendRefusal({ Success: true }), false);
  assert.equal(isBackendRefusal(undefined), false);
  assert.equal(isBackendRefusal({ Success: false, StatusCode: 409, Error: 'busy' }), true);
});

test('reportBackendRefusal toasts the server reason', () => {
  freshPinia();
  const toastStore = useToastStore();
  const refused = reportBackendRefusal(
    { Success: false, StatusCode: 409, Error: 'Camera is exposing' },
    'components.backendErrors.binning'
  );
  assert.equal(refused, true);
  assert.equal(toastStore.title, 'Binning could not be changed');
  assert.equal(toastStore.message, 'Camera is exposing');
});

test('the plugin autofocus start refusal is read from its message', () => {
  assert.equal(autofocusStartRefusal({ message: 'Autofokus gestartet' }), null);
  assert.equal(
    autofocusStartRefusal({
      message: 'Fehler beim Starten des Autofokus: Autofocus already running',
    }),
    'Autofocus already running'
  );
  assert.equal(
    autofocusStartRefusal({ Success: false, StatusCode: 500, Error: 'GET request failed' }),
    'GET request failed'
  );
});
