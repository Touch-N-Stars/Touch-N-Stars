import test from 'node:test';
import assert from 'node:assert/strict';
import { frameWideReason, isStarProblem, reasonKey } from '../starReasons.js';

const primary = { isPrimary: true, used: true, rejectReason: null };
const star = (rejectReason) => ({ isPrimary: false, used: !rejectReason, rejectReason });

test('known reasons have a locale key, unknown ones and none do not', () => {
  assert.equal(reasonKey('Stabilizing'), 'Stabilizing');
  assert.equal(reasonKey('NotMeasured'), 'NotMeasured');
  assert.equal(reasonKey('SomethingNew'), null);
  assert.equal(reasonKey(null), null);
});

test('only problems with the star itself are warnings', () => {
  assert.equal(isStarProblem('Lost'), true);
  assert.equal(isStarProblem('Miss'), true);
  assert.equal(isStarProblem('NotGuiding'), false);
  assert.equal(isStarProblem('BeyondMaxStars'), false);
});

test('a frame-wide reason is reported when every secondary star shares it', () => {
  assert.equal(frameWideReason([primary, star('NotGuiding'), star('NotGuiding')]), 'NotGuiding');
  assert.equal(frameWideReason([primary, star('Settling')]), 'Settling');
});

test('no frame-wide reason when stars differ, are used, or the reason is about the star', () => {
  assert.equal(frameWideReason([primary, star('Stabilizing'), star('Lost')]), null);
  assert.equal(frameWideReason([primary, star(null), star('Stabilizing')]), null);
  assert.equal(frameWideReason([primary, star('Lost'), star('Lost')]), null);
  assert.equal(frameWideReason([primary, star('BeyondMaxStars')]), null);
  assert.equal(frameWideReason([primary]), null);
  assert.equal(frameWideReason(undefined), null);
});
