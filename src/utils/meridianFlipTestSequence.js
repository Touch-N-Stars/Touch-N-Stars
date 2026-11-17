// NINA sequence for the real meridian flip test.
//
// The user has driven the scope by hand to a point a few minutes east of the meridian. The
// sequence turns tracking on and then only waits, in steps as long as the user's exposures.
// It carries no slew: a goto near the meridian lets a mount with a preferred pier side jump
// to the post-flip side. Without a target the trigger flips on the current coordinates.
// NINA's own MeridianFlipTrigger sits on the root, so the flip happens exactly as at night:
// with the profile's flip settings, NINA's flip routine and at the real time - and without
// the app having to stay open. The JSON shape follows what the sequence creator plugin
// produces.

const COLLECTION = (itemType) =>
  `System.Collections.ObjectModel.ObservableCollection\`1[[${itemType}, NINA.Sequencer]], System.ObjectModel`;
const ITEMS = COLLECTION('NINA.Sequencer.SequenceItem.ISequenceItem');
const CONDITIONS = COLLECTION('NINA.Sequencer.Conditions.ISequenceCondition');
const TRIGGERS = COLLECTION('NINA.Sequencer.Trigger.ISequenceTrigger');
const SEQUENTIAL = 'NINA.Sequencer.Container.ExecutionStrategy.SequentialStrategy, NINA.Sequencer';

export const FLIP_TEST_SEQUENCE_NAME = 'TNS meridian flip test';

// True when a /sequence/state response belongs to the test sequence. NINA reports the
// container name with a suffix ("TNS meridian flip test_Container").
export function isFlipTestSequenceState(state) {
  if (Array.isArray(state)) return state.some(isFlipTestSequenceState);
  if (!state || typeof state !== 'object') return false;
  if (typeof state.Name === 'string' && state.Name.startsWith(FLIP_TEST_SEQUENCE_NAME)) return true;
  return Object.values(state).some((v) => typeof v === 'object' && isFlipTestSequenceState(v));
}

export function buildFlipTestSequence({ waitSeconds, waitCount }) {
  let nextId = 1;
  const id = () => String(nextId++);

  const container = (type, name, parentId, items = [], conditions = []) => {
    const containerId = id();
    return {
      $id: containerId,
      $type: `NINA.Sequencer.Container.${type}, NINA.Sequencer`,
      Strategy: { $type: SEQUENTIAL },
      Name: name,
      Conditions: { $id: id(), $type: CONDITIONS, $values: conditions(containerId) },
      IsExpanded: true,
      Items: { $id: id(), $type: ITEMS, $values: items(containerId) },
      Triggers: { $id: id(), $type: TRIGGERS, $values: [] },
      Parent: parentId ? { $ref: parentId } : null,
      ErrorBehavior: 0,
      Attempts: 1,
    };
  };
  const none = () => [];

  const rootId = id();
  const root = {
    $id: rootId,
    $type: 'NINA.Sequencer.Container.SequenceRootContainer, NINA.Sequencer',
    Strategy: { $type: SEQUENTIAL },
    Name: FLIP_TEST_SEQUENCE_NAME,
    Conditions: { $id: id(), $type: CONDITIONS, $values: [] },
    IsExpanded: true,
    Items: { $id: id(), $type: ITEMS, $values: [] },
    Triggers: { $id: id(), $type: TRIGGERS, $values: [] },
    Parent: null,
    ErrorBehavior: 0,
    Attempts: 1,
  };

  root.Items.$values.push(container('StartAreaContainer', 'Start', rootId, none, none));

  const target = container(
    'TargetAreaContainer',
    'Targets',
    rootId,
    (targetId) => [
      container(
        'SequentialContainer',
        FLIP_TEST_SEQUENCE_NAME,
        targetId,
        (testId) => [
          {
            $id: id(),
            $type: 'NINA.Sequencer.SequenceItem.Telescope.SetTracking, NINA.Sequencer',
            TrackingMode: 0,
            Parent: { $ref: testId },
            ErrorBehavior: 0,
            Attempts: 1,
          },
          // Stand-ins for exposures: the trigger decides on their estimated duration.
          container(
            'SequentialContainer',
            'Exposures',
            testId,
            (waitsId) => [
              {
                $id: id(),
                $type: 'NINA.Sequencer.SequenceItem.Utility.WaitForTimeSpan, NINA.Sequencer',
                Time: waitSeconds,
                Parent: { $ref: waitsId },
                ErrorBehavior: 0,
                Attempts: 1,
              },
            ],
            (waitsId) => [
              {
                $id: id(),
                $type: 'NINA.Sequencer.Conditions.LoopCondition, NINA.Sequencer',
                CompletedIterations: 0,
                Iterations: waitCount,
                Parent: { $ref: waitsId },
              },
            ]
          ),
        ],
        none
      ),
    ],
    none
  );
  root.Items.$values.push(target);

  root.Items.$values.push(container('EndAreaContainer', 'End', rootId, none, none));

  root.Triggers.$values.push({
    $id: id(),
    $type: 'NINA.Sequencer.Trigger.MeridianFlip.MeridianFlipTrigger, NINA.Sequencer',
    Parent: { $ref: rootId },
    TriggerRunner: {
      $id: id(),
      $type: 'NINA.Sequencer.Container.SequentialContainer, NINA.Sequencer',
      Strategy: { $type: SEQUENTIAL },
      Name: null,
      Conditions: { $id: id(), $type: CONDITIONS, $values: [] },
      IsExpanded: true,
      Items: { $id: id(), $type: ITEMS, $values: [] },
      Triggers: { $id: id(), $type: TRIGGERS, $values: [] },
      Parent: null,
      ErrorBehavior: 0,
      Attempts: 1,
    },
  });

  return root;
}
