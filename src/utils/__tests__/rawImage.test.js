import test from 'node:test';
import assert from 'node:assert/strict';
import { HISTOGRAM_BINS, parseRawImage } from '@/utils/rawImage/parseRawImage';
import {
  autoStretch,
  buildLut,
  dataRangeLevels,
  mtf,
  neutralizeBackground,
  renderRgba,
  shiftLevels,
} from '@/utils/rawImage/stretch';
import {
  autoViewRange,
  binColumns,
  cumulative,
  fullViewRange,
  percentile,
} from '@/utils/rawImage/histogramView';

// Builds a container exactly like RawImageEncoder.WriteContainer in the plugin.
function buildContainer(meta, histograms, planes) {
  const json = new TextEncoder().encode(JSON.stringify(meta));
  let offset = 4 + json.length;
  offset += (4 - (offset % 4)) % 4;
  const pixels = meta.width * meta.height;
  const size = offset + meta.channels * (HISTOGRAM_BINS * 4 + pixels * 2);
  const buffer = new ArrayBuffer(size);
  new DataView(buffer).setUint32(0, json.length, true);
  new Uint8Array(buffer, 4, json.length).set(json);
  histograms.forEach((h) => {
    new Uint32Array(buffer, offset, HISTOGRAM_BINS).set(h);
    offset += HISTOGRAM_BINS * 4;
  });
  planes.forEach((p) => {
    new Uint16Array(buffer, offset, pixels).set(p);
    offset += pixels * 2;
  });
  return buffer;
}

function histogramOf(values) {
  const h = new Uint32Array(HISTOGRAM_BINS);
  values.forEach((v) => h[v]++);
  return h;
}

test('parseRawImage() reads header, histograms and planes of the plugin container', () => {
  const meta = { version: 1, width: 2, height: 1, channels: 3, bitDepth: 16, stats: [] };
  const planes = [new Uint16Array([1, 2]), new Uint16Array([3, 4]), new Uint16Array([5, 65535])];
  const buffer = buildContainer(
    meta,
    planes.map((p) => histogramOf(p)),
    planes
  );

  const parsed = parseRawImage(buffer);
  assert.equal(parsed.meta.channels, 3);
  assert.equal(parsed.histograms.length, 3);
  assert.equal(parsed.histograms[2][65535], 1);
  assert.deepEqual([...parsed.planes[1]], [3, 4]);
  assert.deepEqual([...parsed.planes[2]], [5, 65535]);
});

test('parseRawImage() rejects truncated payloads and unknown versions', () => {
  const meta = { version: 1, width: 4, height: 4, channels: 1, bitDepth: 16, stats: [] };
  const buffer = buildContainer(meta, [new Uint32Array(HISTOGRAM_BINS)], [new Uint16Array(16)]);
  assert.throws(() => parseRawImage(buffer.slice(0, buffer.byteLength - 2)), /truncated/);

  const future = buildContainer(
    { ...meta, version: 2 },
    [new Uint32Array(HISTOGRAM_BINS)],
    [new Uint16Array(16)]
  );
  assert.throws(() => parseRawImage(future), /version/);
});

test('mtf() keeps the end points and maps the balance to 50 %', () => {
  assert.equal(mtf(0.2, 0), 0);
  assert.equal(mtf(0.2, 1), 1);
  assert.ok(Math.abs(mtf(0.2, 0.2) - 0.5) < 1e-12);
  assert.equal(mtf(0.5, 0.3), 0.3);
  // mtf(mtf(t, x), x) === t is what places the median onto the target.
  assert.ok(Math.abs(mtf(mtf(0.25, 0.01), 0.01) - 0.25) < 1e-12);
});

test('autoStretch() follows NINA: shadows at median - 2.8 sigma, median onto the target', () => {
  const stat = { median: 1000, mad: 20, min: 900, max: 65535 };
  const levels = autoStretch(stat, 16, { targetMedian: 0.2, shadowsClipping: -2.8 });
  const max = 65535;
  const expectedBlack = (1000 - 2.8 * 20 * 1.4826) / max;
  assert.ok(Math.abs(levels.black - expectedBlack) < 1e-12);
  assert.equal(levels.white, 1);

  const x = (1000 / max - levels.black) / (levels.white - levels.black);
  assert.ok(Math.abs(mtf(levels.mid, x) - 0.2) < 1e-9);
});

test('autoStretch() clips the highlights of an inverted or overexposed frame', () => {
  const levels = autoStretch({ median: 50000, mad: 100 }, 16);
  assert.equal(levels.black, 0);
  assert.ok(levels.white > 50000 / 65535);
});

test('buildLut() clips at the black and white point and honours the bit depth', () => {
  const lut = buildLut({ black: 0.25, mid: 0.5, white: 0.75 }, 12);
  assert.equal(lut[0], 0);
  assert.equal(lut[1023], 0); // just below 0.25 of 4095
  assert.equal(lut[2048], 128);
  assert.equal(lut[3071], 255);
  assert.equal(lut[65535], 255);
});

test('neutralizeBackground() aligns the channel backgrounds on the darkest one', () => {
  const { offsets, reference } = neutralizeBackground([
    { min: 10, max: 100, median: 40, mad: 4 },
    { min: 20, max: 300, median: 60, mad: 6 },
    { min: 15, max: 200, median: 45, mad: 5 },
  ]);
  assert.deepEqual(offsets, [0, 20, 5]);
  // Shifted ranges: 10..100, 0..280, 10..195
  assert.deepEqual(reference, { min: 0, max: 280, median: 40, mad: 5 });
  const levels = dataRangeLevels(reference, 16);
  assert.equal(levels.black, 0);
  assert.equal(levels.white, 280 / 65535);
});

test('shiftLevels() gives every channel the same curve, moved by its offset', () => {
  const max = 65535;
  const [r, g] = shiftLevels({ black: 100 / max, mid: 0.1, white: 1 }, [0, 60], 16);
  assert.equal(r.black, 100 / max);
  assert.equal(g.black, 160 / max);
  assert.equal(g.mid, 0.1);
  // A background 30 ADU above the black point renders identically in both channels.
  const lutR = buildLut(r, 16);
  const lutG = buildLut(g, 16);
  assert.equal(lutR[130], lutG[190]);
});

test('renderRgba() writes grey for one plane and RGB for three', () => {
  const identity = Uint8Array.from({ length: 65536 }, (_, v) => v & 0xff);
  const grey = renderRgba([new Uint16Array([7])], [identity], new Uint8ClampedArray(4));
  assert.deepEqual([...grey], [7, 7, 7, 255]);
  const rgb = renderRgba(
    [new Uint16Array([1]), new Uint16Array([2]), new Uint16Array([3])],
    [identity, identity, identity],
    new Uint8ClampedArray(4)
  );
  assert.deepEqual([...rgb], [1, 2, 3, 255]);
});

test('binColumns() sums instead of sampling, so no pixel is lost when zoomed out', () => {
  const values = [];
  for (let v = 0; v < 5000; v += 3) values.push(v);
  const cum = cumulative(histogramOf(values));
  const columns = binColumns(cum, 0, 5000, 97);
  const total = columns.reduce((s, c) => s + c, 0);
  assert.equal(total, values.length);
});

test('binColumns() repeats a bin when zoomed in further than one ADU per column', () => {
  const cum = cumulative(histogramOf([100, 100, 101]));
  const columns = binColumns(cum, 100, 102, 4);
  assert.deepEqual([...columns], [2, 2, 1, 1]);
});

test('percentile() finds the value below which a fraction of the pixels lies', () => {
  const cum = cumulative(histogramOf([1, 2, 3, 4, 100]));
  assert.equal(percentile(cum, 0.5), 3);
  assert.equal(percentile(cum, 1), 100);
});

test('autoViewRange() zooms onto the occupied band, fullViewRange() spans the bit depth', () => {
  const values = [];
  for (let i = 0; i < 10000; i++) values.push(1000 + (i % 41) - 20);
  values.push(65535); // one saturated star pixel must not widen the zoom
  const histogram = histogramOf(values);
  const view = autoViewRange([cumulative(histogram)], [{ min: 980, median: 1000, mad: 10 }], 16);
  assert.ok(view.lo >= 900 && view.lo <= 980);
  assert.ok(view.hi > 1020 && view.hi < 2000);
  assert.deepEqual(fullViewRange(12), { lo: 0, hi: 4096 });
});

test('rawFromRgba turns a grey preview JPEG into one 8-bit channel with exact stats', async () => {
  const { rawFromRgba } = await import('@/utils/rawImage/displayImage');
  const values = [0, 10, 10, 20, 255];
  const rgba = new Uint8ClampedArray(values.flatMap((v) => [v, v, v, 255]));
  const { meta, histograms, planes } = rawFromRgba(rgba, 5, 1, {
    sourceWidth: 50,
    sourceHeight: 10,
  });

  assert.equal(meta.displayImage, true);
  assert.equal(meta.channels, 1);
  assert.equal(meta.bitDepth, 8);
  assert.equal(meta.sourceWidth, 50);
  assert.deepEqual([...planes[0]], values);
  assert.equal(histograms[0].length, HISTOGRAM_BINS);
  assert.equal(histograms[0][10], 2);
  const [s] = meta.stats;
  assert.equal(s.min, 0);
  assert.equal(s.max, 255);
  assert.equal(s.median, 10);
  assert.equal(s.mad, 10);
  assert.equal(s.mean, 59);
  assert.equal(s.clipLow, 0.2);
  assert.equal(s.clipHigh, 0.2);
});

test('rawFromRgba keeps three channels for a colour preview', async () => {
  const { rawFromRgba } = await import('@/utils/rawImage/displayImage');
  const rgba = new Uint8ClampedArray([10, 20, 30, 255, 12, 22, 32, 255]);
  const { meta, planes } = rawFromRgba(rgba, 2, 1);
  assert.equal(meta.channels, 3);
  assert.deepEqual(
    planes.map((p) => [...p]),
    [
      [10, 12],
      [20, 22],
      [30, 32],
    ]
  );
  assert.deepEqual(
    meta.stats.map((s) => s.median),
    [10, 20, 30]
  );
});
