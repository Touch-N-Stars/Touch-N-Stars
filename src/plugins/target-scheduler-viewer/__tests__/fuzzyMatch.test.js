import test from 'node:test';
import assert from 'node:assert/strict';
import { fuzzyMatch } from '../fuzzyMatch.js';

test('empty query matches everything', () => {
  assert.equal(fuzzyMatch('M 17', ''), true);
  assert.equal(fuzzyMatch('', ''), true);
});

test('exact match', () => {
  assert.equal(fuzzyMatch('Emission Nebula', 'Emission Nebula'), true);
});

test('case-insensitive', () => {
  assert.equal(fuzzyMatch('Emission Nebula', 'EMISSION'), true);
  assert.equal(fuzzyMatch('emission nebula', 'Emission'), true);
});

test('substring match', () => {
  assert.equal(fuzzyMatch('Emission Nebula', 'Nebula'), true);
});

test('subsequence match tolerates missing letters', () => {
  // "emisneb" -> e-m-i-s-n-e-b, all found in order within "Emission Nebula"
  assert.equal(fuzzyMatch('Emission Nebula', 'emisneb'), true);
});

test('subsequence match tolerates missing spaces', () => {
  assert.equal(fuzzyMatch('M 17', 'm17'), true);
  assert.equal(fuzzyMatch('NGC 7000 - IC 5070', 'ngc7000ic5070'), true);
});

test('spaces in the query never require a literal space in the text', () => {
  assert.equal(fuzzyMatch('M17', 'm 1 7'), true);
});

test('characters out of order do not match', () => {
  assert.equal(fuzzyMatch('Emission Nebula', 'nebem'), false);
});

test('a character not present anywhere fails', () => {
  assert.equal(fuzzyMatch('Emission Nebula', 'xyz'), false);
});

test('query longer than remaining text fails without matching partially', () => {
  assert.equal(fuzzyMatch('M17', 'M17extra'), false);
});

test('repeated characters in query each require a fresh position', () => {
  // "mm" needs two distinct m's; "Andromeda" has only one 'm'
  assert.equal(fuzzyMatch('Andromeda', 'mm'), false);
  assert.equal(fuzzyMatch('Mmount', 'mm'), true);
});
