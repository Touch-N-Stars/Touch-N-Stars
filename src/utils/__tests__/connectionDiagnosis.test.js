import test from 'node:test';
import assert from 'node:assert/strict';
import { backendKind, diagnoseConnection } from '@/utils/connectionDiagnosis';

const diagnose = (facts) =>
  diagnoseConnection({ issue: { type: 'unreachable' }, kind: 'unknown', elapsed: 60, ...facts });

test('a short outage shows no help', () => {
  assert.equal(diagnose({ elapsed: 14 }), 'searching');
  assert.equal(diagnose({ elapsed: 14, issue: null }), 'searching');
  assert.equal(diagnose({ elapsed: 14, issue: { type: 'api' } }), 'searching');
  // Back from the background: the daemon answers before the app's own check is through
  assert.equal(diagnose({ elapsed: 5, issue: null, boxAnswers: true }), 'searching');
  assert.equal(diagnose({ elapsed: 5, kind: 'pins', issue: { type: 'api' } }), 'searching');
});

test('silence is explained for the kind of backend', () => {
  assert.equal(diagnose({ kind: 'pins' }), 'rigSilent');
  assert.equal(diagnose({ kind: 'nina' }), 'ninaSilent');
  assert.equal(diagnose({ kind: 'unknown' }), 'silent');
});

test('a rig that answers without PINS is starting, then down', () => {
  assert.equal(diagnose({ boxAnswers: true, elapsed: 15 }), 'pinsStarting');
  assert.equal(diagnose({ boxAnswers: true, elapsed: 120 }), 'pinsDown');
  assert.equal(diagnose({ kind: 'pins', issue: { type: 'api' } }), 'pinsStarting');
});

test('the API, the versions and blocked live updates have their own answer', () => {
  assert.equal(diagnose({ issue: { type: 'api' }, kind: 'nina' }), 'apiMissing');
  assert.equal(diagnose({ issue: { type: 'liveUpdates' }, boxAnswers: true }), 'liveBlocked');
  for (const type of ['tnsVersion', 'apiVersion']) {
    assert.equal(diagnose({ issue: { type }, elapsed: 0 }), 'update');
  }
});

test('another backend in the network is offered, but not while the own rig is on', () => {
  const found = [{ host: '192.168.1.5' }];
  assert.equal(diagnose({ found, elapsed: 5 }), 'found');
  assert.equal(diagnose({ found, boxAnswers: true }), 'pinsStarting');
});

test('the kind comes from the rig id, the saved detection, this session or the hotspot', () => {
  const hotspotHost = '10.42.0.1';
  const kind = (facts) => backendKind({ hotspotHost, ...facts });
  assert.equal(kind({ instance: { rigId: 'pins-1', backendKind: 'nina' } }), 'pins');
  assert.equal(kind({ instance: { backendKind: 'nina' }, seenKind: 'pins' }), 'nina');
  assert.equal(kind({ instance: null, seenKind: 'pins' }), 'pins');
  assert.equal(kind({ instance: null, host: hotspotHost }), 'pins');
  assert.equal(kind({ instance: {}, host: '192.168.1.2' }), 'unknown');
});
