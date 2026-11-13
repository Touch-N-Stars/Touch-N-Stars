import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyAfLogMessage, selectAfStatusEntries } from '../afStatusLog.js';

const line = (second, message) => ({
  timestamp: `2026-11-13T21:00:${String(second).padStart(2, '0')}.0000`,
  message,
});
const kinds = (entries) => entries.map((e) => e.kind);

test('classifyAfLogMessage recognises the autofocus progress lines', () => {
  assert.equal(classifyAfLogMessage('Moving Focuser to position 12000'), 'move');
  assert.equal(classifyAfLogMessage('Starting Exposure - Exposure Time: 2s'), 'exposure');
  assert.equal(classifyAfLogMessage('AutoFocus completed'), 'complete');
  assert.equal(
    classifyAfLogMessage('AutoFocus completed with focuser starting at 1 and ending at 2'),
    'complete'
  );
  assert.equal(
    classifyAfLogMessage('AutoFocus did not complete successfully, so restoring the focuser'),
    'failed'
  );
  assert.equal(classifyAfLogMessage('Guider settled'), null);
  assert.equal(classifyAfLogMessage(undefined), null);
});

test('returns the last entries of a running autofocus from an existing log window', () => {
  // This is the state right after a resume: the lines are already in the store.
  const logs = [
    line(1, 'Starting Exposure'),
    line(2, 'Moving Focuser to position 100'),
    line(3, 'Guider settled'),
    line(4, 'Starting Exposure'),
    line(5, 'Moving Focuser to position 200'),
  ];
  const entries = selectAfStatusEntries(logs);
  assert.deepEqual(kinds(entries), ['move', 'exposure', 'move']);
  assert.equal(entries[2].message, 'Moving Focuser to position 200');
});

test('sorts by timestamp regardless of the backend order', () => {
  const logs = [
    line(5, 'Moving Focuser to position 200'),
    line(4, 'Starting Exposure'),
    line(2, 'Moving Focuser to position 100'),
  ];
  assert.deepEqual(
    selectAfStatusEntries(logs).map((e) => e.timestamp),
    [logs[2].timestamp, logs[1].timestamp, logs[0].timestamp]
  );
});

test('a new run hides the result of the previous one', () => {
  const logs = [
    line(1, 'Moving Focuser to position 100'),
    line(2, 'AutoFocus completed'),
    line(3, 'Moving Focuser to position 150'),
    line(4, 'Starting Exposure'),
  ];
  assert.deepEqual(kinds(selectAfStatusEntries(logs)), ['exposure']);
});

test('the restore move after a failed run stays with that run', () => {
  const logs = [
    line(1, 'Starting Exposure'),
    line(2, 'AutoFocus did not complete successfully, so restoring the focuser position to 100'),
    line(3, 'Moving Focuser to position 100'),
  ];
  assert.deepEqual(kinds(selectAfStatusEntries(logs)), ['exposure', 'failed', 'move']);
});

test('ignores unparsable timestamps and non-array input', () => {
  assert.deepEqual(selectAfStatusEntries(null), []);
  assert.deepEqual(selectAfStatusEntries([{ timestamp: 'x', message: 'Starting Exposure' }]), []);
});
