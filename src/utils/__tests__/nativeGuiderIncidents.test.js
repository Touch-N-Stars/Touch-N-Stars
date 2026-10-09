import test from 'node:test';
import assert from 'node:assert/strict';
import { createI18n } from 'vue-i18n';
import en from '../../locales/en.json';
import de from '../../locales/de.json';
import {
  EVIDENCE_CODES,
  EVIDENCE_PARAMETERS,
  INCIDENT_CAUSES,
  INCIDENT_KINDS,
  LAST_SEEN_KEY,
  MARKER_TYPES,
  END_REASONS,
  MIN_TICK_MS,
  adjacentMarker,
  alertIncidentState,
  badgeText,
  budgetSummary,
  causeText,
  cropTiles,
  endReasonText,
  evidenceText,
  filterIncidents,
  formatBytes,
  formatIncidentDuration,
  formatIncidentParameter,
  frameImageKind,
  frameIndexOf,
  framePositions,
  graphIndexOfFrame,
  imageGapSpans,
  incidentDurationSeconds,
  incidentGraphSteps,
  indexAtPosition,
  kindText,
  newestSavedAt,
  parseIncidentId,
  playbackAdvance,
  preloadIndices,
  readLastSeen,
  searchRegionRect,
  sortIncidents,
  timelineMarkers,
  unseenIncidentCount,
  visibleIncidents,
  writeLastSeen,
} from '../nativeGuiderIncidents.js';

const i18n = createI18n({ legacy: false, locale: 'en', messages: { en, de } });
const { t, te } = i18n.global;
const BASE = 'components.guider.native.incidents';

/** Frames 100.. one second apart from 02:13:00 UTC, with images every frame unless told. */
function makeFrames(count, { start = 100, stepMs = 1000, images = () => 'context' } = {}) {
  const t0 = Date.parse('2026-09-26T02:13:00Z');
  return Array.from({ length: count }, (_, i) => {
    const kind = images(i);
    return {
      frame: start + i,
      timestamp: new Date(t0 + i * stepMs).toISOString(),
      exposureMs: stepMs,
      hasContext: kind === 'context' || kind === 'key',
      hasKey: kind === 'key',
    };
  });
}

// --- Texts --------------------------------------------------------------------------------------

test('every cause has title, why and fix; every kind, end reason and marker a label (en)', () => {
  for (const cause of INCIDENT_CAUSES) {
    for (const field of ['title', 'why', 'fix']) {
      assert.ok(te(`${BASE}.causes.${cause}.${field}`), `${cause}.${field}`);
    }
  }
  for (const kind of INCIDENT_KINDS) assert.ok(te(`${BASE}.kinds.${kind}`), kind);
  for (const reason of END_REASONS) assert.ok(te(`${BASE}.endReasons.${reason}`), reason);
  for (const type of MARKER_TYPES) assert.ok(te(`${BASE}.markers.${type}`), type);
});

test('every evidence code has a text using exactly its parameters', () => {
  for (const code of EVIDENCE_CODES) {
    assert.ok(te(`${BASE}.evidence.${code}`), code);
    const message = en.components.guider.native.incidents.evidence[code];
    const used = [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(used, [...EVIDENCE_PARAMETERS[code]].sort(), code);
  }
});

test('the likely cause is localized, with the engine message for unknown causes', () => {
  const clouds = causeText({ t, te }, 'clouds', 'Likely clouds');
  assert.equal(clouds.known, true);
  assert.equal(clouds.title, 'Clouds');
  assert.match(clouds.why, /faded together/);
  assert.match(clouds.fix, /clear sky/);

  const unknown = causeText({ t, te }, 'aliens', 'Likely aliens');
  assert.deepEqual(unknown, {
    cause: 'aliens',
    title: 'Likely aliens',
    why: '',
    fix: '',
    known: false,
  });
  assert.equal(causeText({ t, te }, null, '').title, '');

  i18n.global.locale.value = 'de';
  assert.equal(causeText({ t, te }, 'clouds').title, 'Wolken');
  i18n.global.locale.value = 'en';
});

test('evidence texts format numbers with units and translate axes, sides and kinds', () => {
  const jump = evidenceText(
    { t, te },
    { code: 'fieldJump', parameters: { jumpPx: 4.217, jumpArcsec: 6.3, stars: 5 }, frame: 12 }
  );
  assert.deepEqual(jump, { text: '5 stars jumped together by 4.22 px (6.3″)', known: true });

  assert.equal(
    evidenceText(
      { t, te },
      { code: 'starsFaded', parameters: { stars: 3, dropPercent: 64.6, seconds: 12.25 } }
    ).text,
    'All stars (3) faded by 65 % within 12.3 s'
  );
  assert.equal(
    evidenceText(
      { t, te },
      { code: 'errorGrew', parameters: { frames: 6, fromPx: 0.5, toPx: 3, axis: 'dec' } }
    ).text,
    'Dec error grew from 0.5 px to 3 px over 6 frames while corrections pushed against it'
  );
  assert.equal(
    evidenceText({ t, te }, { code: 'pierSideChanged', parameters: { from: 'East', to: 'West' } })
      .text,
    'Pier side changed from East to West'
  );
  assert.equal(
    evidenceText({ t, te }, { code: 'trigger', parameters: { kind: 'StarLost' } }).text,
    'Trigger: Star lost'
  );
  assert.equal(
    evidenceText({ t, te }, { code: 'starLost', parameters: { status: 'LowSnr' } }).text,
    'Star lost (SNR too low)'
  );
  assert.equal(
    evidenceText(
      { t, te },
      { code: 'driftToEdge', parameters: { percentOfRegion: 72.4, frames: 7, axis: 'ra' } }
    ).text,
    'The star drifted to 72 % of the search region in RA over 7 frames'
  );
  assert.equal(
    evidenceText(
      { t, te },
      { code: 'starsFadingSlowly', parameters: { stars: 4, dropPercent: 40, minutes: 3.25 } }
    ).text,
    'All stars (4) faded by 40 % over 3.3 min'
  );
});

test('evidence falls back to the engine message for unknown codes and fills missing values', () => {
  assert.deepEqual(
    evidenceText({ t, te }, { code: 'newThing', message: 'Something new happened' }),
    { text: 'Something new happened', known: false }
  );
  assert.deepEqual(evidenceText({ t, te }, { code: 'spike', parameters: { errorArcsec: 3.2 } }), {
    text: 'Error spike of 3.2″ at an RMS of ?',
    known: true,
  });
  assert.equal(
    evidenceText({ t, te }, { code: 'fieldJump', parameters: { jumpPx: 4, jumpArcsec: null } })
      .text,
    '? stars jumped together by 4 px (?)'
  );
});

test('parameter formatting knows the incident-only names', () => {
  assert.equal(formatIncidentParameter('count', 3), '3');
  assert.equal(formatIncidentParameter('pulses', 4.0), '4');
  assert.equal(formatIncidentParameter('percentOfRegion', 71.6), '72 %');
  assert.equal(formatIncidentParameter('minutes', 2.04), '2 min');
  assert.equal(formatIncidentParameter('periodSeconds', 478.26), '478.3 s');
  assert.equal(formatIncidentParameter('errorArcsec', 2.5), '2.5″');
  assert.equal(formatIncidentParameter('axis', 'ra'), 'ra');
  assert.equal(formatIncidentParameter('seconds', null), null);
});

test('kinds and end reasons are localized, unknown ones shown as they are', () => {
  assert.equal(kindText({ t, te }, 'MountNotResponding'), 'Mount not responding');
  assert.equal(kindText({ t, te }, 'Meteor'), 'Meteor');
  assert.equal(endReasonText({ t, te }, 'recovered'), 'Recovered');
  assert.equal(endReasonText({ t, te }, 'Cap'), '5-minute limit');
  assert.equal(endReasonText({ t, te }, 'weird'), 'weird');
});

// --- Timeline ------------------------------------------------------------------------------------

test('frame numbers map to indices, the nearest kept frame when one is missing', () => {
  const frames = [{ frame: 10 }, { frame: 11 }, { frame: 15 }, { frame: 20 }];
  assert.equal(frameIndexOf(frames, 11), 1);
  assert.equal(frameIndexOf(frames, 13), 1);
  assert.equal(frameIndexOf(frames, 14), 2);
  assert.equal(frameIndexOf(frames, 5), 0);
  assert.equal(frameIndexOf(frames, 99), 3);
  assert.equal(frameIndexOf(frames, null), -1);
  assert.equal(frameIndexOf([], 3), -1);
});

test('markers are placed by frame number, else by time, and sorted', () => {
  const frames = makeFrames(10);
  const incident = {
    frames,
    markers: [
      { type: 'Recovered', frame: 107, time: frames[7].timestamp, text: '' },
      { type: 'trigger', frame: 103, time: frames[3].timestamp, text: 'Star lost' },
      { type: 'note', frame: null, time: '2026-09-26T02:13:05.400Z', text: 'wind' },
      { type: 'end', frame: null, time: 'garbage' },
    ],
  };
  assert.deepEqual(
    timelineMarkers(incident).map((m) => [m.type, m.index, m.frame, m.text]),
    [
      ['trigger', 3, 103, 'Star lost'],
      ['note', 5, 105, 'wind'],
      ['recovered', 7, 107, ''],
    ]
  );
  assert.deepEqual(timelineMarkers({ frames: [], markers: [{ type: 'end', frame: 1 }] }), []);
});

test('previous/next marker jumps skip the current frame', () => {
  const markers = [
    { type: 'trigger', index: 3 },
    { type: 'recovered', index: 7 },
  ];
  assert.equal(adjacentMarker(markers, 0, 1).index, 3);
  assert.equal(adjacentMarker(markers, 3, 1).index, 7);
  assert.equal(adjacentMarker(markers, 7, 1), null);
  assert.equal(adjacentMarker(markers, 7, -1).index, 3);
  assert.equal(adjacentMarker(markers, 3, -1), null);
});

test('frame images: key first, then context; gaps are the runs without any image', () => {
  assert.equal(frameImageKind({ hasKey: true, hasContext: true }), 'key');
  assert.equal(frameImageKind({ hasContext: true }), 'context');
  assert.equal(frameImageKind({}), null);
  const frames = makeFrames(10, {
    images: (i) => ((i >= 2 && i <= 4) || i === 9 ? null : 'context'),
  });
  assert.deepEqual(imageGapSpans(frames), [
    { from: 2, to: 4 },
    { from: 9, to: 9 },
  ]);
  assert.deepEqual(imageGapSpans(makeFrames(3, { images: () => null })), []);
});

test('graph steps carry the frame telemetry and map back to frame indices', () => {
  const frames = makeFrames(4);
  frames[1].timestamp = null;
  frames[2].raArcsec = 1.5;
  frames[2].dithering = true;
  frames[3].raDuration = 120;
  frames[3].raDirection = 'West';
  const { steps, frameIndexes } = incidentGraphSteps(frames);
  assert.deepEqual(frameIndexes, [0, 2, 3]);
  assert.equal(steps[1].raArcsec, 1.5);
  assert.equal(steps[1].isSettling, true);
  assert.equal(steps[2].raDuration, 120);
  assert.equal(graphIndexOfFrame(frameIndexes, 1), 0);
  assert.equal(graphIndexOfFrame(frameIndexes, 3), 2);
  assert.equal(graphIndexOfFrame([], 3), -1);
});

test('the search-region box is 2 × half + 1 pixels around the lock position', () => {
  assert.deepEqual(searchRegionRect(100, 50, 15), { x: 84.5, y: 34.5, size: 31 });
  assert.equal(searchRegionRect(null, 50, 15), null);
  assert.equal(searchRegionRect(100, 50, 0), null);
  assert.equal(searchRegionRect(undefined, undefined, 15), null);
});

// --- Playback -------------------------------------------------------------------------------------

test('frame positions come from the timestamps and never go backwards', () => {
  const frames = makeFrames(4, { stepMs: 2000 });
  frames[2].timestamp = undefined;
  assert.deepEqual(framePositions(frames), [0, 2, 4, 6]);
  const jittered = makeFrames(3);
  jittered[2].timestamp = jittered[0].timestamp;
  assert.deepEqual(framePositions(jittered), [0, 1, 1]);
  assert.equal(indexAtPosition([0, 1, 2, 3], 2.5), 2);
  assert.equal(indexAtPosition([0, 1, 2, 3], -1), 0);
  assert.equal(indexAtPosition([0, 1, 2, 3], 10), 3);
  assert.equal(indexAtPosition([], 1), -1);
});

test('real-time playback shows every frame after its own interval', () => {
  const positions = [0, 1, 2, 3.5];
  assert.deepEqual(playbackAdvance(positions, 0, 1), { playhead: 1, index: 1, delayMs: 1000 });
  assert.deepEqual(playbackAdvance(positions, 2, 1), { playhead: 3.5, index: 3, delayMs: 1500 });
  assert.equal(playbackAdvance(positions, 3.5, 1), null);
  // 4x: 250 ms per 1 s frame, still every frame
  assert.deepEqual(playbackAdvance(positions, 0, 4), { playhead: 1, index: 1, delayMs: 250 });
});

test('fast playback skips frames instead of going below the minimum tick', () => {
  const positions = Array.from({ length: 40 }, (_, i) => i); // 1 s frames
  // 16x: 62.5 ms per frame would be too fast, so every 4th frame at 250 ms
  const first = playbackAdvance(positions, 0, 16);
  assert.deepEqual(first, { playhead: 4, index: 4, delayMs: MIN_TICK_MS });
  const second = playbackAdvance(positions, first.playhead, 16);
  assert.equal(second.index, 8);

  // Jittered timestamps: the playhead keeps real speed, the shown frames follow it.
  const jitter = Array.from({ length: 40 }, (_, i) => i * 1.02);
  let playhead = 0;
  let wall = 0;
  let last = null;
  while ((last = playbackAdvance(jitter, playhead, 16))) {
    wall += last.delayMs;
    playhead = last.playhead;
  }
  const expectedWallMs = ((jitter[jitter.length - 1] - jitter[0]) * 1000) / 16;
  assert.ok(Math.abs(wall - expectedWallMs) <= MIN_TICK_MS, `${wall} vs ${expectedWallMs}`);
});

test('long pauses in the recording are cut short', () => {
  const positions = [0, 1, 61, 62];
  assert.deepEqual(playbackAdvance(positions, 1, 1), { playhead: 61, index: 2, delayMs: 2000 });
  assert.deepEqual(playbackAdvance(positions, 1, 1, { maxTickMs: 500 }), {
    playhead: 61,
    index: 2,
    delayMs: 500,
  });
});

test('preloading follows the frames the playback will show, only those with images', () => {
  const frames = makeFrames(30, { images: (i) => (i === 2 ? null : 'context') });
  const positions = framePositions(frames);
  assert.deepEqual(preloadIndices(positions, frames, 0, 1, { count: 3 }), [1, 3]);
  assert.deepEqual(preloadIndices(positions, frames, 0, 16, { count: 3 }), [4, 8, 12]);
  assert.deepEqual(preloadIndices(positions, frames, 29, 1), []);
});

// --- Badge ----------------------------------------------------------------------------------------

test('incidents saved after the last-seen time count; recording ones do not', () => {
  const incidents = [
    { id: 'a', start: '2026-09-26T02:00:00Z', end: '2026-09-26T02:03:00Z' },
    { id: 'b', start: '2026-09-26T03:00:00Z', end: '2026-09-26T03:02:00Z' },
    { id: 'c', start: '2026-09-26T04:00:00Z', end: null },
    { id: 'd', start: '2026-09-26T05:00:00Z', end: '2026-09-26T05:01:00Z', endReason: 'recording' },
  ];
  assert.equal(unseenIncidentCount(incidents, 0), 3);
  assert.equal(unseenIncidentCount(incidents, Date.parse('2026-09-26T02:30:00Z')), 2);
  assert.equal(newestSavedAt(incidents), Date.parse('2026-09-26T05:01:00Z'));
  assert.equal(unseenIncidentCount(incidents, newestSavedAt(incidents)), 0);
  // An ongoing incident saved again (its end moved on) counts again.
  const reopened = [{ ...incidents[1], end: '2026-09-26T06:00:00Z' }];
  assert.equal(unseenIncidentCount(reopened, newestSavedAt(incidents)), 1);
  assert.equal(badgeText(0), '');
  assert.equal(badgeText(3), '3');
  assert.equal(badgeText(12), '9+');
});

test('the last-seen time survives in storage, and a broken storage never throws', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  assert.equal(readLastSeen(storage), 0);
  assert.equal(writeLastSeen(1234.6, storage), true);
  assert.equal(map.get(LAST_SEEN_KEY), '1235');
  assert.equal(readLastSeen(storage), 1235);

  const broken = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceeded');
    },
  };
  assert.equal(readLastSeen(broken), 0);
  assert.equal(writeLastSeen(5, broken), false);
  assert.equal(readLastSeen(null), 0);
  assert.equal(writeLastSeen(5, null), false);
  map.set(LAST_SEEN_KEY, 'garbage');
  assert.equal(readLastSeen(storage), 0);
});

// --- List -----------------------------------------------------------------------------------------

test('the current profile comes first, each group newest first; the filter keeps it only', () => {
  const list = [
    { id: 'old-own', start: '2026-09-20T01:00:00Z', tags: { profileId: 'p1' } },
    { id: 'new-other', start: '2026-09-26T01:00:00Z', tags: { profileId: 'p2' } },
    { id: 'new-own', start: '2026-09-25T01:00:00Z', tags: { profileId: 'p1' } },
    { id: 'untagged', start: '2026-09-24T01:00:00Z' },
  ];
  assert.deepEqual(
    sortIncidents(list, 'p1').map((i) => i.id),
    ['new-own', 'old-own', 'new-other', 'untagged']
  );
  assert.deepEqual(
    sortIncidents(list, null).map((i) => i.id),
    ['new-other', 'new-own', 'untagged', 'old-own']
  );
  assert.deepEqual(
    visibleIncidents(list, { filter: 'profile', profileId: 'p1' }).map((i) => i.id),
    ['new-own', 'old-own']
  );
  assert.equal(filterIncidents(list, { filter: 'profile', profileId: null }).length, 4);
  assert.equal(filterIncidents(list, { filter: 'all', profileId: 'p1' }).length, 4);
});

test('an alert shows Replay once its incident is saved, "recording" before', () => {
  const incidents = [{ id: 'x' }];
  assert.equal(alertIncidentState({ incidentId: 'x' }, { incidents }), 'saved');
  assert.equal(alertIncidentState({ incidentId: 'x' }, { incidents, recordingId: 'x' }), 'saved');
  assert.equal(
    alertIncidentState({ incidentId: 'y' }, { incidents, recordingId: 'y' }),
    'recording'
  );
  assert.equal(alertIncidentState({ incidentId: 'z' }, { incidents }), null);
  assert.equal(alertIncidentState({ incidentId: null }, { incidents }), null);
});

test('durations, sizes and the budget line', () => {
  assert.equal(
    incidentDurationSeconds({ start: '2026-09-26T02:00:00Z', end: '2026-09-26T02:03:05Z' }),
    185
  );
  assert.equal(incidentDurationSeconds({ start: 'x' }), null);
  assert.equal(formatIncidentDuration(42.4), '42 s');
  assert.equal(formatIncidentDuration(185), '3:05 min');
  assert.equal(formatIncidentDuration(3725), '1:02:05 h');
  assert.equal(formatIncidentDuration(null), '–');
  const MB = 1024 * 1024;
  assert.equal(formatBytes(312 * MB), '312 MB');
  assert.equal(formatBytes(1000 * MB), '1000 MB', 'the default budget as the setting says it');
  assert.equal(formatBytes(1024 * MB), '1 GB');
  assert.equal(formatBytes(1.54 * 1024 * MB), '1.5 GB');
  assert.equal(formatBytes(4.2 * MB), '4.2 MB');
  assert.equal(formatBytes(900), '900 B');
  assert.equal(formatBytes(undefined), '–');

  assert.deepEqual(
    budgetSummary({
      incidents: [{ tags: { simulator: true } }, { tags: {} }, {}],
      usedBytes: 312e6,
      budgetBytes: 1e9,
      maxIncidents: 50,
      simulatorUsedBytes: 20e6,
      simulatorBudgetBytes: 200e6,
    }),
    {
      used: 312e6,
      budget: 1e9,
      count: 2,
      max: 50,
      simulatorUsed: 20e6,
      simulatorBudget: 200e6,
      simulatorCount: 1,
    }
  );
  assert.equal(budgetSummary(null).count, 0);
});

test('incident ids give start and kind for the recording row', () => {
  assert.deepEqual(parseIncidentId('20260926-021305-StarLost-2'), {
    start: '2026-09-26T02:13:05.000Z',
    kind: 'StarLost',
  });
  assert.deepEqual(parseIncidentId('nonsense'), { start: null, kind: null });
});

test('crops become peeper tiles: primary by the star list, secondaries with their stars', () => {
  const frame = {
    starX: 50,
    starY: 60,
    snr: 30,
    hfd: 2.5,
    stars: [
      { x: 10, y: 10, isPrimary: false, used: true },
      { x: 50, y: 60, isPrimary: true, used: true },
    ],
  };
  const crop = (star, x0, y0) => ({
    star,
    x0,
    y0,
    width: 3,
    height: 3,
    pixels: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  });
  const tiles = cropTiles(frame, [crop(1, 49, 59), crop(0, 9, 9), { star: 5 }]);
  assert.equal(tiles.primaryCrop.star, 1);
  assert.equal(tiles.primaryStar, frame.stars[1]);
  assert.equal(tiles.secondaryCrops.length, 1);
  assert.equal(tiles.secondaryCrops[0].star, frame.stars[0]);

  // Lost primary: no primary tile, the secondary stays a secondary.
  const lost = cropTiles(
    { ...frame, stars: [frame.stars[0], { ...frame.stars[1], isPrimary: true }] },
    [crop(0, 9, 9)]
  );
  assert.equal(lost.primaryCrop, null);
  assert.equal(lost.secondaryCrops.length, 1);

  // Without a star list the first crop is the primary, centred on the frame's star.
  const bare = cropTiles({ starX: 50, starY: 60, snr: 12, hfd: 2 }, [crop(0, 49, 59)]);
  assert.deepEqual(bare.primaryStar, { x: 50, y: 60, snr: 12, hfd: 2, isPrimary: true });
  assert.deepEqual(cropTiles(frame, null), {
    primaryCrop: null,
    primaryStar: null,
    secondaryCrops: [],
  });
});
