import test from 'node:test';
import assert from 'node:assert/strict';
import { createPinia, setActivePinia } from 'pinia';

const { usePickerStore } = await import('@/store/pickerStore');

function open(value, { min = 0, max = 5000, decimals = 0 } = {}) {
  setActivePinia(createPinia());
  const picker = usePickerStore();
  picker.open('label', min, max, value, () => {}, decimals);
  return picker;
}

test('the first digit replaces the shown start value', () => {
  // Seen in the setup assistant: 500 + "200" became 500200 and the check stayed grey
  const picker = open(500);
  picker.appendDigit(2);
  picker.appendDigit(0);
  picker.appendDigit(0);
  assert.equal(picker.inputString, '200');
  assert.equal(picker.isOutOfRange, false);
});

test('backspace edits the shown value instead of replacing it', () => {
  const picker = open(500);
  picker.backspace();
  picker.appendDigit(8);
  assert.equal(picker.inputString, '508');
});

test('a missing start value ("NaN") opens empty', () => {
  const picker = open('NaN');
  assert.equal(picker.inputString, '');
  picker.appendDigit(4);
  assert.equal(picker.inputString, '4');
});

test('minus as the first key starts a new negative number', () => {
  const picker = open(-10, { min: -40, max: 20 });
  picker.setNegative();
  picker.appendDigit(5);
  assert.equal(picker.inputString, '-5');
});

test('a decimal point as the first key starts at 0.', () => {
  const picker = open(5, { max: 50, decimals: 1 });
  picker.appendDecimal();
  picker.appendDigit(5);
  assert.equal(picker.inputString, '0.5');
});
