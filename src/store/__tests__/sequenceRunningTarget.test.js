import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../test-helpers/browserEnv.js';

installBrowserGlobals();

// Import AFTER the globals exist: the stores' transitive imports touch
// browser APIs at module load.
const { useSequenceStore } = await import('@/store/sequenceStore');
const { useSequenceV2Store } = await import('@/store/sequenceV2Store');

const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';
const COORDS = 'RA: 00:42:44; Dec: 41° 16\' 07"; Epoch: J2000; Position Angle: 0';

// The legacy state/json responses this store polls carry no FullTypeName.
function dso(name, status, target = COORDS) {
  return { Name: name, Status: status, Target: target, Items: [] };
}

function tree(targetItems) {
  return [
    { GlobalTriggers: [] },
    { Name: 'Start', Items: [] },
    { Name: 'Targets', Items: targetItems },
    { Name: 'End', Items: [] },
  ];
}

function setup() {
  freshPinia();
  return useSequenceStore();
}

test('reports name and position of the running target', () => {
  const store = setup();
  store.updateRunningTarget(
    tree([dso('M 31', 'FINISHED'), dso('M 42', 'RUNNING'), dso('M 51', 'CREATED')])
  );
  assert.equal(store.targetName, 'M 42');
  assert.equal(store.lastTargetName, 'M 42');
  assert.equal(store.runningTargetIndex, 1);
  assert.equal(store.targetCount, 3);
});

test('finds a target nested in a sequential container', () => {
  const store = setup();
  store.updateRunningTarget(
    tree([
      dso('M 31', 'FINISHED'),
      { Name: 'Sequential', Status: 'RUNNING', Items: [dso('NGC 7000', 'RUNNING')] },
    ])
  );
  assert.equal(store.targetName, 'NGC 7000');
  assert.equal(store.runningTargetIndex, 1);
  assert.equal(store.targetCount, 2);
});

test('never uses the coordinate string as the name', () => {
  const store = setup();
  store.updateRunningTarget(tree([dso('M 31', 'RUNNING')]));
  assert.equal(store.targetName, 'M 31');
});

test('prefers TargetName of an object target', () => {
  const store = setup();
  store.updateRunningTarget(tree([dso('Container', 'RUNNING', { TargetName: 'M 13' })]));
  assert.equal(store.targetName, 'M 13');
});

test('also recognises a DSO container by its FullTypeName', () => {
  const store = setup();
  store.updateRunningTarget(
    tree([{ Name: 'M 31', Status: 'RUNNING', FullTypeName: DSO, Items: [] }])
  );
  assert.equal(store.targetName, 'M 31');
});

test('clears the running target but keeps the last name', () => {
  const store = setup();
  store.updateRunningTarget(tree([dso('M 31', 'RUNNING'), dso('M 42', 'CREATED')]));
  store.updateRunningTarget(tree([dso('M 31', 'FINISHED'), dso('M 42', 'FINISHED')]));
  assert.equal(store.targetName, '');
  assert.equal(store.lastTargetName, 'M 31');
  assert.equal(store.runningTargetIndex, -1);
  assert.equal(store.targetCount, 2);
});

test('falls back to the V2 tree when sequence/json carries no Target', async () => {
  const store = setup();
  const v2 = useSequenceV2Store();
  // The V2 page is polling, so the tree is fresh and no request may be made.
  v2.isFetching = () => true;
  v2.fetchStatusUpdate = async () => assert.fail('must not fetch while the V2 page polls');
  v2.loaded = true;
  v2.data = tree([
    { Id: 'a', Name: 'M 31 Panel 1-1', Status: 'RUNNING', FullTypeName: DSO, Items: [] },
    { Id: 'b', Name: 'M 33', Status: 'CREATED', FullTypeName: DSO, Items: [] },
  ]);
  // Shape of sequence/json: names with a _Container suffix, no Target, no type.
  store.sequenceInfo = tree([
    { Name: 'M 31 Panel 1-1_Container', Status: 'RUNNING', Items: [] },
    { Name: 'M 33_Container', Status: 'CREATED', Items: [] },
  ]);

  await store.refreshRunningTarget(true);

  assert.equal(store.targetName, 'M 31 Panel 1-1');
  assert.equal(store.runningTargetIndex, 0);
  assert.equal(store.targetCount, 2);
});
