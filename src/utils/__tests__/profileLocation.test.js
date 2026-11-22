import test from 'node:test';
import assert from 'node:assert/strict';

const { hasProfileLocation, syncDirectionForSelect } = await import('@/utils/profileLocation');

test('a fresh profile at 0/0 has no location', () => {
  assert.equal(hasProfileLocation({ AstrometrySettings: { Latitude: 0, Longitude: 0 } }), false);
  assert.equal(
    hasProfileLocation({ AstrometrySettings: { Latitude: 48.1, Longitude: 11.6 } }),
    true
  );
});

test('on PINS the PROMPT of a fresh profile shows as sync to telescope', () => {
  assert.equal(syncDirectionForSelect('PROMPT', true), 'TOTELESCOPE');
});

test('on NINA PROMPT keeps showing as no sync', () => {
  assert.equal(syncDirectionForSelect('PROMPT', false), 'NOSYNC');
});

test('a chosen sync direction is shown as it is', () => {
  for (const raw of ['NOSYNC', 'TOAPPLICATION', 'TOTELESCOPE']) {
    assert.equal(syncDirectionForSelect(raw, true), raw);
    assert.equal(syncDirectionForSelect(raw, false), raw);
  }
});

test('an unknown direction shows as no sync', () => {
  assert.equal(syncDirectionForSelect(undefined, true), 'NOSYNC');
});

test('on PINS a profile without a location suggests sending the first location to the mount', () => {
  // NOSYNC is what the connect dialog recommends while there is no location yet.
  assert.equal(syncDirectionForSelect('NOSYNC', true, false), 'TOTELESCOPE');
  assert.equal(syncDirectionForSelect('PROMPT', true, false), 'TOTELESCOPE');
});

test('once the profile has a location, a saved NOSYNC is respected', () => {
  assert.equal(syncDirectionForSelect('NOSYNC', true, true), 'NOSYNC');
});

test('without a location a choice to take the mount location is kept', () => {
  assert.equal(syncDirectionForSelect('TOAPPLICATION', true, false), 'TOAPPLICATION');
});

test('on NINA nothing changes without a location', () => {
  assert.equal(syncDirectionForSelect('NOSYNC', false, false), 'NOSYNC');
  assert.equal(syncDirectionForSelect('PROMPT', false, false), 'NOSYNC');
});
