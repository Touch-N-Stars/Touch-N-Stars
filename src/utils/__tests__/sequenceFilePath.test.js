import test from 'node:test';
import assert from 'node:assert/strict';
import { joinSequenceFilePath, isRelativeFolder } from '../sequenceFilePath.js';

test('PINS with a relative folder joins with "/" instead of "\\"', () => {
  // The reported case: a backslash became part of the file name on Linux.
  assert.equal(joinSequenceFilePath('N.I.N.A', 'test', true), 'N.I.N.A/test.json');
});

test('PINS absolute folder', () => {
  assert.equal(
    joinSequenceFilePath('/home/pi/Documents/N.I.N.A', 'test', true),
    '/home/pi/Documents/N.I.N.A/test.json'
  );
});

test('Windows NINA keeps the folder separator and defaults to "\\"', () => {
  assert.equal(
    joinSequenceFilePath('C:\\Users\\me\\Documents\\N.I.N.A', 'test', false),
    'C:\\Users\\me\\Documents\\N.I.N.A\\test.json'
  );
  assert.equal(joinSequenceFilePath('C:/Seq', 'test', false), 'C:/Seq/test.json');
  assert.equal(joinSequenceFilePath('N.I.N.A', 'test', false), 'N.I.N.A\\test.json');
});

test('trailing separator is not doubled', () => {
  assert.equal(joinSequenceFilePath('/seq/', 'a', true), '/seq/a.json');
  assert.equal(joinSequenceFilePath('C:\\Seq\\', 'a', false), 'C:\\Seq\\a.json');
});

test('empty folder yields the bare file name', () => {
  assert.equal(joinSequenceFilePath('', 'a', true), 'a.json');
  assert.equal(joinSequenceFilePath(undefined, 'a', false), 'a.json');
});

test('existing .json extension is kept', () => {
  assert.equal(joinSequenceFilePath('/seq', 'a.json', true), '/seq/a.json');
  assert.equal(joinSequenceFilePath('/seq', 'a.JSON', true), '/seq/a.JSON');
});

test('isRelativeFolder', () => {
  assert.equal(isRelativeFolder('N.I.N.A'), true);
  assert.equal(isRelativeFolder('Documents/N.I.N.A'), true);
  assert.equal(isRelativeFolder('/home/pi/Documents/N.I.N.A'), false);
  assert.equal(isRelativeFolder('C:\\Users\\me'), false);
  assert.equal(isRelativeFolder('d:/seq'), false);
  assert.equal(isRelativeFolder('\\\\server\\share'), false);
  assert.equal(isRelativeFolder(''), false);
  assert.equal(isRelativeFolder(undefined), false);
});
