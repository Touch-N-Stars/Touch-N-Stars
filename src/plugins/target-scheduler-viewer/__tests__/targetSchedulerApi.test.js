import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

const {
  targetSchedulerApi,
  getStoredPort,
  setStoredPort,
  getStoredProfileId,
  setStoredProfileId,
  getStoredHeaderCollapsed,
  setStoredHeaderCollapsed,
  getStoredHasConnected,
  setStoredHasConnected,
} = await import('../services/targetSchedulerApi.js');
const { useSettingsStore } = await import('@/store/settingsStore');

function setup() {
  localStorage.clear();
  freshPinia();
  useSettingsStore(); // touch the store so it's registered before hostPort() reads it
}

test('getStoredPort: defaults to 8188 when nothing is stored', () => {
  setup();
  assert.equal(getStoredPort(), '8188');
});

test('setStoredPort/getStoredPort round-trip', () => {
  setup();
  setStoredPort('4224');
  assert.equal(getStoredPort(), '4224');
});

test('getStoredProfileId: defaults to empty string', () => {
  setup();
  assert.equal(getStoredProfileId(), '');
});

test('setStoredProfileId/getStoredProfileId round-trip', () => {
  setup();
  setStoredProfileId('96139a43-5f57-4398-ab7a-5f9e3870c46f');
  assert.equal(getStoredProfileId(), '96139a43-5f57-4398-ab7a-5f9e3870c46f');
});

test('getStoredHeaderCollapsed: defaults to false', () => {
  setup();
  assert.equal(getStoredHeaderCollapsed(), false);
});

test('setStoredHeaderCollapsed/getStoredHeaderCollapsed round-trip', () => {
  setup();
  setStoredHeaderCollapsed(true);
  assert.equal(getStoredHeaderCollapsed(), true);
  setStoredHeaderCollapsed(false);
  assert.equal(getStoredHeaderCollapsed(), false);
});

test('getStoredHasConnected: defaults to false (first-run state)', () => {
  setup();
  assert.equal(getStoredHasConnected(), false);
});

test('setStoredHasConnected sticks (no way to un-set it)', () => {
  setup();
  setStoredHasConnected();
  assert.equal(getStoredHasConnected(), true);
});

test('a successful request returns the parsed JSON body', async () => {
  setup();
  setStoredPort('8188');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.ok(url.includes(':8188/ts/v0/profiles'));
    return { ok: true, status: 200, json: async () => [{ Id: 'p1', Name: 'Test', Active: true }] };
  };
  try {
    const profiles = await targetSchedulerApi.getProfiles();
    assert.deepEqual(profiles, [{ Id: 'p1', Name: 'Test', Active: true }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a network-level failure (connection refused, DNS failure) surfaces an actionable message with host:port', async () => {
  setup();
  setStoredPort('9999');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new TypeError('Failed to fetch');
  };
  try {
    await assert.rejects(
      () => targetSchedulerApi.getVersion(),
      (err) => {
        assert.match(err.message, /9999/);
        assert.match(err.message, /Check the port is correct/);
        assert.equal(err.kind, 'unreachable');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a request that times out reports the configured timeout, distinct from a plain connection failure', async (t) => {
  setup();
  setStoredPort('9999');
  // The implementation drives its own setTimeout (deliberately not
  // AbortSignal.timeout() — see raceAbort's comment for why), so a real
  // timeout is exercised here via mocked timers rather than faking an
  // error's .name, which the code no longer inspects.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  try {
    const pending = targetSchedulerApi.getVersion();
    t.mock.timers.tick(8000);
    await assert.rejects(
      () => pending,
      (err) => {
        assert.match(err.message, /did not respond within 8s/);
        assert.equal(err.kind, 'timeout');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an explicitly aborted signal (user cancels a port-change attempt) is rejected as cancelled, not a network error', async () => {
  setup();
  const controller = new AbortController();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        const err = new Error('This operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  try {
    const pending = targetSchedulerApi.getProfiles({ signal: controller.signal });
    controller.abort();
    await assert.rejects(
      () => pending,
      (err) => {
        assert.equal(err.message, 'Connection attempt cancelled.');
        assert.equal(err.kind, 'cancelled');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a non-OK HTTP response (e.g. 404 from a wrong port hitting an unrelated server) is rejected with the status code', async () => {
  setup();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  try {
    await assert.rejects(
      () => targetSchedulerApi.getProfiles(),
      (err) => {
        assert.match(err.message, /HTTP 404/);
        assert.equal(err.kind, 'http');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('an OK response whose body is not valid JSON is rejected as unreadable', async () => {
  setup();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });
  try {
    await assert.rejects(
      () => targetSchedulerApi.getProfiles(),
      (err) => {
        assert.match(err.message, /unreadable response/);
        assert.equal(err.kind, 'parse');
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getProjects/getTargets/getStatistics/getPreview build the documented ts/v0 paths', async () => {
  setup();
  const requestedUrls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requestedUrls.push(url);
    return { ok: true, status: 200, json: async () => [] };
  };
  try {
    await targetSchedulerApi.getProjects('profile-1');
    await targetSchedulerApi.getTargets('project-1');
    await targetSchedulerApi.getStatistics('target-1');
    await targetSchedulerApi.getPreview('profile-1');
    assert.ok(requestedUrls[0].endsWith('/ts/v0/profiles/profile-1/projects'));
    assert.ok(requestedUrls[1].endsWith('/ts/v0/projects/project-1/targets'));
    assert.ok(requestedUrls[2].endsWith('/ts/v0/targets/target-1/statistics'));
    assert.ok(requestedUrls[3].endsWith('/ts/v0/profiles/profile-1/preview'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
