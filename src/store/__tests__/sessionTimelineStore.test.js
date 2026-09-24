import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSessionTimelineStore } = await import('@/store/sessionTimelineStore');
const { default: apiService } = await import('@/services/apiService');

freshPinia();

const step = (seconds, Id = seconds) => ({
  Id,
  Time: `2026-09-14T18:00:${String(seconds).padStart(2, '0')}Z`,
  RADistanceRaw: 1,
  DECDistanceRaw: 0,
});
const history = (Steps, Session = 'a') => ({
  Success: true,
  Response: { Session, PixelScale: 2, Count: Steps.length, MaxSize: 50000, Steps },
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

test('guide steps are fetched incrementally with the last Id as after cursor', async (t) => {
  const timeline = freshStore();
  const afterValues = [];
  // Two steps in the same millisecond are still two steps
  const pages = [[step(1), step(2)], [step(2, 3)], []];
  stubApi(t, {
    guideHistory: async (after) => {
      afterValues.push(after ?? null);
      return history(pages.shift());
    },
  });

  await timeline.poll();
  await timeline.poll();
  const steps = timeline.guideSteps;
  await timeline.poll();

  assert.deepEqual(afterValues, [null, 2, 3]);
  assert.equal(timeline.guideSteps.length, 3);
  assert.equal(timeline.guideSteps, steps, 'a poll without new steps keeps the array');
  assert.equal(timeline.pixelScale, 2);
  assert.equal(timeline.guideHistorySupported, true);
});

test('a reset while the guide history request is in flight drops that response', async (t) => {
  const timeline = freshStore();
  const afterValues = [];
  let release = null;
  stubApi(t, {
    guideHistory: (after) => {
      afterValues.push(after ?? null);
      const response = history(after ? [step(3)] : [step(1), step(2), step(3)]);
      if (afterValues.length !== 2) return Promise.resolve(response);
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
  assert.deepEqual(afterValues, [null, 3, null]);
  assert.equal(timeline.guideSteps.length, 3);
});

test('after a NINA restart the new history is read from its start and appended', async (t) => {
  const timeline = freshStore();
  const afterValues = [];
  // The restarted backend numbers its steps from 1 again
  const restarted = [step(10, 1), step(11, 2), step(12, 3)];
  stubApi(t, {
    guideHistory: async (after) => {
      afterValues.push(after ?? null);
      if (afterValues.length === 1) return history([step(1), step(2)]);
      return history(
        restarted.filter((s) => s.Id > (after ?? 0)),
        'b'
      );
    },
  });

  await timeline.poll();
  await timeline.poll();

  assert.deepEqual(afterValues, [null, 2, null]);
  assert.deepEqual(
    timeline.guideSteps.map((s) => s.Time),
    [step(1), step(2), ...restarted].map((s) => s.Time)
  );
  assert.equal(timeline.guideAfter, 3);
});

test('a rig whose history has no Session is not polled for steps again', async (t) => {
  const timeline = freshStore();
  let calls = 0;
  stubApi(t, {
    // A build before the after cursor ignores it and would resend every step
    guideHistory: async () => {
      calls++;
      return { Success: true, Response: { PixelScale: 2, Count: 1, Steps: [step(1)] } };
    },
  });

  await timeline.poll();
  await timeline.poll();
  assert.equal(calls, 1);
  assert.equal(timeline.guideHistorySupported, false);
  assert.equal(timeline.guideSteps.length, 0);
});
