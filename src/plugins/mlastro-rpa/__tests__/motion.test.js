import test from 'node:test';
import assert from 'node:assert/strict';
import { canDisconnect, motionRecovery } from '../motion.js';

test('faulted motion remains inhibited but permits disconnect even with a retained jog', () => {
  const status = {
    connected: true,
    motionState: 'Faulted',
    motionInhibited: true,
    jogActive: true,
  };
  assert.deepEqual(motionRecovery(status), { faulted: true, inhibited: true });
  assert.equal(canDisconnect(status, true, false), true);
  assert.equal(canDisconnect(status, true, true), false);
});

test('stopping inhibits motion and does not bypass an active jog', () => {
  const status = {
    connected: true,
    motionState: 'Stopping',
    motionInhibited: true,
    jogActive: true,
  };
  assert.deepEqual(motionRecovery(status), { faulted: false, inhibited: true });
  assert.equal(canDisconnect(status, false, false), false);
});

test('fresh ready connection allows movement and ordinary disconnect', () => {
  const status = {
    connected: true,
    motionState: 'Ready',
    motionInhibited: false,
    motionFault: null,
  };
  assert.deepEqual(motionRecovery(status), {
    faulted: false,
    inhibited: false,
  });
  assert.equal(canDisconnect(status, false, false), true);
  assert.equal(canDisconnect({ ...status, connected: false }, false, false), false);
});
