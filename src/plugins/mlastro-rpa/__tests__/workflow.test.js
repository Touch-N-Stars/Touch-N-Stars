import test from 'node:test';
import assert from 'node:assert/strict';
import { startAutomaticAlignment } from '../workflow.js';

function fixture() {
  const calls = [];
  return {
    calls,
    args: {
      verify: async () => {
        calls.push('verify');
        return { Action: 'start-alignment' };
      },
      select: async () => calls.push('select'),
      enable: async () => calls.push('enable'),
      send: async () => calls.push('send'),
      stop: async () => calls.push('stop'),
      isCancelled: () => false,
    },
  };
}
test('start selects and enables before sending exactly one start', async () => {
  const { calls, args } = fixture();
  await startAutomaticAlignment(args);
  assert.deepEqual(calls, ['verify', 'select', 'enable', 'send']);
});
test('stop during enable never sends alignment and disables the late enable', async () => {
  const { calls, args } = fixture();
  let cancelled = false;
  args.enable = async () => {
    calls.push('enable');
    cancelled = true;
  };
  args.isCancelled = () => cancelled;
  await assert.rejects(startAutomaticAlignment(args), /cancelled/);
  assert.deepEqual(calls, ['verify', 'select', 'enable', 'stop']);
});
test('preflight failure never arms the controller', async () => {
  const { calls, args } = fixture();
  args.verify = async () => {
    throw new Error('camera offline');
  };
  await assert.rejects(startAutomaticAlignment(args), /camera offline/);
  assert.deepEqual(calls, []);
});
test('uncertain enable failure requests stop without retrying start', async () => {
  const { calls, args } = fixture();
  args.enable = async () => {
    calls.push('enable');
    throw new Error('timeout');
  };
  await assert.rejects(startAutomaticAlignment(args), /timeout/);
  assert.deepEqual(calls, ['verify', 'select', 'enable', 'stop']);
});
test('failed stop is surfaced explicitly', async () => {
  const { args } = fixture();
  args.send = async () => {
    throw new Error('socket closed');
  };
  args.stop = async () => {
    throw new Error('offline');
  };
  await assert.rejects(startAutomaticAlignment(args), /shutdown could not be confirmed/);
});
test('a socket refusing the start disables the controller', async () => {
  const { calls, args } = fixture();
  args.send = async () => {
    calls.push('send');
    return false;
  };
  await assert.rejects(startAutomaticAlignment(args), /could not be sent/);
  assert.deepEqual(calls, ['verify', 'select', 'enable', 'send', 'stop']);
});
