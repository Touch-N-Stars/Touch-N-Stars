import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_DSS_SKY_SURVEY_SOURCE,
  equatorialToHorizontal,
  horizontalToEquatorial,
} from '@acocalypso/celestia-atlas';

const ATLAS_REVISION = '573330b03688ca041c4c2adee3de39ac94ec2399';
const TOLERANCE_DEG = 1e-10;

function angularErrorDeg(actual, expected) {
  return Math.abs(((actual - expected + 540) % 360) - 180);
}

test('uses the corrected pinned J2000 observed-frame transform', () => {
  const observer = {
    latitudeDeg: 52.52,
    longitudeDeg: 13.405,
    elevationM: 35,
  };
  const timestampUtcMs = Date.parse('2026-07-13T00:00:00.000Z');
  const coordinates = { raDeg: 120, decDeg: 30, frame: 'J2000' };
  const horizontal = equatorialToHorizontal(coordinates, observer, timestampUtcMs);

  assert.ok(angularErrorDeg(horizontal.azimuthDeg, 3.3919848105957726) < TOLERANCE_DEG);
  assert.ok(Math.abs(horizontal.altitudeDeg + 7.483089613944132) < TOLERANCE_DEG);

  const inverse = horizontalToEquatorial(horizontal, observer, timestampUtcMs, 'J2000');
  assert.ok(angularErrorDeg(inverse.raDeg, coordinates.raDeg) < TOLERANCE_DEG);
  assert.ok(Math.abs(inverse.decDeg - coordinates.decDeg) < TOLERANCE_DEG);
});

test('pins the Atlas build that provides the default photographic survey', () => {
  assert.equal(DEFAULT_DSS_SKY_SURVEY_SOURCE.key, 'dss2-color');
  assert.equal(DEFAULT_DSS_SKY_SURVEY_SOURCE.frame, 'ICRS');
});

test('keeps the host package and lockfile on the same immutable HTTPS revision', async () => {
  const [manifest, lockfile] = await Promise.all([
    readFile(new URL('../../../../package.json', import.meta.url), 'utf8'),
    readFile(new URL('../../../../package-lock.json', import.meta.url), 'utf8'),
  ]);
  const expected = `git+https://github.com/acocalypso/celestia_atlas.git#${ATLAS_REVISION}`;

  assert.equal(JSON.parse(manifest).dependencies['@acocalypso/celestia-atlas'], expected);
  const parsedLockfile = JSON.parse(lockfile);
  assert.equal(parsedLockfile.packages[''].dependencies['@acocalypso/celestia-atlas'], expected);
  assert.equal(
    parsedLockfile.packages['node_modules/@acocalypso/celestia-atlas'].resolved,
    expected
  );
});
