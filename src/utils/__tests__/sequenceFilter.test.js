import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterNameChoices,
  isFilterUnset,
  canKeepCurrentFilter,
  chosenFilterName,
  matchFilterName,
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

// PINS fills the item's list once: added before the wheel was connected, it stays empty and
// PINS stores any slot as "(Current)" (measured 2026-11-24).
test('an item that does not know the filter gets its name instead of a slot', () => {
  const stale = { SelectedFilter: 0, ComboBoxText: null, FilterNames: [] };
  assert.deepEqual(switchFilterUpdate(stale, NAMES, 'B'), { property: 'ComboBoxText', value: 'B' });
  const tooShort = { SelectedFilter: 1, ComboBoxText: 'L', FilterNames: ['L'] };
  assert.equal(switchFilterUpdate(tooShort, NAMES, 'R').property, 'ComboBoxText');
  // Not on the wheel: slot 0, as before (the Target Scheduler leaves the item alone then)
  assert.deepEqual(switchFilterUpdate(stale, NAMES, 'Ha'), {
    property: 'SelectedFilter',
    value: 0,
  });
});

test('keeping the current filter is slot 0 on PINS and reads as no filter', () => {
  assert.deepEqual(switchFilterUpdate(pinsItem, NAMES, ''), {
    property: 'SelectedFilter',
    value: 0,
  });
  assert.equal(canKeepCurrentFilter(pinsItem), true);
  assert.equal(canKeepCurrentFilter(ninaItem), false);
  assert.equal(chosenFilterName({ ComboBoxText: '(Aktuell)', FilterNames: NAMES }), '');
  assert.equal(chosenFilterName(pinsItem), 'R');
  // Never set is not the same: PINS moves to the first slot
  assert.equal(isFilterUnset({ ComboBoxText: null, SelectedFilter: 0 }), true);
  assert.equal(isFilterUnset({ ComboBoxText: '(Current)', SelectedFilter: 0 }), false);
  assert.equal(isFilterUnset(ninaCurrentFilter), false);
  // Official NINA has no such text: brackets there belong to the filter's name
  assert.equal(chosenFilterName({ Filter: { Name: '(Ha)' } }), '(Ha)');
});

test('a name stored as an identifier finds the filter as entered', () => {
  assert.equal(matchFilterName(['L', 'Ha 3nm'], 'Ha_3nm'), 'Ha 3nm');
  assert.equal(matchFilterName(['3nm Ha'], '_3nm_Ha'), '3nm Ha');
  assert.equal(matchFilterName(['L'], 'L'), 'L');
  assert.equal(matchFilterName(['L'], 'Gone'), 'Gone');
  assert.equal(matchFilterName(['L'], ''), '');
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
