import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installBrowserGlobals,
  freshPinia,
  liveSockets,
  lastSocket,
  resetSockets,
  FakeWebSocket,
} from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the services instantiate their
// ReconnectingWebSocket at module load.
const { default: channelService } = await import('@/services/websocketChannelSocket');
const { default: mountService } = await import('@/services/websocketMountControl');
const { default: tppaService } = await import('@/services/websocketTppa');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');

// The services are app-scoped singletons; give every test a fresh Pinia (their
// getUrl()/canReconnect() re-read the active stores on each call) and tear the
// reconnect loops down afterwards so no timers leak into the next test.
function setup(t) {
  resetSockets();
  freshPinia();
  const settingsStore = useSettingsStore();
  const store = apiStore();
  settingsStore.connection.ip = '10.0.0.5';
  settingsStore.connection.port = 5000;
  store.apiPort = 1888;
  store.isApiConnected = true;
  store.isTnsPluginConnected = true;
  t.after(() => {
    channelService.disconnect();
    mountService.disconnect();
    tppaService.disconnect();
    channelService._subscriptions.clear();
  });
  return { settingsStore, store };
}

// --- URL wiring per instance ------------------------------------------------

test('channel socket dials the selected instance with the handshake apiPort', async (t) => {
  const { store } = setup(t);
  const p = channelService.connect();
  assert.equal(lastSocket().url, 'ws://10.0.0.5:1888/v2/socket');
  lastSocket().emitOpen();
  await p;
  assert.equal(store.isWebSocketConnected, true);
});

test('channel socket does not dial while the apiPort handshake is missing', async (t) => {
  const { store } = setup(t);
  store.apiPort = null;
  await assert.rejects(channelService.connect(), /no URL available/);
  assert.equal(liveSockets().length, 0);
});

test('after an instance switch the next dial targets the new endpoint', async (t) => {
  const { settingsStore, store } = setup(t);
  const p = channelService.connect();
  lastSocket().emitOpen();
  await p;
  assert.equal(lastSocket().url, 'ws://10.0.0.5:1888/v2/socket');

  // switchBackend(): teardown, then the new instance's handshake fills apiPort
  channelService.disconnect();
  settingsStore.connection.ip = '10.0.0.9';
  store.apiPort = 2999;

  const p2 = channelService.connect();
  assert.equal(lastSocket().url, 'ws://10.0.0.9:2999/v2/socket');
  lastSocket().emitOpen();
  await p2;
});

test('mount socket uses the plugin port on PINS and the apiPort on NINA', async (t) => {
  const { store } = setup(t);

  store.isPINS = true;
  mountService.connect();
  assert.equal(lastSocket().url, 'ws://10.0.0.5:5000/ws/mount-control');
  lastSocket().emitOpen();
  mountService.disconnect();

  store.isPINS = false;
  mountService.connect();
  assert.equal(lastSocket().url, 'ws://10.0.0.5:1888/v2/mount');
  lastSocket().emitOpen();
});

test('tppa socket dials /v2/tppa on the selected instance', async (t) => {
  setup(t);
  const p = tppaService.connect();
  assert.equal(lastSocket().url, 'ws://10.0.0.5:1888/v2/tppa');
  lastSocket().emitOpen();
  await p;
  assert.equal(tppaService.isOpen(), true);
});

test('tppa socket feeds extra listeners next to the page callback', async (t) => {
  setup(t);
  const fromPage = [];
  const fromListener = [];
  tppaService.setMessageCallback((m) => fromPage.push(m));
  const unsubscribe = tppaService.addMessageListener((m) => fromListener.push(m));
  t.after(() => tppaService.setMessageCallback(null));

  const p = tppaService.connect();
  lastSocket().emitOpen();
  await p;
  lastSocket().emitMessage(JSON.stringify({ Response: 'started procedure' }));
  unsubscribe();
  lastSocket().emitMessage(JSON.stringify({ Response: 'stopped procedure' }));

  assert.equal(fromPage.length, 2);
  assert.deepEqual(fromListener, [{ Response: 'started procedure' }]);
});

// --- shouldReconnect arming (switchBackend re-arm depends on this) ----------

test('connect() arms shouldReconnect, disconnect() latches it off', async (t) => {
  setup(t);
  const p = tppaService.connect();
  lastSocket().emitOpen();
  await p;
  assert.equal(tppaService.shouldReconnect, true);

  tppaService.disconnect();
  assert.equal(tppaService.shouldReconnect, false);
});

// --- connection state + subscriptions ----------------------------------------

test('channel socket close flips isWebSocketConnected off', async (t) => {
  const { store } = setup(t);
  const p = channelService.connect();
  lastSocket().emitOpen();
  await p;
  assert.equal(store.isWebSocketConnected, true);

  lastSocket().emitClose();
  assert.equal(store.isWebSocketConnected, false);
});

test('channel subscriptions are replayed on every reopen', async (t) => {
  setup(t);
  const p = channelService.connect();
  lastSocket().emitOpen();
  await p;

  channelService.subscribe('IMAGE-SAVE');
  channelService.subscribe('STACK-UPDATED');
  assert.deepEqual(lastSocket().sent, [
    '{"action":"subscribe","eventType":"IMAGE-SAVE"}',
    '{"action":"subscribe","eventType":"STACK-UPDATED"}',
  ]);

  // Reconnect (e.g. zombie recovery): the fresh socket must re-subscribe on
  // its own, without fetchAllInfos re-registering anything.
  channelService.forceReconnect();
  const reconnected = lastSocket();
  reconnected.emitOpen();
  assert.deepEqual(reconnected.sent, [
    '{"action":"subscribe","eventType":"IMAGE-SAVE"}',
    '{"action":"subscribe","eventType":"STACK-UPDATED"}',
  ]);
});

// --- zombie (half-open) socket watchdog --------------------------------------

test('checkStaleness reconnects after three silent probes', async (t) => {
  setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 0 });

  const p = channelService.connect();
  lastSocket().emitOpen(); // lastMessageAt = 0
  await p;
  channelService.subscribe('IMAGE-SAVE');
  const zombie = lastSocket();
  const socketsBefore = liveSockets().length;

  for (let probe = 1; probe <= 3; probe++) {
    // Silent past the stale threshold: a probe subscribe is sent.
    t.mock.timers.setTime(probe * 45000);
    const sentBefore = zombie.sent.length;
    channelService.checkStaleness();
    assert.equal(zombie.sent.length, sentBefore + 1, `probe ${probe} sent`);

    // No reply within the probe timeout: inconclusive (buffer drained).
    t.mock.timers.setTime(probe * 45000 + 10001);
    channelService.checkStaleness();
  }

  assert.equal(liveSockets().length, socketsBefore + 1, 'forced a reconnect after 3 probes');
  assert.equal(zombie.readyState, FakeWebSocket.CLOSED, 'zombie socket was closed');
});

test('checkStaleness reconnects immediately when the probe frame never drains', async (t) => {
  setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 0 });

  const p = channelService.connect();
  lastSocket().emitOpen();
  await p;
  const zombie = lastSocket();
  const socketsBefore = liveSockets().length;

  t.mock.timers.setTime(31000);
  channelService.checkStaleness(); // sends the probe
  zombie.bufferedAmount = 42; // TCP send window stalled -> peer is gone

  t.mock.timers.setTime(41001);
  channelService.checkStaleness();
  assert.equal(liveSockets().length, socketsBefore + 1, 'reconnected on the stalled buffer');
});

test('a message in flight clears the probe instead of reconnecting', async (t) => {
  setup(t);
  t.mock.timers.enable({ apis: ['Date'], now: 0 });

  const p = channelService.connect();
  lastSocket().emitOpen();
  await p;
  const socket = lastSocket();
  const socketsBefore = liveSockets().length;

  t.mock.timers.setTime(31000);
  channelService.checkStaleness(); // probe sent
  socket.emitMessage('{"Success":true}'); // proof of life

  t.mock.timers.setTime(41001);
  channelService.checkStaleness();
  assert.equal(liveSockets().length, socketsBefore, 'no reconnect after inbound traffic');
});
