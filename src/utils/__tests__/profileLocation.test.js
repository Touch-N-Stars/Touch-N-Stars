import test from 'node:test';
import assert from 'node:assert/strict';

const { hasProfileLocation, isMountLocationSyncError, mountSiteDiffers, syncDirectionForSelect } =
  await import('@/utils/profileLocation');

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

test('a mount that stores its site rounded still has the profile location', () => {
  const profile = { latitude: 48.137, longitude: 11.575 };
  // Sky simulator: 0.01°
  assert.equal(mountSiteDiffers(profile, { latitude: 48.14, longitude: 11.58 }), false);
  // LX200: whole arc minutes (48°08′, 11°35′)
  assert.equal(
    mountSiteDiffers(profile, { latitude: 48 + 8 / 60, longitude: 11 + 35 / 60 }),
    false
  );
  // A location that never arrived
  assert.equal(mountSiteDiffers(profile, { latitude: 0, longitude: 0 }), true);
  assert.equal(mountSiteDiffers(profile, { latitude: 48.137, longitude: 11.7 }), true);
  // Nothing to compare yet
  assert.equal(mountSiteDiffers(profile, { latitude: null, longitude: null }), false);
});

test("NINA's location sync error is recognised by the profile's numbers in any language", () => {
  const profile = { latitude: 48.13712, longitude: 11.57534 };
  assert.equal(
    isMountLocationSyncError(
      'Unable to set mount latitude to 48.137 and longitude to 11.575!',
      profile
    ),
    true
  );
  assert.equal(
    isMountLocationSyncError(
      'Montierung kann Breitengrad nicht auf 48,137 und Längengrad auf 11,575 setzen!',
      profile
    ),
    true
  );
  assert.equal(
    isMountLocationSyncError('架台の緯度を 48.137 、経度を 11.575 に設定できません!', profile),
    true
  );
  assert.equal(
    isMountLocationSyncError('Unable to set mount latitude to -33.9 and longitude to 18.4!', {
      latitude: -33.9,
      longitude: 18.4,
    }),
    true
  );
});

test('other errors and other locations are not taken for the location sync error', () => {
  const profile = { latitude: 48.137, longitude: 11.575 };
  assert.equal(
    isMountLocationSyncError('Unable to set mount latitude to 50.1 and longitude to 8.7!', profile),
    false
  );
  assert.equal(isMountLocationSyncError('Unable to set mount elevation to 520!', profile), false);
  assert.equal(isMountLocationSyncError('Camera error 48.137', profile), false);
  assert.equal(isMountLocationSyncError(undefined, profile), false);
  assert.equal(isMountLocationSyncError('Unable to set … 48.137 … 11.575', {}), false);
});
