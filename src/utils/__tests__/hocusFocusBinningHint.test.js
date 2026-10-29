import test from 'node:test';
import assert from 'node:assert/strict';

const { translateBinningHint, translateBinningDetail } =
  await import('@/utils/hocusFocusBinningHint');

// Echoes the key and its parameters, so the tests see what was recognised.
const t = (key, params) =>
  params ? `${key.split('.').pop()}(${JSON.stringify(params)})` : key.split('.').pop();

const RIG =
  ' Changing focal length, pixel size or capture binning discards this measurement, so it always describes the current rig.';

test('hint: every known server sentence is recognised', () => {
  assert.equal(translateBinningHint('Run an auto-focus to get a recommendation', t), 'none');
  assert.equal(
    translateBinningHint('Measured in-focus HFR 7.2 px - 2x2 recommended', t),
    'recommended({"hfr":"7.2","factor":"2"})'
  );
  assert.equal(
    translateBinningHint('Measured in-focus HFR 1.4 px - below the 2-4 px range', t),
    'below({"hfr":"1.4"})'
  );
  assert.equal(
    translateBinningHint('Measured in-focus HFR 3.1 px - 1x1 is right', t),
    'right({"hfr":"3.1","factor":"1"})'
  );
});

test('hint: a comma decimal separator is accepted', () => {
  assert.equal(
    translateBinningHint('Measured in-focus HFR 1,4 px - below the 2-4 px range', t),
    'below({"hfr":"1.4"})'
  );
});

test('hint: unknown text and non-strings pass through unchanged', () => {
  assert.equal(translateBinningHint('Something new', t), 'Something new');
  assert.equal(translateBinningHint(undefined, t), undefined);
});

test('detail: below the band, with timestamp', () => {
  const text =
    'Measured 10/28/2026 9:14 PM from your last auto-focus, in captured pixels. Star detection is calibrated for in-focus stars of roughly 2 to 4 px, and 1.4 px is below that range. Detection binning cannot help here: it only divides, so no factor makes a star larger. The setting that can is MinHFR - lower it so stars this small are not rejected, or run the Star Detection Optimization wizard, which seeds it from the sweep.' +
    RIG;
  assert.equal(
    translateBinningDetail(text, t),
    'measuredAt({"when":"10/28/2026 9:14 PM"}) below({"hfr":"1.4"}) rigChange'
  );
});

test('detail: recommended factor, without timestamp', () => {
  const text =
    'Measured from your last auto-focus, in captured pixels. Star detection is calibrated for in-focus stars of roughly 2 to 4 px; at 7.2 px, binning 2x2 for detection brings that to about 3.6 px.' +
    RIG;
  assert.equal(
    translateBinningDetail(text, t),
    'measured recommended({"hfr":"7.2","factor":"2","binned":"3.6"}) rigChange'
  );
});

test('detail: in range, and nothing measured', () => {
  const text =
    'Measured from your last auto-focus, in captured pixels. Star detection is calibrated for in-focus stars of roughly 2 to 4 px, and 3.1 px is already in that range, so binning is not needed.' +
    RIG;
  assert.equal(translateBinningDetail(text, t), 'measured right({"hfr":"3.1"}) rigChange');
  assert.equal(
    translateBinningDetail('Nothing measured yet. Run an auto-focus, or a live sweep ...', t),
    'none'
  );
});

test('detail: unknown reasoning passes through unchanged', () => {
  const text = 'Measured from your last auto-focus, in captured pixels. Something else.';
  assert.equal(translateBinningDetail(text, t), text);
});
