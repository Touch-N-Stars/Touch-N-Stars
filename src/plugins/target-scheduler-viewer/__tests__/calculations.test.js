import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRa,
  formatDec,
  autoAcceptStatus,
  exposureDurationsByFilter,
  computeExposureBarFill,
  planIntegrationSeconds,
  planExpectedIntegrationSeconds,
  computeRollup,
  computeTargetIntegration,
  classifyTargetCompletion,
  collectFilterNames,
  sortProjects,
  projectsToMarkdown,
  formatIntegrationTime,
  computeSummary,
  buildProjectSettingsRows,
  formatSegmentDuration,
  summarizeExposurePlan,
  isSegmentNow,
} from '../calculations.js';

test('formatRa converts decimal hours to h/m/s', () => {
  // M 8's real RA from the live API: 18.0696...h
  assert.equal(formatRa(18.06960686111111), '18h 4m 11s');
  assert.equal(formatRa(0), '0h 0m 0s');
});

test('formatDec converts decimal degrees to sign/d/m/s', () => {
  assert.equal(formatDec(-23.756548405555556), '-23° 45\' 24"');
  assert.equal(formatDec(0), '+0° 0\' 0"');
  assert.equal(formatDec(45.5), '+45° 30\' 0"');
});

test('autoAcceptStatus: -1 (sentinel) means no threshold configured', () => {
  assert.equal(autoAcceptStatus(-1), null);
});

test('autoAcceptStatus: null/undefined also means unset', () => {
  assert.equal(autoAcceptStatus(null), null);
  assert.equal(autoAcceptStatus(undefined), null);
});

test('autoAcceptStatus: 1 is below threshold (pass), 0 is above (fail)', () => {
  assert.equal(autoAcceptStatus(1), true);
  assert.equal(autoAcceptStatus(0), false);
});

test('exposureDurationsByFilter maps filter name to exposure seconds', () => {
  const plan = [
    { FilterName: 'Ha+OIII', Exposure: 300 },
    { FilterName: 'SII+OIII', Exposure: 180 },
  ];
  const map = exposureDurationsByFilter(plan);
  assert.equal(map.get('Ha+OIII'), 300);
  assert.equal(map.get('SII+OIII'), 180);
  assert.equal(map.size, 2);
});

test('exposureDurationsByFilter handles missing/empty plan', () => {
  assert.equal(exposureDurationsByFilter(undefined).size, 0);
  assert.equal(exposureDurationsByFilter([]).size, 0);
});

test('computeExposureBarFill: no desired frames yields zero fill', () => {
  const fill = computeExposureBarFill({ Desired: 0, Accepted: 0, Acquired: 0 });
  assert.deepEqual(fill, { acceptedPct: 0, pendingPct: 0 });
});

test('computeExposureBarFill: partial progress splits accepted/pending', () => {
  // 8 acquired, 0 accepted, desired 72 (M 8's Ha+OIII from the live API)
  const fill = computeExposureBarFill({ Desired: 72, Accepted: 0, Acquired: 8 });
  assert.ok(Math.abs(fill.acceptedPct - 0) < 1e-9);
  assert.ok(Math.abs(fill.pendingPct - (8 / 72) * 100) < 1e-9);
});

test('computeExposureBarFill: fully accepted', () => {
  const fill = computeExposureBarFill({ Desired: 100, Accepted: 100, Acquired: 100 });
  assert.equal(fill.acceptedPct, 100);
  assert.equal(fill.pendingPct, 0);
});

test('computeExposureBarFill: clamps when Accepted exceeds Desired (reshoots/edits)', () => {
  const fill = computeExposureBarFill({ Desired: 25, Accepted: 30, Acquired: 30 });
  assert.equal(fill.acceptedPct, 100);
  assert.equal(fill.pendingPct, 0);
});

test('computeExposureBarFill: pending never overflows the remaining space', () => {
  // Accepted 90/100 leaves 10% of the bar; 50 "pending" frames must not
  // blow past that remaining 10%.
  const fill = computeExposureBarFill({ Desired: 100, Accepted: 90, Acquired: 140 });
  assert.equal(fill.acceptedPct, 90);
  assert.equal(fill.pendingPct, 10);
});

test('computeRollup: aggregates desired/accepted across targets and filters', () => {
  const targets = [
    {
      ExposurePlan: [
        { Desired: 72, Accepted: 8 },
        { Desired: 72, Accepted: 0 },
      ],
    },
    {
      ExposurePlan: [{ Desired: 120, Accepted: 117 }],
    },
  ];
  const rollup = computeRollup(targets);
  assert.equal(rollup.desired, 264);
  assert.equal(rollup.accepted, 125);
  assert.equal(rollup.pct, Math.round((125 / 264) * 100));
});

const EMPTY_ROLLUP = {
  desired: 0,
  accepted: 0,
  pct: 0,
  integrationSeconds: 0,
  integrationTime: '0h 0m',
  expectedIntegrationSeconds: 0,
  expectedIntegrationTime: '0h 0m',
  remainingIntegrationSeconds: 0,
  remainingIntegrationTime: '0h 0m',
};

test('computeRollup: empty target list', () => {
  assert.deepEqual(computeRollup([]), EMPTY_ROLLUP);
  assert.deepEqual(computeRollup(undefined), EMPTY_ROLLUP);
});

test('computeRollup: clamps at 100% when accepted exceeds desired overall', () => {
  const targets = [{ ExposurePlan: [{ Desired: 10, Accepted: 15 }] }];
  assert.equal(computeRollup(targets).pct, 100);
});

test('computeRollup: targets/plans missing ExposurePlan do not throw', () => {
  assert.deepEqual(computeRollup([{}]), EMPTY_ROLLUP);
});

test('computeRollup: integration time — accepted, expected, and remaining', () => {
  const targets = [
    {
      ExposurePlan: [
        { Desired: 100, Accepted: 40, Exposure: 180 }, // accepted 7200s, expected 18000s
        { Desired: 50, Accepted: 50, Exposure: 300 }, // accepted 15000s, expected 15000s (done)
      ],
    },
  ];
  const rollup = computeRollup(targets);
  assert.equal(rollup.integrationSeconds, 7200 + 15000);
  assert.equal(rollup.expectedIntegrationSeconds, 18000 + 15000);
  assert.equal(rollup.remainingIntegrationSeconds, 18000 + 15000 - (7200 + 15000));
  assert.equal(rollup.integrationTime, formatIntegrationTime(7200 + 15000));
  assert.equal(rollup.expectedIntegrationTime, formatIntegrationTime(18000 + 15000));
});

test('computeRollup: remaining time never goes negative when accepted exceeds expected', () => {
  // A target that went over its Desired count after reshoots/edits.
  const targets = [{ ExposurePlan: [{ Desired: 10, Accepted: 20, Exposure: 60 }] }];
  const rollup = computeRollup(targets);
  assert.equal(rollup.remainingIntegrationSeconds, 0);
  assert.equal(rollup.remainingIntegrationTime, '0h 0m');
});

test('planExpectedIntegrationSeconds: Desired × Exposure, ignores Accepted', () => {
  assert.equal(
    planExpectedIntegrationSeconds({ Desired: 72, Accepted: 8, Exposure: 300 }),
    72 * 300
  );
});

test('planExpectedIntegrationSeconds: missing fields default to 0', () => {
  assert.equal(planExpectedIntegrationSeconds({}), 0);
  assert.equal(planExpectedIntegrationSeconds(undefined), 0);
});

test('planIntegrationSeconds: missing fields default to 0', () => {
  assert.equal(planIntegrationSeconds({}), 0);
  assert.equal(planIntegrationSeconds(undefined), 0);
});

test("computeTargetIntegration: sums a single target's own exposure plans", () => {
  const target = {
    ExposurePlan: [
      { Desired: 10, Accepted: 5, Exposure: 60 },
      { Desired: 10, Accepted: 5, Exposure: 120 },
    ],
  };
  const integration = computeTargetIntegration(target);
  assert.equal(integration.integrationSeconds, 5 * 60 + 5 * 120);
  assert.equal(integration.expectedIntegrationSeconds, 10 * 60 + 10 * 120);
});

test('formatIntegrationTime formats seconds as "Xh Ym"', () => {
  assert.equal(formatIntegrationTime(0), '0h 0m');
  assert.equal(formatIntegrationTime(3600), '1h 0m');
  assert.equal(formatIntegrationTime(5400), '1h 30m');
  assert.equal(formatIntegrationTime(59), '0h 1m'); // rounds up to the nearest minute
});

test('computeSummary: null projects (not yet loaded) returns null', () => {
  assert.equal(computeSummary(null, {}), null);
});

test('computeSummary: counts active projects, targets, completion %, integration time', () => {
  const projects = [{ State: 'Active' }, { State: 'Active' }, { State: 'Closed' }];
  const targetsByProject = {
    p1: {
      targets: [
        { ExposurePlan: [{ Desired: 100, Accepted: 50, Exposure: 180 }] },
        { ExposurePlan: [{ Desired: 50, Accepted: 50, Exposure: 300 }] },
      ],
    },
    p2: { targets: [] },
  };
  const summary = computeSummary(projects, targetsByProject);
  assert.equal(summary.activeProjects, 2);
  assert.equal(summary.targetCount, 2);
  // accepted 100/150 desired
  assert.equal(summary.completionPct, Math.round((100 / 150) * 100));
  // integration = 50*180 + 50*300 = 9000 + 15000 = 24000s = 6h 40m
  assert.equal(summary.integrationTime, '6h 40m');
});

test('computeSummary: no desired frames anywhere gives 0% completion, no NaN', () => {
  const projects = [{ State: 'Active' }];
  const targetsByProject = { p1: { targets: [{ ExposurePlan: [] }] } };
  const summary = computeSummary(projects, targetsByProject);
  assert.equal(summary.completionPct, 0);
  assert.equal(summary.integrationTime, '0h 0m');
});

test('buildProjectSettingsRows surfaces every project setting field', () => {
  const project = {
    Description: 'Test project',
    MinimumTime: 30,
    FilterSwitchFrequency: 10,
    DitherEvery: 3,
    MeridianWindow: 0,
    UseCustomHorizon: true,
    HorizonOffset: 2,
    MinimumAltitude: 0,
    MaximumAltitude: 90,
    EnableGrader: true,
    SmartExposureOrder: false,
    Mosaic: true,
  };
  const rows = Object.fromEntries(buildProjectSettingsRows(project).map((r) => [r.key, r]));
  assert.equal(rows['description'].text, 'Test project');
  assert.equal(rows['minimumTime'].minutes, 30);
  assert.equal(rows['horizon'].custom, true);
  assert.equal(rows['horizon'].offset, 2);
  assert.equal(rows['altitudeLimits'].min, 0);
  assert.equal(rows['altitudeLimits'].max, 90);
  assert.equal(rows['grading'].enabled, true);
  assert.equal(rows['smartExposureOrder'].enabled, false);
  assert.equal(rows['mosaic'].enabled, true);
});

test('buildProjectSettingsRows: no description falls back to null (caller renders the placeholder)', () => {
  const rows = Object.fromEntries(
    buildProjectSettingsRows({
      Description: null,
      MinimumTime: 0,
      FilterSwitchFrequency: 0,
      DitherEvery: 0,
      MeridianWindow: 0,
      UseCustomHorizon: false,
      HorizonOffset: 0,
      MinimumAltitude: 0,
      MaximumAltitude: 0,
      EnableGrader: false,
      SmartExposureOrder: false,
      Mosaic: false,
    }).map((r) => [r.key, r])
  );
  assert.equal(rows['description'].text, null);
  assert.equal(rows['horizon'].custom, false);
});

test('formatSegmentDuration formats minutes-only and hours+minutes', () => {
  assert.equal(formatSegmentDuration('2026-01-01T20:00:00Z', '2026-01-01T20:20:00Z'), '20m');
  assert.equal(formatSegmentDuration('2026-01-01T20:00:00Z', '2026-01-01T21:18:00Z'), '1h 18m');
});

test('summarizeExposurePlan groups counts by filter and formats as "N× Filter"', () => {
  const plan = [
    { FilterName: 'Ha+OIII', Count: 3 },
    { FilterName: 'SII+OIII', Count: 23 },
  ];
  assert.equal(summarizeExposurePlan(plan), '3× Ha+OIII, 23× SII+OIII');
});

test('summarizeExposurePlan merges duplicate filter entries', () => {
  const plan = [
    { FilterName: 'L', Count: 10 },
    { FilterName: 'L', Count: 5 },
  ];
  assert.equal(summarizeExposurePlan(plan), '15× L');
});

test('summarizeExposurePlan handles an empty plan', () => {
  assert.equal(summarizeExposurePlan([]), '');
  assert.equal(summarizeExposurePlan(undefined), '');
});

test('isSegmentNow: true when "now" falls inside [Start, End)', () => {
  const segment = { StartTime: '2026-01-01T20:00:00Z', EndTime: '2026-01-01T21:00:00Z' };
  const inside = new Date('2026-01-01T20:30:00Z').getTime();
  assert.equal(isSegmentNow(segment, inside), true);
});

test('isSegmentNow: false before start, false at/after end (half-open interval)', () => {
  const segment = { StartTime: '2026-01-01T20:00:00Z', EndTime: '2026-01-01T21:00:00Z' };
  const before = new Date('2026-01-01T19:59:59Z').getTime();
  const atEnd = new Date('2026-01-01T21:00:00Z').getTime();
  assert.equal(isSegmentNow(segment, before), false);
  assert.equal(isSegmentNow(segment, atEnd), false);
});

test('isSegmentNow: true exactly at start (inclusive)', () => {
  const segment = { StartTime: '2026-01-01T20:00:00Z', EndTime: '2026-01-01T21:00:00Z' };
  const atStart = new Date('2026-01-01T20:00:00Z').getTime();
  assert.equal(isSegmentNow(segment, atStart), true);
});

test('classifyTargetCompletion: no exposure plan at all is not-started', () => {
  assert.equal(classifyTargetCompletion({ ExposurePlan: [] }), 'not-started');
  assert.equal(classifyTargetCompletion({}), 'not-started');
});

test('classifyTargetCompletion: zero accepted frames is not-started', () => {
  const target = { ExposurePlan: [{ Desired: 72, Accepted: 0 }] };
  assert.equal(classifyTargetCompletion(target), 'not-started');
});

test('classifyTargetCompletion: some but not all accepted is in-progress', () => {
  const target = { ExposurePlan: [{ Desired: 72, Accepted: 30 }] };
  assert.equal(classifyTargetCompletion(target), 'in-progress');
});

test('classifyTargetCompletion: every desired frame accepted is done', () => {
  const target = { ExposurePlan: [{ Desired: 72, Accepted: 72 }] };
  assert.equal(classifyTargetCompletion(target), 'done');
});

test('classifyTargetCompletion: over-completed (reshoots/edits) still counts as done', () => {
  const target = { ExposurePlan: [{ Desired: 10, Accepted: 15 }] };
  assert.equal(classifyTargetCompletion(target), 'done');
});

test('classifyTargetCompletion: multiple filters combine before classifying', () => {
  // 30/72 accepted across two filters overall -> in-progress, even though
  // neither filter alone is "done".
  const target = {
    ExposurePlan: [
      { Desired: 36, Accepted: 20 },
      { Desired: 36, Accepted: 10 },
    ],
  };
  assert.equal(classifyTargetCompletion(target), 'in-progress');
});

test('collectFilterNames: unique, sorted, across all targets', () => {
  const targets = [
    { ExposurePlan: [{ FilterName: 'Ha+OIII' }, { FilterName: 'L' }] },
    { ExposurePlan: [{ FilterName: 'SII+OIII' }, { FilterName: 'L' }] },
  ];
  assert.deepEqual(collectFilterNames(targets), ['Ha+OIII', 'L', 'SII+OIII']);
});

test('collectFilterNames: empty/missing inputs', () => {
  assert.deepEqual(collectFilterNames([]), []);
  assert.deepEqual(collectFilterNames(undefined), []);
  assert.deepEqual(collectFilterNames([{}]), []);
});

test('sortProjects: by name, ascending', () => {
  const projects = [
    { Id: 'b', Name: 'Beta' },
    { Id: 'a', Name: 'Alpha' },
  ];
  const sorted = sortProjects(projects, {}, 'name', 'asc');
  assert.deepEqual(
    sorted.map((p) => p.Name),
    ['Alpha', 'Beta']
  );
});

test('sortProjects: by name, descending', () => {
  const projects = [
    { Id: 'a', Name: 'Alpha' },
    { Id: 'b', Name: 'Beta' },
  ];
  const sorted = sortProjects(projects, {}, 'name', 'desc');
  assert.deepEqual(
    sorted.map((p) => p.Name),
    ['Beta', 'Alpha']
  );
});

test('sortProjects: by priority', () => {
  const projects = [
    { Id: 'a', Name: 'A', Priority: 1 },
    { Id: 'b', Name: 'B', Priority: 5 },
    { Id: 'c', Name: 'C', Priority: 3 },
  ];
  const sorted = sortProjects(projects, {}, 'priority', 'asc');
  assert.deepEqual(
    sorted.map((p) => p.Id),
    ['a', 'c', 'b']
  );
});

test('sortProjects: by completion, using the supplied rollups', () => {
  const projects = [
    { Id: 'a', Name: 'A' },
    { Id: 'b', Name: 'B' },
  ];
  const rollupsById = {
    a: computeRollup([{ ExposurePlan: [{ Desired: 100, Accepted: 90 }] }]),
    b: computeRollup([{ ExposurePlan: [{ Desired: 100, Accepted: 10 }] }]),
  };
  const sorted = sortProjects(projects, rollupsById, 'completion', 'asc');
  assert.deepEqual(
    sorted.map((p) => p.Id),
    ['b', 'a']
  );
});

test('sortProjects: by remaining time', () => {
  const projects = [
    { Id: 'a', Name: 'A' },
    { Id: 'b', Name: 'B' },
  ];
  const rollupsById = {
    a: computeRollup([{ ExposurePlan: [{ Desired: 100, Accepted: 0, Exposure: 60 }] }]),
    b: computeRollup([{ ExposurePlan: [{ Desired: 10, Accepted: 0, Exposure: 60 }] }]),
  };
  const sorted = sortProjects(projects, rollupsById, 'remaining', 'asc');
  assert.deepEqual(
    sorted.map((p) => p.Id),
    ['b', 'a']
  );
});

test('sortProjects: missing rollup for a project defaults to zero rather than throwing', () => {
  const projects = [{ Id: 'a', Name: 'A' }];
  assert.deepEqual(
    sortProjects(projects, {}, 'completion', 'asc').map((p) => p.Id),
    ['a']
  );
});

test('sortProjects: unknown sortKey falls back to name', () => {
  const projects = [
    { Id: 'b', Name: 'Beta' },
    { Id: 'a', Name: 'Alpha' },
  ];
  const sorted = sortProjects(projects, {}, 'nonsense', 'asc');
  assert.deepEqual(
    sorted.map((p) => p.Name),
    ['Alpha', 'Beta']
  );
});

test('sortProjects: does not mutate the input array', () => {
  const projects = [
    { Id: 'b', Name: 'Beta' },
    { Id: 'a', Name: 'Alpha' },
  ];
  const original = [...projects];
  sortProjects(projects, {}, 'name', 'asc');
  assert.deepEqual(projects, original);
});

test('projectsToMarkdown: includes project header, state, completion, and per-filter target progress', () => {
  const projects = [{ Id: 'p1', Name: 'Emission Nebula', State: 'Active' }];
  const targetsByProject = {
    p1: {
      targets: [
        {
          Name: 'M 8',
          RA: 18.0696,
          Dec: -23.7565,
          ExposurePlan: [{ FilterName: 'Ha+OIII', Desired: 72, Accepted: 8 }],
        },
      ],
    },
  };
  const md = projectsToMarkdown(projects, targetsByProject, {
    profileName: 'Test Profile',
    generatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  assert.match(md, /# Target Scheduler Progress/);
  assert.match(md, /Profile: Test Profile/);
  assert.match(md, /## Emission Nebula — Active \(11%\)/);
  assert.match(md, /\*\*M 8\*\*/);
  assert.match(md, /Ha\+OIII: 8\/72/);
});

test('projectsToMarkdown: a project with no targets says so instead of an empty section', () => {
  const projects = [{ Id: 'p1', Name: 'Empty Project', State: 'Draft' }];
  const md = projectsToMarkdown(projects, {});
  assert.match(md, /_No targets\._/);
});

test('projectsToMarkdown: omits the profile line when no profile name is given', () => {
  const md = projectsToMarkdown([], {});
  assert.doesNotMatch(md, /Profile:/);
});
