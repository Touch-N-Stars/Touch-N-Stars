import test from 'node:test';
import assert from 'node:assert/strict';
import { switchFilterName, switchFilterUpdate } from '../sequenceFilter.js';

const NAMES = ['L', 'R', 'G', 'B'];

// PINS fork: SelectedFilter (1-based slot), ComboBoxText, FilterNames.
const pinsItem = { Id: 'a', SelectedFilter: 2, ComboBoxText: 'R', FilterNames: NAMES };
// Official NINA: only Filter (FilterInfo or null), as served at /sequence/current.
const ninaItem = { Id: 'b', Filter: { Name: 'G', Position: 2 } };
const ninaCurrentFilter = { Id: 'c', Filter: null };

test('PINS shape keeps writing the 1-based SelectedFilter slot', () => {
  assert.deepEqual(switchFilterUpdate(pinsItem, NAMES, 'B'), {
    property: 'SelectedFilter',
    value: 4,
  });
  assert.equal(switchFilterName(pinsItem), 'R');
});

test('PINS shape is recognised from ComboBoxText alone', () => {
  assert.equal(switchFilterUpdate({ ComboBoxText: '' }, NAMES, 'L').property, 'SelectedFilter');
});

test('NINA shape writes Filter by name', () => {
  assert.deepEqual(switchFilterUpdate(ninaItem, NAMES, 'B'), { property: 'Filter', value: 'B' });
  assert.deepEqual(switchFilterUpdate(ninaCurrentFilter, NAMES, 'L'), {
    property: 'Filter',
    value: 'L',
  });
});

test('NINA shape reads the name from the FilterInfo object', () => {
  assert.equal(switchFilterName(ninaItem), 'G');
  assert.equal(switchFilterName(ninaCurrentFilter), '');
  assert.equal(switchFilterName(null), '');
});
