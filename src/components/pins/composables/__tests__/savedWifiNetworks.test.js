import test from 'node:test';
import assert from 'node:assert/strict';
import { savedNetworkSettings, waitForSavedNetworkJob } from '../savedWifiNetworks.js';

test('saved settings accept priority zero and preserve disabled auto-connect', () => {
  assert.deepEqual(savedNetworkSettings({ editedPriority: 0, editedAutoConnect: false }), {
    priority: 0,
    auto_connect: false,
  });
  for (const priority of [-1000, 1000, 1.1, '', '100', NaN]) {
    assert.throws(() => savedNetworkSettings({ editedPriority: priority }), RangeError);
  }
});

test('saved profile updates wait for successful completion', async () => {
  const results = [{ status: 'running' }, { status: 'success' }];
  const seen = [];
  await waitForSavedNetworkJob(
    { jobId: 'profile-job' },
    async (id) => {
      seen.push(id);
      return results.shift();
    },
    { delay: async () => {} }
  );
  assert.deepEqual(seen, ['profile-job', 'profile-job']);
});

test('failed, missing, cancelled and timed-out jobs are not reported as success', async () => {
  const delay = async () => {};
  await assert.rejects(
    waitForSavedNetworkJob({}, async () => {}, { delay }),
    /missingJob/
  );
  await assert.rejects(
    waitForSavedNetworkJob({ jobId: 'j' }, async () => ({ status: 'failed' }), { delay }),
    /operationFailed/
  );
  await assert.rejects(
    waitForSavedNetworkJob({ jobId: 'j' }, async () => ({ status: 'running' }), { delay }),
    /operationTimedOut/
  );
  await assert.rejects(
    waitForSavedNetworkJob({ jobId: 'j' }, async () => {}, { delay, cancelled: () => true }),
    /cancelled/
  );
});
