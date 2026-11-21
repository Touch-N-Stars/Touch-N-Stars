import test from 'node:test';
import assert from 'node:assert/strict';

const { tppaStartBlocker, tppaValidationError } = await import('@/utils/tppaProblems');

test('a missing location or star database blocks the start', () => {
  assert.equal(tppaStartBlocker({ hasLocation: false, databaseMissing: true }), 'noLocation');
  assert.equal(tppaStartBlocker({ hasLocation: true, databaseMissing: true }), 'noDatabase');
  assert.equal(tppaStartBlocker({ hasLocation: true, databaseMissing: false }), null);
  // Unknown database state (older daemon) never blocks
  assert.equal(tppaStartBlocker({ hasLocation: true, databaseMissing: null }), null);
});

test('the validation error of a refused start is read from the log', () => {
  const logs = [
    {
      timestamp: '2026-11-21T07:27:31.4459',
      message:
        'Failed validation: Category: , Item: PolarAlignment, Rate: 3, Distance: 10 - No location has been set. Please set your latitude and longitude first as it is critical for the calculation to work!',
    },
    { timestamp: '2026-11-21T07:27:31.4457', message: 'Instruction  failed after 1 attempt.' },
  ];
  const since = new Date('2026-11-21T07:27:30').getTime();
  assert.match(tppaValidationError(logs, since), /^No location has been set/);
  // An older refusal does not belong to this start
  assert.equal(tppaValidationError(logs, new Date('2026-11-21T07:28:00').getTime()), null);
  assert.equal(tppaValidationError(null, 0), null);
});
