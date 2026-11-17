import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { apiStore } = await import('@/store/store');
const { useDialogStore } = await import('@/store/dialogStore');
const { default: apiService } = await import('@/services/apiService');
const { default: signalRDialogService } = await import('@/services/signalRDialogService');

const PLATE_SOLVE = 'NINA.WPF.Base.ViewModel.PlateSolvingStatusVM';

function setup(t) {
  freshPinia();
  const store = apiStore();
  const dialogStore = useDialogStore();
  store.isPINS = true;
  store.isBackendReachable = true;

  const calls = { slewStop: 0, clicks: [] };
  t.mock.method(apiService, 'slewStop', async () => {
    calls.slewStop += 1;
    return { Success: true };
  });
  t.mock.method(signalRDialogService, 'isSignalRConnected', () => false);
  t.mock.method(signalRDialogService, 'connect', async () => null);
  t.mock.method(dialogStore, 'clickButton', async (button) => {
    calls.clicks.push(button);
    return { Success: true };
  });
  return { store, dialogStore, calls };
}

test('closing the plate solving dialog leaves a tracking mount alone', async (t) => {
  const { store, dialogStore, calls } = setup(t);
  store.mountInfo = { Connected: true, Slewing: false, TrackingEnabled: true };
  dialogStore.dialogs = [{ ContentType: PLATE_SOLVE, Title: 'Plate Solving' }];

  await dialogStore.closePlateSolvingDialog();

  assert.deepEqual(calls.clicks, ['Cancel']);
  assert.equal(calls.slewStop, 0);
  assert.equal(dialogStore.dialogs.length, 0);
});

test('closing the plate solving dialog stops a running slew', async (t) => {
  const { store, dialogStore, calls } = setup(t);
  store.mountInfo = { Connected: true, Slewing: true, AtPark: false };
  dialogStore.dialogs = [{ ContentType: PLATE_SOLVE, Title: 'Plate Solving' }];

  await dialogStore.closePlateSolvingDialog();

  assert.equal(calls.slewStop, 1);
});

test('connecting drops dialogs the hub will not replay', async (t) => {
  const { dialogStore } = setup(t);
  dialogStore.dialogs = [{ ContentType: PLATE_SOLVE, Title: 'Plate Solving' }];
  dialogStore.slewAndCenterData = { Active: true };

  await dialogStore.initializeDialogSignalR();

  assert.equal(dialogStore.dialogs.length, 0);
  assert.equal(dialogStore.slewAndCenterData, null);
});

test('a dialog replayed during connect survives', async (t) => {
  const { dialogStore } = setup(t);
  signalRDialogService.connect.mock.mockImplementation(async () => {
    signalRDialogService.dialogCallback({ ContentType: PLATE_SOLVE, Title: 'Plate Solving' });
    return null;
  });

  await dialogStore.initializeDialogSignalR();

  assert.equal(dialogStore.dialogs.length, 1);
});

test('losing the connection drops dialogs, a live connection keeps them', async (t) => {
  const { dialogStore } = setup(t);
  await dialogStore.initializeDialogSignalR();

  dialogStore.dialogs = [{ ContentType: PLATE_SOLVE, Title: 'Plate Solving' }];
  signalRDialogService.statusCallback('Connected');
  assert.equal(dialogStore.dialogs.length, 1);

  signalRDialogService.statusCallback('Reconnecting');
  assert.equal(dialogStore.dialogs.length, 0);
  assert.equal(dialogStore.isConnectedToSignalR, false);
});
