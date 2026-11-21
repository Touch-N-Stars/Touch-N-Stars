import test from 'node:test';
import assert from 'node:assert/strict';

const {
  fieldOfViewDeg,
  recommendAstapDatabase,
  hasInstalledAstapDatabase,
  DEFAULT_ASTAP_DATABASE,
} = await import('@/utils/astapDatabases');

test('field of view uses the smaller sensor side', () => {
  // Sky simulator: 2000x1500 px, 2.9 µm, 200 mm -> 4.35 mm short side -> ~1.25°
  const fov = fieldOfViewDeg({
    focalLengthMm: 200,
    pixelSizeUm: 2.9,
    widthPx: 2000,
    heightPx: 1500,
  });
  assert.ok(Math.abs(fov - 1.246) < 0.01, `got ${fov}`);
});

test('field of view is null without usable inputs', () => {
  assert.equal(
    fieldOfViewDeg({ focalLengthMm: 'NaN', pixelSizeUm: 3.76, widthPx: 6000, heightPx: 4000 }),
    null
  );
  assert.equal(
    fieldOfViewDeg({ focalLengthMm: 500, pixelSizeUm: 0, widthPx: 6000, heightPx: 4000 }),
    null
  );
  assert.equal(
    fieldOfViewDeg({ focalLengthMm: 500, pixelSizeUm: 3.76, widthPx: 0, heightPx: 4000 }),
    null
  );
});

test('recommends by field of view', () => {
  assert.equal(recommendAstapDatabase(0.3), 'D50');
  assert.equal(recommendAstapDatabase(0.6), 'D05');
  assert.equal(recommendAstapDatabase(1.25), 'D05');
  assert.equal(recommendAstapDatabase(12), 'G05');
  assert.equal(recommendAstapDatabase(35), 'W08');
});

test('recommends the default for an unknown field of view', () => {
  assert.equal(recommendAstapDatabase(null), DEFAULT_ASTAP_DATABASE);
  assert.equal(recommendAstapDatabase(NaN), DEFAULT_ASTAP_DATABASE);
});

test('installed state comes from the daemon flag', () => {
  assert.equal(hasInstalledAstapDatabase([{ databaseId: 'D50', installed: false }]), false);
  assert.equal(
    hasInstalledAstapDatabase([
      { databaseId: 'D50', installed: false },
      { databaseId: 'D05', installed: true },
    ]),
    true
  );
});

test('installed state is unknown without the flag or a list', () => {
  assert.equal(hasInstalledAstapDatabase([{ databaseId: 'D50' }]), null);
  assert.equal(hasInstalledAstapDatabase([]), null);
  assert.equal(hasInstalledAstapDatabase(null), null);
});
