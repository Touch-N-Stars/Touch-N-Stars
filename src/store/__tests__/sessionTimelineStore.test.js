import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSessionTimelineStore } = await import('@/store/sessionTimelineStore');
const { default: apiService } = await import('@/services/apiService');

freshPinia();

const step = (seconds) => ({
  Time: `2026-09-14T18:00:${String(seconds).padStart(2, '0')}Z`,
  RADistanceRaw: 1,
  DECDistanceRaw: 0,
});
const history = (Steps, Count = Steps.length) => ({
  Success: true,
  Response: { PixelScale: 2, Count, MaxSize: 50000, Steps },
});

// Stubs the endpoints the store talks to; restored after the test.
function stubApi(
  t,
  { events = () => [], guideHistory, applicationStart = '2026-09-14T17:00:00Z' }
) {
  const stubs = {
    fetchNinaTime: async () => ({ Success: true, Response: new Date().toISOString() }),
    fetchApplicationStart: async () => ({ Success: true, Response: applicationStart }),
    getEventHistory: async () => ({ Success: true, Response: events() }),
    guiderHistory: guideHistory,
  };
  const originals = Object.fromEntries(Object.keys(stubs).map((key) => [key, apiService[key]]));
  Object.assign(apiService, stubs);
  t.after(() => Object.assign(apiService, originals));
}

function freshStore() {
  const timeline = useSessionTimelineStore();
  timeline.reset();
  return timeline;
}

test('poll merges the event history without duplicates and sets the server time', async (t) => {
  const timeline = freshStore();
  const list = [{ Event: 'GUIDER-START', Time: '2026-09-14T20:00:00.1234567+02:00' }];
  stubApi(t, { events: () => list, guideHistory: async () => history([]) });

  await timeline.poll();
  list.push({ Event: 'GUIDER-STOP', Time: '2026-09-14T20:10:00+02:00' });
  await timeline.poll();

  assert.deepEqual(
    timeline.events.map((event) => event.Event),
    ['GUIDER-START', 'GUIDER-STOP']
  );
  assert.ok(timeline.nowMs > 0);
});

test('events older than the application start are dropped', async (t) => {
  const timeline = freshStore();
  stubApi(t, {
    applicationStart: '2026-09-18T20:00:00+02:00',
    // The backend replays its whole log, including lines from days ago
    events: () => [
      { Event: 'PLATESOLVE-SUCCESS', Time: '2026-09-14T20:41:00+02:00' },
      { Event: 'MOUNT-CONNECTED', Time: '2026-09-18T20:05:00+02:00' },
    ],
    guideHistory: async () => history([]),
  });

  await timeline.poll();
  assert.equal(timeline.applicationStart, Date.parse('2026-09-18T20:00:00+02:00'));
  assert.deepEqual(
    timeline.events.map((event) => event.Event),
    ['MOUNT-CONNECTED']
  );
});

test('a rig without the guide history route is asked once', async (t) => {
  const timeline = freshStore();
  let calls = 0;
  stubApi(t, {
    // What the axios interceptor makes of an HTTP 404
    guideHistory: async () => {
      calls++;
      return { Success: false, StatusCode: 404, Error: 'Not found' };
    },
  });

  await timeline.poll();
  await timeline.poll();
  assert.equal(timeline.guideHistorySupported, false);
  assert.equal(calls, 1);

  timeline.reset();
  assert.equal(timeline.guideHistorySupported, null);
});

test('guide steps are fetched incrementally with the last Time as since cursor', async (t) => {
  const timeline = freshStore();
  const sinceValues = [];
  const pages = [[step(1), step(2)], [step(3)], []];
  stubApi(t, {
    guideHistory: async (since) => {
      sinceValues.push(since ?? null);
      return history(pages.shift(), 3 - pages.length);
    },
  });

  await timeline.poll();
  await timeline.poll();
  const steps = timeline.guideSteps;
  await timeline.poll();

  assert.deepEqual(sinceValues, [null, step(2).Time, step(3).Time]);
  assert.equal(timeline.guideSteps.length, 3);
  assert.equal(timeline.guideSteps, steps, 'a poll without new steps keeps the array');
  assert.equal(timeline.pixelScale, 2);
  assert.equal(timeline.guideHistorySupported, true);
});

test('a reset while the guide history request is in flight drops that response', async (t) => {
  const timeline = freshStore();
  const sinceValues = [];
  let release = null;
  stubApi(t, {
    guideHistory: (since) => {
      sinceValues.push(since ?? null);
      const response = history(since ? [step(3)] : [step(1), step(2), step(3)], 3);
      if (sinceValues.length !== 2) return Promise.resolve(response);
      return new Promise((resolve) => (release = () => resolve(response)));
    },
  });

  await timeline.poll();
  assert.equal(timeline.guideSteps.length, 3);

  // The incremental request is pending when the instance is torn down
  const pending = timeline.poll();
  while (!release) await new Promise((resolve) => setTimeout(resolve, 0));
  timeline.reset();
  release();
  await pending;
  assert.equal(timeline.guideSteps.length, 0, 'the tail must not survive the reset');

  await timeline.poll();
  assert.deepEqual(sinceValues, [null, step(3).Time, null]);
  assert.equal(timeline.guideSteps.length, 3);
});

test('a backend count above the known steps reloads the whole history once', async (t) => {
  const timeline = freshStore();
  const all = [step(1), step(2), step(3)];
  // Only the tail is known, as after a lost response
  timeline.guideSteps = [{ ...all[2], t: Date.parse(all[2].Time) }];
  const sinceValues = [];
  stubApi(t, {
    guideHistory: async (since) => {
      sinceValues.push(since ?? null);
      return history(since ? [] : all, all.length);
    },
  });

  await timeline.poll();
  assert.equal(timeline.needsFullResync, true);
  await timeline.poll();
  assert.equal(timeline.guideSteps.length, 3);
  await timeline.poll();
  assert.deepEqual(sinceValues, [step(3).Time, null, step(3).Time]);
});
