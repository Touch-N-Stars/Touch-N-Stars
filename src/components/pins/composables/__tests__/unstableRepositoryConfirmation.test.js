import test from 'node:test';
import assert from 'node:assert/strict';
import { useUnstableRepositoryConfirmation } from '../useUnstableRepositoryConfirmation.js';

function setup() {
  const switches = [];
  let allowed = true;
  return {
    switches,
    disable: () => {
      allowed = false;
    },
    ...useUnstableRepositoryConfirmation({
      canSwitch: () => allowed,
      onSwitch: (channel) => switches.push(channel),
    }),
  };
}

test('unstable switches only after two separate Yes confirmations', () => {
  const state = setup();
  state.requestSwitch('unstable');
  assert.equal(state.confirmationStep.value, 1);
  assert.deepEqual(state.switches, []);
  state.confirmUnstable();
  assert.equal(state.confirmationStep.value, 2);
  assert.deepEqual(state.switches, []);
  state.confirmUnstable();
  assert.equal(state.confirmationStep.value, 0);
  assert.deepEqual(state.switches, ['unstable']);
  state.confirmUnstable();
  assert.deepEqual(state.switches, ['unstable']);
});

test('No cancels either step and reopening starts at the first warning', () => {
  for (const step of [1, 2]) {
    const state = setup();
    state.requestSwitch('unstable');
    if (step === 2) state.confirmUnstable();
    state.cancelConfirmation();
    state.confirmUnstable();
    assert.deepEqual(state.switches, []);
    state.requestSwitch('unstable');
    assert.equal(state.confirmationStep.value, 1);
  }
});

test('switching back to stable does not ask for confirmation', () => {
  const state = setup();
  state.requestSwitch('trixie');
  assert.equal(state.confirmationStep.value, 0);
  assert.deepEqual(state.switches, ['trixie']);
});

test('busy or unavailable repositories cannot open or finish confirmation', () => {
  const state = setup();
  state.requestSwitch('unstable');
  state.confirmUnstable();
  state.disable();
  state.confirmUnstable();
  state.requestSwitch('unstable');
  state.requestSwitch('trixie');
  assert.equal(state.confirmationStep.value, 0);
  assert.deepEqual(state.switches, []);
});
