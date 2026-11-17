import assert from 'node:assert/strict';
import test from 'node:test';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: api } = await import('../api.js');
const { useConeErrorStore } = await import('../store/coneErrorStore.js');
const { shimMm, signedArcmin, sideLabel } = await import('../format.js');

function stub(t, name, impl) {
  const original = api[name];
  api[name] = impl;
  t.after(() => (api[name] = original));
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

test('settings saves run one after another and only the last response is applied', async (t) => {
  freshPinia();
  const store = useConeErrorStore();
  const sent = [];
  const replies = [];
  stub(t, 'saveSettings', (changes) => {
    sent.push(changes.sunExclusionDegrees);
    const reply = deferred();
    replies.push(reply);
    return reply.promise;
  });

  const first = store.saveSettings({ sunExclusionDegrees: 31 });
  const second = store.saveSettings({ sunExclusionDegrees: 32 });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, [31], 'the second save waits for the first');

  replies[0].resolve({ sunExclusionDegrees: 31 });
  await first;
  assert.equal(store.settings, null, 'a superseded response is not applied');
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, [31, 32]);

  replies[1].resolve({ sunExclusionDegrees: 32 });
  await second;
  assert.deepEqual(store.settings, { sunExclusionDegrees: 32 });
});

test('a failed settings save does not block the next one', async (t) => {
  freshPinia();
  const store = useConeErrorStore();
  let calls = 0;
  stub(t, 'saveSettings', async (changes) => {
    calls++;
    if (calls === 1) throw new Error('refused');
    return changes;
  });

  await assert.rejects(store.saveSettings({ strictPath: true }));
  await store.saveSettings({ strictPath: false });

  assert.deepEqual(store.settings, { strictPath: false });
});

test('a successful poll clears the error of a failed poll', async (t) => {
  freshPinia();
  const store = useConeErrorStore();
  let fail = true;
  stub(t, 'getStatus', async () => {
    if (fail) throw new Error('network');
    return { phase: 'Idle' };
  });

  await store.loadStatus();
  assert.equal(store.error?.message, 'network');

  fail = false;
  await store.loadStatus();
  assert.equal(store.error, null);
});

test('a successful poll keeps the error of a failed action', async (t) => {
  freshPinia();
  const store = useConeErrorStore();
  stub(t, 'getStatus', async () => ({ phase: 'Idle' }));
  stub(t, 'restore', async () => {
    throw new Error('refused');
  });

  await assert.rejects(store.restore());
  await store.loadStatus();

  assert.equal(store.error?.message, 'refused');
});

test('formatting helpers', () => {
  assert.equal(signedArcmin(1.234), '+1.23');
  assert.equal(signedArcmin(-0.5), '-0.50');
  assert.equal(signedArcmin(null), '—');
  assert.equal(shimMm(0.12), '0.10');
  assert.equal(shimMm(0.13), '0.15');

  const t = (key) => `[${key}]`;
  assert.equal(sideLabel(t, 'East'), '[plugins.coneError.side.East]');
  assert.equal(sideLabel(t, 'West', true), '[plugins.coneError.side.westShort]');
  assert.equal(sideLabel(t, undefined), '—');
});
