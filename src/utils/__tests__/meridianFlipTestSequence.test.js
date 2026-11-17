import test from 'node:test';
import assert from 'node:assert/strict';

const { buildFlipTestSequence, isFlipTestSequenceState } =
  await import('@/utils/meridianFlipTestSequence');

function findAll(node, predicate, out = []) {
  if (Array.isArray(node)) node.forEach((n) => findAll(n, predicate, out));
  else if (node && typeof node === 'object') {
    if (predicate(node)) out.push(node);
    Object.values(node).forEach((v) => findAll(v, predicate, out));
  }
  return out;
}

const byType = (fragment) => (n) => typeof n.$type === 'string' && n.$type.includes(fragment);

test('buildFlipTestSequence: tracking, wait loop and the flip trigger on the root, no slew', () => {
  const seq = buildFlipTestSequence({ waitSeconds: 300, waitCount: 7 });

  // A goto would let a mount with a preferred pier side skip to the post-flip side.
  assert.equal(findAll(seq, byType('SlewScopeToRaDec')).length, 0);
  assert.equal(findAll(seq, byType('SetTracking'))[0].TrackingMode, 0);
  assert.equal(findAll(seq, byType('WaitForTimeSpan'))[0].Time, 300);
  assert.equal(findAll(seq, byType('LoopCondition'))[0].Iterations, 7);

  assert.equal(seq.Triggers.$values.length, 1);
  assert.ok(seq.Triggers.$values[0].$type.includes('MeridianFlipTrigger'));
});

test('buildFlipTestSequence: every $ref points to an existing $id', () => {
  const seq = buildFlipTestSequence({ waitSeconds: 60, waitCount: 3 });
  const ids = new Set(findAll(seq, (n) => '$id' in n).map((n) => n.$id));
  const refs = findAll(seq, (n) => '$ref' in n).map((n) => n.$ref);
  assert.ok(refs.length > 0);
  for (const ref of refs) assert.ok(ids.has(ref), `dangling $ref ${ref}`);
  assert.equal(ids.size, findAll(seq, (n) => '$id' in n).length, 'duplicate $id');
});

test('isFlipTestSequenceState finds the test container in a NINA state response', () => {
  // Shape as returned by /sequence/state on the Pi after loading the test sequence.
  const state = [
    { GlobalTriggers: [{ Name: 'Meridianflip_Trigger', Status: 'CREATED' }] },
    { Name: 'Start_Container', Items: [] },
    { Name: 'Targets_Container', Items: [{ Name: 'TNS meridian flip test_Container' }] },
  ];
  assert.equal(isFlipTestSequenceState(state), true);
  assert.equal(isFlipTestSequenceState([{ Name: 'Targets_Container', Items: [] }]), false);
  assert.equal(isFlipTestSequenceState(null), false);
});
