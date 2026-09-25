import test from 'node:test';
import assert from 'node:assert/strict';

const { profileHasEquipment, shouldOfferWizardForProfile } =
  await import('@/utils/setupWizardProfile');

const base = { isPINS: true, profileId: 'guid-new', hasEquipment: false, seenIds: ['guid-old'] };

test('offers the wizard for an unseen profile without devices on PINS', () => {
  assert.equal(shouldOfferWizardForProfile(base), true);
});

test('never offers it outside PINS', () => {
  assert.equal(shouldOfferWizardForProfile({ ...base, isPINS: false }), false);
});

test('waits until the profile id is known', () => {
  assert.equal(shouldOfferWizardForProfile({ ...base, profileId: undefined }), false);
});

test('skips a profile that already has devices selected', () => {
  assert.equal(shouldOfferWizardForProfile({ ...base, hasEquipment: true }), false);
});

test('skips a profile the wizard was already offered for', () => {
  assert.equal(shouldOfferWizardForProfile({ ...base, seenIds: ['guid-new'] }), false);
});

test('a fresh profile has no equipment', () => {
  assert.equal(
    profileHasEquipment({
      CameraSettings: { Id: 'No_Device' },
      TelescopeSettings: { Id: 'No_Device' },
      // What NINA puts into a brand-new profile.
      GuiderSettings: { GuiderName: 'PHD2' },
    }),
    false
  );
});

test('any selected device counts as equipment', () => {
  assert.equal(profileHasEquipment({ TelescopeSettings: { Id: 'INDI_Mount' } }), true);
});

test('the placeholder profile before the first fetch has no equipment', () => {
  assert.equal(profileHasEquipment({ CameraSettings: { MinFlatExposureTime: 0 } }), false);
});
