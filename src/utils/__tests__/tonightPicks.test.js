import test from 'node:test';
import assert from 'node:assert/strict';

const {
  buildTrack,
  calculateTonightScore,
  findNightWindow,
  normalizeCatalogTargets,
  parseDecDeg,
  parseRaHours,
  rankTonightPicks,
} = await import('@/utils/tonightPicks');
const { getSunAltitudeDeg } = await import('@/utils/astronomy');

const BERLIN = { lat: 52.5, lon: 13.4 };
const HOUR = 3600 * 1000;

test('sexagesimal coordinates parse to hours and degrees', () => {
  assert.equal(parseRaHours('00:42:44'), 42 / 60 + 44 / 3600);
  assert.ok(Math.abs(parseRaHours('5h35m17s') - (5 + 35 / 60 + 17 / 3600)) < 1e-9);
  assert.equal(parseRaHours(''), null);
  assert.ok(Math.abs(parseDecDeg('-05:23:28') + (5 + 23 / 60 + 28 / 3600)) < 1e-9);
  assert.ok(Math.abs(parseDecDeg('+41:16:09') - (41 + 16 / 60 + 9 / 3600)) < 1e-9);
});

test('catalogue entries become targets with degrees and drop unusable rows', () => {
  const list = normalizeCatalogTargets({
    targets: [
      {
        name: 'Andromeda Galaxy',
        catalog: 'M31',
        type: 'galaxy',
        ra: '00:42:44',
        dec: '+41:16:09',
      },
      { name: 'Broken', catalog: 'X1', type: 'nebula', ra: 'abc', dec: '' },
    ],
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].catalog, 'M31');
  assert.ok(Math.abs(list[0].raDeg - 10.683) < 0.01);
});

test('night window: winter evening starts at dusk and ends at dawn the next morning', () => {
  const now = new Date('2026-12-21T12:00:00Z');
  const win = findNightWindow(now, BERLIN.lat, BERLIN.lon);
  assert.ok(win);
  assert.ok(win.start > now);
  const hours = (win.end - win.start) / HOUR;
  assert.ok(hours > 12 && hours < 15, `winter night should be 12-15 h, got ${hours}`);
  assert.ok(getSunAltitudeDeg(new Date(win.start.getTime() + HOUR), BERLIN.lat, BERLIN.lon) < -12);
});

test('night window: a summer night is much shorter than a winter night', () => {
  const winter = findNightWindow(new Date('2026-12-21T12:00:00Z'), BERLIN.lat, BERLIN.lon);
  const summer = findNightWindow(new Date('2026-06-21T12:00:00Z'), BERLIN.lat, BERLIN.lon);
  // At 52.5° N the sun stays above -12° around the summer solstice, the next dark window is
  // either missing or far shorter than the winter one.
  if (summer) assert.ok(summer.end - summer.start < (winter.end - winter.start) / 2);
  const june = findNightWindow(new Date('2026-06-01T12:00:00Z'), BERLIN.lat, BERLIN.lon);
  assert.ok(june);
  assert.ok(june.end - june.start < winter.end - winter.start);
});

test('night window: at 02:00 the running night counts, not the next one', () => {
  const now = new Date('2026-12-21T01:00:00Z');
  const win = findNightWindow(now, BERLIN.lat, BERLIN.lon);
  assert.ok(win);
  assert.equal(win.start.getTime(), now.getTime());
  assert.ok(win.end - now < 9 * HOUR, "the window ends at this morning's dawn");
});

test('night window: polar night is capped, midnight sun has no window', () => {
  const polarNight = findNightWindow(new Date('2026-12-21T12:00:00Z'), 85, 15);
  assert.ok(polarNight);
  assert.equal(polarNight.end - polarNight.start, 12 * HOUR);
  assert.equal(findNightWindow(new Date('2026-06-21T12:00:00Z'), 85, 15), null);
  assert.equal(findNightWindow(new Date('invalid'), 52, 13), null);
  assert.equal(findNightWindow(new Date(), NaN, 13), null);
});

test('score rises with altitude and time above the limit, and is zero without samples', () => {
  const high = {
    track: { points: [{ altDeg: 80 }, { altDeg: 70 }], best: { altDeg: 80 }, sampleMinutes: 60 },
  };
  const low = {
    track: { points: [{ altDeg: 40 }, { altDeg: 25 }], best: { altDeg: 40 }, sampleMinutes: 60 },
  };
  assert.ok(calculateTonightScore(high, null) > calculateTonightScore(low, null));
  assert.equal(calculateTonightScore({ track: { points: [] } }, null), 0);
  // 80/90 * 2 h, no moon, no favorite bonus
  assert.ok(Math.abs(calculateTonightScore(high, null) - (80 / 90) * 2) < 1e-9);
});

test('moon penalty hits a galaxy next to a bright moon harder than a star cluster', () => {
  const track = {
    points: [{ altDeg: 60 }, { altDeg: 60 }],
    best: { altDeg: 60 },
    sampleMinutes: 60,
  };
  const moon = { illumination: 1, separationDeg: 20 };
  const galaxy = calculateTonightScore({ type: 'galaxy', track }, moon);
  const cluster = calculateTonightScore({ type: 'cluster', track }, moon);
  assert.ok(cluster > galaxy);
  assert.ok(galaxy < calculateTonightScore({ type: 'galaxy', track }, null));
});

test('picks: best first, capped, and nothing below the minimum altitude', () => {
  const start = new Date('2026-12-21T17:00:00Z');
  const end = new Date('2026-12-22T06:00:00Z');
  const targets = [
    { id: 'M31', name: 'Andromeda', type: 'galaxy', raDeg: 10.68, decDeg: 41.27 },
    { id: 'M42', name: 'Orion', type: 'nebula', raDeg: 83.82, decDeg: -5.39 },
    { id: 'South', name: 'Never rises', type: 'galaxy', raDeg: 10, decDeg: -80 },
  ];
  const picks = rankTonightPicks(targets, {
    start,
    end,
    latDeg: BERLIN.lat,
    lonDeg: BERLIN.lon,
    limit: 5,
  });
  assert.ok(picks.length >= 1);
  assert.ok(!picks.some((p) => p.id === 'South'));
  for (let i = 1; i < picks.length; i++) assert.ok(picks[i - 1].score >= picks[i].score);
  assert.ok(picks.every((p) => p.maxAltDeg >= 30));
  const one = rankTonightPicks(targets, {
    start,
    end,
    latDeg: BERLIN.lat,
    lonDeg: BERLIN.lon,
    limit: 1,
  });
  assert.equal(one.length, 1);
  assert.deepEqual(rankTonightPicks(targets, { start, end, latDeg: NaN, lonDeg: 1 }), []);
});

test('track finds the culmination', () => {
  const { best, points } = buildTrack(
    83.82,
    -5.39,
    new Date('2026-12-21T17:00:00Z'),
    new Date('2026-12-22T06:00:00Z'),
    10,
    52.5,
    13.4
  );
  assert.ok(points.length > 70);
  assert.ok(best.altDeg > 25 && best.altDeg < 35, `Orion culminates near 32°, got ${best.altDeg}`);
});
