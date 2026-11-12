import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isWpfRotatorContent,
  parseCultureInvariantNumber,
  toManualRotatorView,
} from '../manualRotatorContent.js';

const t = (key) => `t:${key}`;

test('WPF content keeps NINA texts and its own units', () => {
  const view = toManualRotatorView(
    {
      Text1: 'Current position',
      Text2: '12,5',
      Text3: '°',
      Text4: 'Target position',
      Text5: '97.25',
      Text6: '°',
      Text7: '84.75',
      Text8: '°',
      Text9: 'Rotate clockwise',
    },
    t
  );
  assert.equal(view.currentLabel, 'Current position');
  assert.equal(view.targetLabel, 'Target position');
  assert.equal(view.currentAngle, 12.5);
  assert.equal(view.targetAngle, 97.25);
  assert.equal(view.currentText, '12.5°');
  assert.equal(view.targetText, '97.25°');
  assert.equal(view.rotationText, '84.75°');
  assert.equal(view.direction, 'Rotate clockwise');
});

test('SignalR content uses translated labels, two decimals and a normalized target', () => {
  const view = toManualRotatorView(
    { Position: 10, AbsTargetPosition: 448, Rotation: '78', Direction: 'CounterClockwise' },
    t
  );
  assert.equal(view.currentLabel, 't:dialogs.manualRotator.currentPosition');
  assert.equal(view.targetLabel, 't:dialogs.manualRotator.targetPosition');
  assert.equal(view.currentText, '10.00°');
  assert.equal(view.targetAngle, 88);
  assert.equal(view.targetText, '88.00°');
  assert.equal(view.rotationText, '78.00°');
  assert.equal(view.direction, 'CounterClockwise');
});

test('SignalR content falls back to MechanicalPosition, TargetPosition and clockwise', () => {
  const view = toManualRotatorView({ MechanicalPosition: '5,5', TargetPosition: -30 }, t);
  assert.equal(view.currentAngle, 5.5);
  assert.equal(view.targetAngle, 330);
  assert.equal(view.rotationText, '0.00°');
  assert.equal(view.direction, 'Clockwise');
});

test('format detection needs both Text1 and Text2', () => {
  assert.equal(isWpfRotatorContent({ Text1: 'a', Text2: '1' }), true);
  assert.equal(isWpfRotatorContent({ Text1: 'a' }), false);
  assert.equal(isWpfRotatorContent(undefined), false);
});

test('culture-invariant parsing handles both decimal separators', () => {
  assert.equal(parseCultureInvariantNumber('1.234,5°'), 1234.5);
  assert.equal(parseCultureInvariantNumber('1,234.5'), 1234.5);
  assert.equal(parseCultureInvariantNumber('abc'), 0);
  assert.equal(parseCultureInvariantNumber(Number.NaN), 0);
});
