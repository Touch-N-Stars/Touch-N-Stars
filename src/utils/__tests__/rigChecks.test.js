import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LOW_DISK_BYTES,
  sequenceContains,
  sequencePreflight,
  shutdownRigCheck,
} from '@/utils/rigChecks';
import { COOL_CAMERA_TYPE, START_GUIDING_TYPE, UNPARK_SCOPE_TYPE } from '@/utils/sequenceSimple';

const ready = () => ({
  mountInfo: { Connected: true, AtPark: false, TrackingEnabled: true },
  cameraInfo: {
    Connected: true,
    CanSetTemperature: true,
    CoolerOn: true,
    Temperature: -10.2,
    TemperatureSetPoint: -10,
  },
  guiderInfo: { Connected: true },
  safetyInfo: { Connected: true, IsSafe: true },
});

const tree = (...types) => [
  {
    FullTypeName: 'NINA.Sequencer.Container.SequenceRootContainer',
    Items: [
      {
        FullTypeName: 'NINA.Sequencer.Container.StartAreaContainer',
        Items: types.map((type) => ({
          FullTypeName: `${type}, NINA.Sequencer`,
          Status: 'CREATED',
        })),
      },
    ],
  },
];

const keys = (warnings) => warnings.map((warning) => warning.key);

test('a ready rig gives no warnings', () => {
  assert.deepEqual(sequencePreflight(ready(), tree(), { exists: true, freeBytes: 50e9 }), []);
});

test('sequenceContains finds nested items, ignores disabled ones and is unknown without types', () => {
  assert.equal(sequenceContains(tree(UNPARK_SCOPE_TYPE), UNPARK_SCOPE_TYPE), true);
  assert.equal(sequenceContains(tree(COOL_CAMERA_TYPE), UNPARK_SCOPE_TYPE), false);
  const disabled = tree(UNPARK_SCOPE_TYPE);
  disabled[0].Items[0].Items[0].Status = 'DISABLED';
  assert.equal(sequenceContains(disabled, UNPARK_SCOPE_TYPE), false);
  assert.equal(sequenceContains([{ Name: 'Legacy', Items: [] }], UNPARK_SCOPE_TYPE), null);
  assert.equal(sequenceContains(undefined, UNPARK_SCOPE_TYPE), null);
});

test('unsafe, disconnected mount and camera are reported', () => {
  const rig = ready();
  rig.safetyInfo.IsSafe = false;
  rig.mountInfo.Connected = false;
  rig.cameraInfo.Connected = false;
  assert.deepEqual(keys(sequencePreflight(rig, tree(), null)), [
    'unsafe',
    'mountNotConnected',
    'cameraNotConnected',
  ]);
});

test('a disconnected safety monitor is not reported as unsafe', () => {
  const rig = ready();
  rig.safetyInfo = { Connected: false, IsSafe: false };
  assert.deepEqual(sequencePreflight(rig, tree(), null), []);
});

test('a parked mount is fine when the sequence unparks it', () => {
  const rig = ready();
  rig.mountInfo.AtPark = true;
  assert.deepEqual(keys(sequencePreflight(rig, tree(), null)), ['mountParked']);
  assert.deepEqual(sequencePreflight(rig, tree(UNPARK_SCOPE_TYPE), null), []);
});

test('a mount that does not track is reported', () => {
  const rig = ready();
  rig.mountInfo.TrackingEnabled = false;
  assert.deepEqual(keys(sequencePreflight(rig, tree(), null)), ['mountNotTracking']);
});

test('cooler off or off the setpoint, unless the sequence cools', () => {
  const rig = ready();
  rig.cameraInfo.Temperature = 3.04;
  assert.deepEqual(sequencePreflight(rig, tree(), null), [
    { key: 'cameraNotAtSetpoint', params: { temperature: 3, setpoint: -10 } },
  ]);
  assert.deepEqual(sequencePreflight(rig, tree(COOL_CAMERA_TYPE), null), []);

  rig.cameraInfo.CoolerOn = false;
  assert.deepEqual(keys(sequencePreflight(rig, tree(), null)), ['coolerOff']);
});

test('a camera without a cooler is never warned about its temperature', () => {
  const rig = ready();
  rig.cameraInfo = { Connected: true, CanSetTemperature: false, CoolerOn: false, Temperature: 20 };
  assert.deepEqual(sequencePreflight(rig, tree(), null), []);
});

test('a missing guider only matters when the sequence starts guiding', () => {
  const rig = ready();
  rig.guiderInfo.Connected = false;
  assert.deepEqual(sequencePreflight(rig, tree(), null), []);
  assert.deepEqual(keys(sequencePreflight(rig, tree(START_GUIDING_TYPE), null)), [
    'guiderNotConnected',
  ]);
});

test('image disk: missing folder, low space, unknown space', () => {
  assert.deepEqual(sequencePreflight(ready(), tree(), { path: '/mnt/usb', exists: false }), [
    { key: 'imageFolderMissing', params: { path: '/mnt/usb' } },
  ]);
  assert.deepEqual(
    sequencePreflight(ready(), tree(), { path: '/img', exists: true, freeBytes: 2.5 * 1024 ** 3 }),
    [{ key: 'lowDisk', params: { free: 2.5 } }]
  );
  assert.deepEqual(
    sequencePreflight(ready(), tree(), { path: '/img', exists: true, freeBytes: LOW_DISK_BYTES }),
    []
  );
  assert.deepEqual(
    sequencePreflight(ready(), tree(), { path: '/img', exists: true, freeBytes: null }),
    []
  );
});

test('shutdown check lists what is still running or open', () => {
  const rig = {
    mountInfo: { Connected: true, AtPark: false },
    cameraInfo: { Connected: true, CanSetTemperature: true, CoolerOn: true, Temperature: -9.96 },
    domeInfo: { Connected: true, ShutterStatus: 'ShutterOpen' },
    flatdeviceInfo: { Connected: true, CoverState: 'Open' },
  };
  assert.deepEqual(shutdownRigCheck(rig, true), [
    { key: 'sequenceRunning', params: {} },
    { key: 'mountUnparked', params: {} },
    { key: 'cameraCold', params: { temperature: -10 } },
    { key: 'domeOpen', params: {} },
    { key: 'coverOpen', params: {} },
  ]);
});

test('shutdown check is quiet for a secured or disconnected rig', () => {
  assert.deepEqual(
    shutdownRigCheck(
      {
        mountInfo: { Connected: true, AtPark: true },
        cameraInfo: { Connected: true, CanSetTemperature: true, CoolerOn: false },
        domeInfo: { Connected: true, ShutterStatus: 'ShutterClosed' },
        flatdeviceInfo: { Connected: true, CoverState: 'Closed' },
      },
      false
    ),
    []
  );
  assert.deepEqual(shutdownRigCheck({}, false), []);
});
