import test from 'node:test';
import assert from 'node:assert/strict';
import { readStored, readStoredJson, writeStored, writeStoredJson } from '../safeStorage.js';

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

const broken = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('stored values come back, missing ones fall back', () => {
  const storage = memoryStorage();
  assert.equal(readStored('a', 'x', storage), 'x');
  writeStored('a', 3, storage);
  assert.equal(readStored('a', 'x', storage), '3');

  writeStoredJson('o', { steps: ['Drift'] }, storage);
  assert.deepEqual(readStoredJson('o', {}, storage), { steps: ['Drift'] });
});

test('a throwing or broken storage never throws and yields the fallback', () => {
  assert.equal(readStored('a', 'x', broken), 'x');
  assert.doesNotThrow(() => writeStored('a', 1, broken));
  assert.deepEqual(readStoredJson('o', { d: 1 }, broken), { d: 1 });
  assert.doesNotThrow(() => writeStoredJson('o', {}, broken));

  const storage = memoryStorage();
  storage.setItem('o', '{not json');
  assert.deepEqual(readStoredJson('o', {}, storage), {});
  storage.setItem('o', '42');
  assert.deepEqual(readStoredJson('o', {}, storage), {}, 'only objects count');
});
