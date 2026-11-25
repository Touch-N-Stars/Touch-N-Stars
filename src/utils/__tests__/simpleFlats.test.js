import test from 'node:test';
import assert from 'node:assert/strict';

const {
  defaultLightSource,
  flatFilterConfig,
  flatsRunState,
  flatsTargetName,
  hasDimmablePanel,
  planFilterNames,
  LIGHT_SOURCE_MODES,
} = await import('@/utils/simpleFlats');
const { nightKey } = await import('@/utils/simpleMode');

const SMART = 'NINA.Sequencer.SequenceItem.Imaging.SmartExposure';
const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';

function exposure(
  filter,
  { completed = 0, iterations = 10, type = 'LIGHT', status = 'CREATED' } = {}
) {
  return {
    Id: `${filter}-${type}`,
    FullTypeName: SMART,
    Status: status,
    Items: [
      {
        FullTypeName: 'NINA.Sequencer.SequenceItem.FilterWheel.SwitchFilter',
        Filter: { Name: filter },
      },
      {
        FullTypeName: 'NINA.Sequencer.SequenceItem.Imaging.TakeExposure',
        ExposureTime: 60,
        ImageType: type,
      },
    ],
    Conditions: [
      {
        FullTypeName: 'NINA.Sequencer.Conditions.LoopCondition',
        Iterations: iterations,
        CompletedIterations: completed,
      },
    ],
  };
}

function target(name, items) {
  return { Id: name, FullTypeName: DSO, Name: name, Target: { TargetName: name }, Items: items };
}

function plan(...targets) {
  return [
    { Id: 'root', GlobalTriggers: [] },
    { Id: 'targets', FullTypeName: 'NINA.Sequencer.Container.TargetAreaContainer', Items: targets },
  ];
}

test('a dimmable flat panel is the default light source, otherwise the tablet', () => {
  assert.equal(defaultLightSource({ Connected: true, MaxBrightness: 255 }), 'panel');
  assert.equal(defaultLightSource({ Connected: true, MaxBrightness: 0 }), 'tablet');
  assert.equal(defaultLightSource({ Connected: false, MaxBrightness: 255 }), 'tablet');
  assert.equal(defaultLightSource(undefined), 'tablet');
  assert.equal(hasDimmablePanel({ Connected: true, MaxBrightness: 100 }), true);
});

test('the light sources map to the flat assistant modes, sky flats are not offered', () => {
  assert.deepEqual(LIGHT_SOURCE_MODES, { panel: 'AutoBrightness', tablet: 'AutoExposure' });
});

test('the plan filters are those of its light frames, in plan order, each once', () => {
  const tree = plan(
    target('M 31', [exposure('L'), exposure('R'), exposure('L')]),
    target('M 42', [exposure('Ha'), exposure('R', { type: 'DARK' })]),
    target('M 45', [exposure('OIII', { status: 'DISABLED' })])
  );
  assert.deepEqual(planFilterNames(tree), ['L', 'R', 'Ha']);
  assert.deepEqual(planFilterNames([]), []);
});

test('the flats take the name of the target imaged last', () => {
  const tree = plan(
    target('M 31', [exposure('L', { completed: 10 })]),
    target('M 42', [exposure('L', { completed: 3 })]),
    target('M 45', [exposure('L')])
  );
  assert.equal(flatsTargetName(tree), 'M 42');
});

test('before anything was imaged the flats take the first named target', () => {
  assert.equal(flatsTargetName(plan(target('M 31', [exposure('L')]))), 'M 31');
});

test('without a named target the flats get no target name', () => {
  const unnamed = {
    Id: 'x',
    FullTypeName: DSO,
    Name: 'Deep Sky Object Instruction Set',
    Items: [],
  };
  assert.equal(flatsTargetName(plan(unnamed)), '');
  assert.equal(flatsTargetName([]), '');
});

test('a filter takes its flat wizard values from the profile', () => {
  const profile = {
    CameraSettings: { Gain: 100, Offset: 30 },
    FilterWheelSettings: {
      FilterWheelFilters: [
        {
          FlatWizardFilterSettings: {
            Gain: -1,
            Offset: 12,
            Binning: { Name: '2x2' },
            HistogramMeanTarget: 0.45,
            HistogramTolerance: 0.08,
            MinFlatExposureTime: 0.1,
            MaxFlatExposureTime: 10,
            MinAbsoluteFlatDeviceBrightness: 5,
            MaxAbsoluteFlatDeviceBrightness: 200,
          },
        },
      ],
    },
  };
  const config = flatFilterConfig(profile, 0, 20);
  assert.equal(config.count, 20);
  assert.equal(config.gain, 100); // -1 = the camera's gain
  assert.equal(config.offset, 12);
  assert.equal(config.binning, '2x2');
  assert.equal(config.histogramMean, 45);
  assert.equal(config.meanTolerance, 8);
  assert.equal(config.maxExposure, 10);
  assert.equal(config.maxBrightness, 200);
});

test('without a filter wheel the general flat wizard values apply', () => {
  const config = flatFilterConfig(
    { FlatWizardSettings: { HistogramMeanTarget: 0.4, HistogramTolerance: 0.15 } },
    null,
    20
  );
  assert.equal(config.histogramMean, 40);
  assert.equal(config.meanTolerance, 15);
  assert.equal(config.gain, -1);
});

test('an unknown filter falls back to the defaults the flat assistant always used', () => {
  const config = flatFilterConfig({ FlatWizardSettings: { HistogramMeanTarget: 0.4 } }, 3, 20);
  assert.equal(config.histogramMean, 35);
  assert.equal(config.meanTolerance, 10);
});

test('a flat run counts for the night when every filter got its flats tonight', () => {
  const tonight = new Date('2026-11-22T23:30:00');
  const night = nightKey(tonight);
  const finished = (filters, finishedAt = tonight.toISOString()) => ({
    State: 'Finished',
    FinishedAt: finishedAt,
    Filters: filters,
  });

  assert.deepEqual(flatsRunState(finished([{ State: 'success' }, { State: 'success' }]), night), {
    running: false,
    succeededTonight: true,
  });
  assert.equal(
    flatsRunState(finished([{ State: 'success' }, { State: 'dim' }]), night).succeededTonight,
    false
  );
  // Flats of an earlier night do not count.
  assert.equal(
    flatsRunState(finished([{ State: 'success' }], '2026-11-20T23:00:00'), night).succeededTonight,
    false
  );
  assert.equal(flatsRunState({ State: 'Running', Filters: [] }, night).running, true);
  assert.deepEqual(flatsRunState(undefined, night), { running: false, succeededTonight: false });
});
