import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCursor,
  isRelayResponse,
  MAX_RIG_SSIDS,
  mergeSsids,
  severityAtLeast,
  sinceForCursor,
  ssidsFromWifiStatus,
  summarizeMissedEvents,
  toastTypeForSeverity,
} from '../sessionNotifications.js';

const event = (seq, severity, message = `m${seq}`, title = '') => ({
  seq,
  severity,
  message,
  title,
});

test('severities are ordered info < success < warning < error', () => {
  assert.equal(severityAtLeast('error', 'warning'), true);
  assert.equal(severityAtLeast('warning', 'warning'), true);
  assert.equal(severityAtLeast('success', 'warning'), false);
  assert.equal(severityAtLeast('info', 'info'), true);
  assert.equal(severityAtLeast('bogus', 'warning'), false);
});

test('relay responses are told apart from older daemons and mock error responses', () => {
  assert.equal(isRelayResponse({ bootId: 'b', lastSeq: 3, events: [] }), true);
  assert.equal(isRelayResponse({ Success: false, StatusCode: 404 }), false);
  assert.equal(isRelayResponse(null), false);
  assert.equal(isRelayResponse({ bootId: 'b', lastSeq: '3', events: [] }), false);
});

test('since restarts at 0 for another daemon run or another rig', () => {
  const cursor = { host: '10.42.0.1', bootId: 'a', lastSeq: 12 };
  assert.equal(sinceForCursor(cursor, { bootId: 'a', host: '10.42.0.1' }), 12);
  assert.equal(sinceForCursor(cursor, { bootId: 'b', host: '10.42.0.1' }), 0);
  assert.equal(sinceForCursor(cursor, { bootId: 'a', host: '192.168.1.5' }), 0);
  assert.equal(sinceForCursor(null, { bootId: 'a' }), 0);
});

test('the cursor moves to the newest seen event and never backwards in one run', () => {
  const cursor = { host: 'h', bootId: 'a', lastSeq: 20 };
  assert.deepEqual(advanceCursor(cursor, { bootId: 'a', lastSeq: 5, events: [] }, 'h'), {
    host: 'h',
    bootId: 'a',
    lastSeq: 20,
  });
  assert.deepEqual(
    advanceCursor(
      cursor,
      { bootId: 'b', lastSeq: 2, events: [event(1, 'info'), event(2, 'error')] },
      'h'
    ),
    { host: 'h', bootId: 'b', lastSeq: 2 }
  );
});

test('the summary counts relevant events, keeps the worst severity and the newest three', () => {
  const events = [
    event(1, 'info'),
    event(2, 'warning', 'Star lost', 'Guider'),
    event(3, 'error', 'Park failed', 'Mount'),
    event(4, 'warning', 'HFR high'),
    event(5, 'warning', 'Clouds'),
  ];
  const summary = summarizeMissedEvents(events, 'warning');
  assert.equal(summary.count, 4);
  assert.equal(summary.worst, 'error');
  assert.deepEqual(
    summary.latest.map((e) => e.seq),
    [5, 4, 3]
  );
  assert.equal(summarizeMissedEvents([event(1, 'info')], 'warning'), null);
  assert.equal(summarizeMissedEvents([], 'info'), null);
});

test('toast types follow the worst severity', () => {
  assert.equal(toastTypeForSeverity('error'), 'error');
  assert.equal(toastTypeForSeverity('warning'), 'warning');
  assert.equal(toastTypeForSeverity('success'), 'info');
});

test('rig SSIDs are merged newest first, trimmed, without duplicates and capped', () => {
  assert.deepEqual(mergeSsids(['pins-rig', 'Home'], [' Home ', 'Garden', '']), [
    'Home',
    'Garden',
    'pins-rig',
  ]);
  const many = Array.from({ length: 15 }, (_, i) => `net${i}`);
  assert.equal(mergeSsids([], many).length, MAX_RIG_SSIDS);
  assert.deepEqual(mergeSsids(null, null), []);
});

test('SSIDs are read from the daemon Wi-Fi status and its connections', () => {
  assert.deepEqual(
    ssidsFromWifiStatus({
      ssid: 'Home',
      connections: [
        { role: 'hotspot', ssid: 'pins-rig' },
        { role: 'client', ssid: null },
      ],
    }),
    ['Home', 'pins-rig']
  );
  assert.deepEqual(ssidsFromWifiStatus({ Success: false }), []);
  assert.deepEqual(ssidsFromWifiStatus(null), []);
});
