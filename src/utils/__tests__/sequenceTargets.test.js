import test from 'node:test';
import assert from 'node:assert/strict';

const {
  collectDsoContainers,
  findTargetAreaContainer,
  parseDsoTargetString,
  dsoContainerRaString,
  dsoContainerDecString,
} = await import('@/utils/sequenceTargets');

const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';
const TARGET_AREA = 'NINA.Sequencer.Container.TargetAreaContainer';

function dso(id, name, target) {
  return { Id: id, Name: name, FullTypeName: DSO, Target: target, Items: [] };
}

// The shape /sequence/current returns: a global-trigger carrier without a type name,
// then the three area containers.
function sequenceTree(targetAreaItems) {
  return [
    { Id: 'id_1', GlobalTriggers: [] },
    {
      Id: 'id_2',
      Name: 'Start',
      FullTypeName: 'NINA.Sequencer.Container.StartAreaContainer',
      Items: [],
    },
    { Id: 'id_3', Name: 'Targets', FullTypeName: TARGET_AREA, Items: targetAreaItems },
    {
      Id: 'id_4',
      Name: 'End',
      FullTypeName: 'NINA.Sequencer.Container.EndAreaContainer',
      Items: [],
    },
  ];
}

test('collectDsoContainers returns the targets in sequence order', () => {
  const tree = sequenceTree([dso('a', 'M 31'), dso('b', 'M 42')]);
  assert.deepEqual(
    collectDsoContainers(tree).map((c) => c.Id),
    ['a', 'b']
  );
});

test('collectDsoContainers descends into plain containers', () => {
  const nested = {
    Id: 'group',
    FullTypeName: 'NINA.Sequencer.Container.SequentialContainer',
    Items: [dso('b', 'M 42')],
  };
  const tree = sequenceTree([dso('a', 'M 31'), nested]);
  assert.deepEqual(
    collectDsoContainers(tree).map((c) => c.Id),
    ['a', 'b']
  );
});

test('collectDsoContainers does not descend into a DSO container', () => {
  const outer = dso('a', 'M 31');
  outer.Items = [dso('inner', 'M 42')];
  assert.deepEqual(
    collectDsoContainers(sequenceTree([outer])).map((c) => c.Id),
    ['a']
  );
});

test('collectDsoContainers tolerates missing item lists', () => {
  assert.deepEqual(collectDsoContainers(undefined), []);
  assert.deepEqual(collectDsoContainers([{ Id: 'x' }]), []);
});

test('findTargetAreaContainer finds the target area', () => {
  assert.equal(findTargetAreaContainer(sequenceTree([]))?.Id, 'id_3');
});

test('findTargetAreaContainer returns null when there is none', () => {
  assert.equal(findTargetAreaContainer([{ Id: 'x', Items: [] }]), null);
});

test('parseDsoTargetString reads the string form', () => {
  const parsed = parseDsoTargetString(
    'RA: 00:42:44; Dec: 41° 16\' 07"; Epoch: J2000; Position Angle: 12.5',
    'M 31'
  );
  assert.equal(parsed.RAHours, 0);
  assert.equal(parsed.RAMinutes, 42);
  assert.equal(parsed.RASeconds, 44);
  assert.equal(parsed.NegativeDec, false);
  assert.equal(parsed.DecDegrees, 41);
  assert.equal(parsed.PositionAngle, 12.5);
  assert.equal(parsed.TargetName, 'M 31');
});

test('parseDsoTargetString keeps the sign of a negative declination', () => {
  const parsed = parseDsoTargetString('RA: 05:35:17; Dec: -05° 23\' 28"; Position Angle: 0');
  assert.equal(parsed.NegativeDec, true);
  assert.equal(parsed.DecDegrees, 5);
});

test('parseDsoTargetString passes an object through and rejects garbage', () => {
  const object = { InputCoordinates: { RAHours: 1 } };
  assert.equal(parseDsoTargetString(object), object);
  assert.equal(parseDsoTargetString('nonsense'), null);
  assert.equal(parseDsoTargetString(''), null);
});

test('dsoContainer*String pad the sexagesimal parts', () => {
  const container = dso('a', 'M 31', 'RA: 00:42:44; Dec: 41° 16\' 07"; Position Angle: 0');
  assert.equal(dsoContainerRaString(container), '00:42:44');
  assert.equal(dsoContainerDecString(container), '+41°16\'07"');
});

test('dsoContainer*String return empty strings without coordinates', () => {
  const container = dso('a', 'M 31', null);
  assert.equal(dsoContainerRaString(container), '');
  assert.equal(dsoContainerDecString(container), '');
});

test('dsoContainerHasTarget tells a fresh container from one with a target', async () => {
  const { dsoContainerHasTarget, dsoContainerDecDegrees } = await import('@/utils/sequenceTargets');
  const fresh = {
    Name: 'Deep Sky Object Instruction Set',
    Target: 'RA: 00:00:00; Dec: 0° 0\' 0"; Epoch: J2000; Position Angle: 0',
  };
  assert.equal(dsoContainerHasTarget(fresh), false);
  assert.equal(dsoContainerHasTarget({ ...fresh, Name: 'M 31' }), true);
  const coordinatesOnly = {
    ...fresh,
    Target: 'RA: 00:42:44; Dec: -41° 16\' 07"; Epoch: J2000; Position Angle: 0',
  };
  assert.equal(dsoContainerHasTarget(coordinatesOnly), true);
  assert.ok(Math.abs(dsoContainerDecDegrees(coordinatesOnly) + 41.2686) < 0.001);
  assert.equal(dsoContainerHasTarget(null), false);
});
