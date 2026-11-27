import test from 'node:test';
import assert from 'node:assert/strict';

const { wizardSummary } = await import('@/utils/setupWizardSummary');

const statusOf = (items, id) => items.find((i) => i.id === id)?.status;

// The profile of the lay-user test: no location, no filter wheel, no star database
const profile = {
  AstrometrySettings: { Latitude: 0, Longitude: 0 },
  TelescopeSettings: { Id: 'mount_sky_simulator', FocalLength: 200 },
  CameraSettings: { Id: 'camera_sky_simulator' },
  FocuserSettings: { Id: 'focuser_sky_simulator' },
  FilterWheelSettings: { Id: 'No_Device' },
  GuiderSettings: { GuiderName: 'InternalGuider' },
};

test('the summary reports what is really set up', () => {
  const items = wizardSummary({ profileInfo: profile, isPINS: true, databaseInstalled: false });
  assert.equal(statusOf(items, 'mount'), 'ok');
  assert.equal(statusOf(items, 'location'), 'warn');
  assert.equal(statusOf(items, 'filterWheel'), 'none');
  assert.equal(statusOf(items, 'flatPanel'), 'none', 'no FlatDeviceSettings at all');
  assert.equal(statusOf(items, 'guider'), 'ok');
  assert.equal(statusOf(items, 'starDatabase'), 'warn');
});

test('an unset focal length ("NaN") is no telescope set up', () => {
  const items = wizardSummary({
    profileInfo: { ...profile, TelescopeSettings: { Id: 'x', FocalLength: 'NaN' } },
    isPINS: false,
    databaseInstalled: null,
  });
  assert.equal(statusOf(items, 'telescope'), 'warn');
  // Without PINS there is no guider step and no star database step
  assert.equal(statusOf(items, 'guider'), undefined);
  assert.equal(statusOf(items, 'starDatabase'), undefined);
});

test('a selected flat panel counts as set up', () => {
  const items = wizardSummary({
    profileInfo: { ...profile, FlatDeviceSettings: { Id: 'flat_simulator' } },
    isPINS: false,
    databaseInstalled: null,
  });
  assert.equal(statusOf(items, 'flatPanel'), 'ok');
});

test('an unknown star database state is left out', () => {
  const items = wizardSummary({ profileInfo: profile, isPINS: true, databaseInstalled: null });
  assert.equal(statusOf(items, 'starDatabase'), undefined);
});
