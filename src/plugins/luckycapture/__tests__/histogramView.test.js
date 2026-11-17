import assert from 'node:assert/strict';
import test from 'node:test';
import { histogramBinAt, histogramView } from '../utils/histogramView.js';

test('a narrow faint signal is enlarged without removing populated bins', () => {
  const bins = Array(256).fill(0);
  bins[2] = 3;
  bins[6] = 2000;
  bins[11] = 2;
  const view = histogramView(bins);
  assert.equal(view.start, 0);
  assert.equal(view.end, 13);
  assert.equal(view.peak, 2000);
  assert.equal(
    view.points.reduce((sum, item) => sum + item.count, 0),
    2005
  );
  assert.equal(view.points.at(-1).right, 512);
});

test('full range preserves shadow and highlight extremes', () => {
  const bins = Array(256).fill(0);
  bins[0] = 12;
  bins[255] = 17;
  const view = histogramView(bins, { fullRange: true });
  assert.equal(view.start, 0);
  assert.equal(view.end, 255);
  assert.equal(histogramBinAt(0, view), 0);
  assert.equal(histogramBinAt(1, view), 255);
  assert.equal(histogramBinAt(1.5, view), 255);
});

test('log scaling reveals a weak tail while keeping raw counts intact', () => {
  const bins = Array(256).fill(0);
  bins[40] = 100000;
  bins[41] = 2;
  const linear = histogramView(bins);
  const log = histogramView(bins, { logarithmic: true });
  assert.deepEqual(log.counts, linear.counts);
  assert.equal(log.peak, linear.peak);
  assert.ok(
    log.points.find((item) => item.index === 41).y <
      linear.points.find((item) => item.index === 41).y
  );
});

test('empty and single-bin distributions produce finite geometry', () => {
  assert.equal(histogramView([]).empty, true);
  const bins = Array(256).fill(0);
  bins[255] = 1;
  const view = histogramView(bins);
  assert.equal(view.end, 255);
  assert.doesNotMatch(view.area, /NaN|Infinity/);
  assert.equal(histogramBinAt(-1, view), view.start);
});
