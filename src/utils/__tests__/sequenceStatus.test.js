import test from 'node:test';
import assert from 'node:assert/strict';

const { displayStatus, displayIssues, isCompositeItem } = await import('@/utils/sequenceStatus');

const GAIN_ISSUE = 'Invalid Gain. The Gain has to be set between 100 and 10000 but is set to 0';

// The shape /sequence/current returns for a Take Many Exposures after a run in which every
// exposure failed validation with "continue on error".
function takeManyExposures({ status = 'FINISHED', exposureStatus = 'FAILED', issues = [] } = {}) {
  return {
    Id: 'id_10',
    Name: 'Take Many Exposures',
    Status: status,
    FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeManyExposures',
    Items: [
      {
        Id: 'id_11',
        Name: 'Take Exposure',
        Status: exposureStatus,
        FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure',
        Gain: 0,
        Issues: issues,
      },
    ],
    Conditions: [
      {
        Id: 'id_12',
        Status: 'FINISHED',
        FullTypeName: 'NINA.Sequencer.Conditions.LoopCondition',
        Iterations: 5,
        CompletedIterations: 5,
      },
    ],
    Triggers: [],
  };
}

test('a finished Take Many Exposures whose exposure failed reads FAILED', () => {
  assert.equal(displayStatus(takeManyExposures()), 'FAILED');
});

test('a finished Take Many Exposures whose exposure succeeded stays FINISHED', () => {
  assert.equal(displayStatus(takeManyExposures({ exposureStatus: 'FINISHED' })), 'FINISHED');
});

test('a running composite item keeps its own status', () => {
  assert.equal(displayStatus(takeManyExposures({ status: 'RUNNING' })), 'RUNNING');
});

test('a failed hidden trigger fails a Smart Exposure', () => {
  const item = {
    Status: 'FINISHED',
    FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.SmartExposure',
    Items: [{ Status: 'FINISHED' }, { Status: 'FINISHED' }],
    Triggers: [{ Status: 'FAILED' }],
    Conditions: [],
  };
  assert.equal(displayStatus(item), 'FAILED');
});

test('a disabled hidden child neither fails the card nor adds issues', () => {
  const item = takeManyExposures({ issues: [GAIN_ISSUE] });
  item.Items[0].Status = 'DISABLED';
  assert.equal(displayStatus(item), 'FINISHED');
  assert.deepEqual(displayIssues(item), []);
});

test('the children of a visible container do not change its status', () => {
  const item = {
    Status: 'FINISHED',
    FullTypeName: 'NINA.Sequencer.Container.SequentialContainer',
    Items: [{ Status: 'FAILED', Issues: [GAIN_ISSUE] }],
  };
  assert.equal(displayStatus(item), 'FINISHED');
  assert.deepEqual(displayIssues(item), []);
});

test('the issues of the hidden exposure show on the composite item', () => {
  assert.deepEqual(displayIssues(takeManyExposures({ issues: [GAIN_ISSUE] })), [GAIN_ISSUE]);
});

test('an issue reported by the container and its child is listed once', () => {
  const item = takeManyExposures({ issues: [GAIN_ISSUE] });
  item.Issues = [GAIN_ISSUE];
  assert.deepEqual(displayIssues(item), [GAIN_ISSUE]);
});

test('an item without issues has none', () => {
  assert.deepEqual(displayIssues({ Status: 'CREATED' }), []);
  assert.deepEqual(displayIssues(null), []);
});

test('only the editor composite types count as composite', () => {
  assert.equal(isCompositeItem(takeManyExposures()), true);
  assert.equal(
    isCompositeItem({ FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure' }),
    false
  );
  assert.equal(isCompositeItem(undefined), false);
});
