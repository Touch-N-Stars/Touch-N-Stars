import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the store's transitive imports touch browser APIs.
const { useWebcamStore } = await import('@/plugins/webcam/store/webcamStore');
const { setAppBackgrounded } = await import('@/utils/appLifecycle');

const REFRESH_MS = 1000;

function startRefresh(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  setAppBackgrounded(false);
  freshPinia();

  const store = useWebcamStore();
  const counter = { refreshes: 0 };
  store.refreshSnapshot = () => {
    counter.refreshes++;
  };
  store.autoRefresh = true;
  store.refreshInterval = REFRESH_MS;
  t.after(() => {
    store.autoRefresh = false;
    store.stopAutoRefresh();
    setAppBackgrounded(false);
  });
  return { store, counter };
}

test('refreshes the snapshot after the interval', (t) => {
  const { store, counter } = startRefresh(t);

  store.scheduleNextRefresh();
  t.mock.timers.tick(REFRESH_MS);

  assert.equal(counter.refreshes, 1);
});

test('loads no snapshot while backgrounded and carries on after foreground', (t) => {
  const { store, counter } = startRefresh(t);
  setAppBackgrounded(true);

  store.scheduleNextRefresh();
  t.mock.timers.tick(REFRESH_MS * 3);
  assert.equal(counter.refreshes, 0);

  setAppBackgrounded(false);
  t.mock.timers.tick(REFRESH_MS);
  assert.equal(counter.refreshes, 1);
});

test('stopping the auto refresh while backgrounded ends the waiting timer', (t) => {
  const { store, counter } = startRefresh(t);
  setAppBackgrounded(true);
  store.scheduleNextRefresh();
  t.mock.timers.tick(REFRESH_MS);

  store.autoRefresh = false;
  store.stopAutoRefresh();
  setAppBackgrounded(false);
  t.mock.timers.tick(REFRESH_MS * 3);

  assert.equal(counter.refreshes, 0);
});
