/**
 * Turns the 65536-bin full-resolution histogram into what the chart draws: a cumulative
 * table for O(1) range sums, screen columns for any zoomed ADU range, and the default
 * zoom around the actual data.
 */

import { MAD_SCALE, maxAdu } from './stretch';

/** cum[v] = number of pixels with a value below v; cum[65536] is the pixel count. */
export function cumulative(histogram) {
  const cum = new Float64Array(histogram.length + 1);
  for (let v = 0; v < histogram.length; v++) {
    cum[v + 1] = cum[v] + histogram[v];
  }
  return cum;
}

/**
 * Pixel counts per screen column for the ADU range [lo, hi). Counts are summed over each
 * column's ADU span, never sampled, so no bin is lost when zoomed out. When zoomed in
 * further than one ADU per column, neighbouring columns repeat the same bin.
 */
export function binColumns(cum, lo, hi, columns) {
  const out = new Float64Array(columns);
  const maxBin = cum.length - 1;
  const span = (hi - lo) / columns;
  for (let i = 0; i < columns; i++) {
    const start = Math.min(maxBin - 1, Math.max(0, Math.floor(lo + span * i)));
    let end = Math.min(maxBin, Math.floor(lo + span * (i + 1)));
    if (end <= start) end = start + 1;
    out[i] = cum[end] - cum[start];
  }
  return out;
}

/** Smallest ADU value at or below which `fraction` of the pixels lie. */
export function percentile(cum, fraction) {
  const total = cum[cum.length - 1];
  const target = Math.max(1, Math.ceil(total * fraction));
  let lo = 0;
  let hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid + 1] >= target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export function fullViewRange(bitDepth) {
  return { lo: 0, hi: maxAdu(bitDepth) + 1 };
}

/**
 * Default zoom: astro frames occupy a narrow band near the background, which a linear
 * 0..65535 axis squeezes into a single spike. Show from a few sigma below the darkest
 * channel's median up to the brightest channel's 99.95th percentile.
 */
export function autoViewRange(cums, stats, bitDepth) {
  const full = fullViewRange(bitDepth);
  if (!cums?.length || !stats?.length) return full;

  let lo = full.hi;
  let hi = 0;
  cums.forEach((cum, c) => {
    const s = stats[c];
    const sigma = Math.max(1, s.mad * MAD_SCALE);
    lo = Math.min(lo, Math.max(s.min, s.median - 8 * sigma));
    hi = Math.max(hi, percentile(cum, 0.9995) + 1);
  });

  lo = Math.max(0, Math.floor(lo));
  hi = Math.min(full.hi, Math.ceil(hi));
  // Keep a usable width for flat or nearly constant frames.
  const minWidth = Math.max(64, (full.hi - full.lo) / 1024);
  if (hi - lo < minWidth) {
    const centre = (hi + lo) / 2;
    lo = Math.max(0, Math.floor(centre - minWidth / 2));
    hi = Math.min(full.hi, lo + Math.ceil(minWidth));
  }
  return { lo, hi };
}
