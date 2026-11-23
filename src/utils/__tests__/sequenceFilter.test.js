import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNameChoices,
  nextUnusedFilter,
  switchFilterName,
  switchFilterUpdate,
} from '../sequenceFilter.js';

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

test('filterNameChoices takes the item, then the connected wheel, then the profile', () => {
  const wheel = { AvailableFilters: [{ Name: 'Ha' }, { Name: 'OIII' }] };
  const profile = { FilterWheelSettings: { FilterWheelFilters: [{ Name: 'P1' }] } };
  assert.deepEqual(filterNameChoices(pinsItem, wheel, profile), NAMES);
  assert.deepEqual(filterNameChoices(ninaItem, wheel, profile), ['Ha', 'OIII']);
  assert.deepEqual(filterNameChoices(ninaItem, null, profile), ['P1']);
  assert.deepEqual(filterNameChoices(null, null, null), []);
});

test('nextUnusedFilter picks the first filter in wheel order the target does not use yet', () => {
  assert.equal(nextUnusedFilter(NAMES, []), 'L');
  assert.equal(nextUnusedFilter(NAMES, ['L', 'G']), 'R');
  assert.equal(nextUnusedFilter(NAMES, NAMES), null);
  assert.equal(nextUnusedFilter([], ['L']), null);
  assert.equal(nextUnusedFilter(['', 'Ha'], undefined), 'Ha');
});
