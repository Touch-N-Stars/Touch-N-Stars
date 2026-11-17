/**
 * Screen transfer function on real ADU data, the same model NINA and PixInsight use:
 * clip at the black and white point, then bend the midtones with the midtones transfer
 * function (MTF). Levels are normalised to the image's bit depth, 0 = black, 1 = 2^bitDepth-1.
 *
 * Shared by the stretch worker and the main thread, so it must stay free of browser APIs.
 */

// Scales the MAD to a standard deviation for normally distributed noise (NINA uses the same).
export const MAD_SCALE = 1.4826;

// NINA's profile defaults (ImageSettings.AutoStretchFactor / BlackClipping).
export const DEFAULT_TARGET_MEDIAN = 0.2;
export const DEFAULT_SHADOWS_CLIPPING = -2.8;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const maxAdu = (bitDepth) => 2 ** Math.min(16, Math.max(1, bitDepth || 16)) - 1;

/**
 * Midtones transfer function: maps m to 0.5 and keeps 0 and 1 fixed. It is its own
 * inverse in the sense that mtf(mtf(t, x), x) === t, which is what lets autoStretch()
 * pick the midtone that moves the background exactly onto the target brightness.
 */
export function mtf(m, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (m === 0.5) return x;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

export const linearLevels = () => ({ black: 0, mid: 0.5, white: 1 });

/**
 * NINA's auto stretch (ImageUtility.GetStretchMap): shadows at median + clipping·σ, white
 * at the top, and the midtone chosen so the median lands on targetMedian. A median above
 * half the range is treated like NINA does - as an inverted or overexposed frame - by
 * clipping the highlights instead of the shadows.
 */
export function autoStretch(
  stat,
  bitDepth,
  { targetMedian = DEFAULT_TARGET_MEDIAN, shadowsClipping = DEFAULT_SHADOWS_CLIPPING } = {}
) {
  if (!stat) return linearLevels();
  const max = maxAdu(bitDepth);
  const median = stat.median / max;
  const sigma = (stat.mad / max) * MAD_SCALE;

  let black = 0;
  let white = 1;
  if (median > 0.5) {
    white = clamp01(median - shadowsClipping * sigma);
  } else {
    black = clamp01(median + shadowsClipping * sigma);
  }
  if (white - black < 1e-6) return linearLevels();

  const x = (median - black) / (white - black);
  return { black, white, mid: clamp01(mtf(targetMedian, x)) };
}

/**
 * Background neutralisation for a linked colour stretch. The channels of a raw OSC frame
 * never share one background level (green is more sensitive and twice as frequent), and a
 * common curve amplifies that difference the closer the black point gets to the background.
 * Each channel is therefore shifted by the distance of its median above the darkest one, so
 * the backgrounds coincide, and one set of levels then applies to all channels alike. Only an
 * offset, no scaling: the colour of the objects relative to each other stays as recorded.
 *
 * Returns per-channel offsets in ADU and the statistics of the shifted data, which the
 * shared levels (auto, linear, display) are computed from.
 */
export function neutralizeBackground(stats) {
  if (!stats?.length) return { offsets: [], reference: null };
  const base = Math.min(...stats.map((s) => s.median));
  const offsets = stats.map((s) => s.median - base);
  const reference = {
    min: Math.min(...stats.map((s, c) => s.min - offsets[c])),
    max: Math.max(...stats.map((s, c) => s.max - offsets[c])),
    median: base,
    mad: stats.reduce((sum, s) => sum + s.mad, 0) / stats.length,
  };
  return { offsets, reference };
}

/** Expands the shared levels to one set per channel, shifted by the background offsets (ADU). */
export function shiftLevels(levels, offsets, bitDepth) {
  const max = maxAdu(bitDepth);
  return offsets.map((offset) => ({
    black: levels.black + offset / max,
    mid: levels.mid,
    white: levels.white + offset / max,
  }));
}

/** Linear contrast stretch over the occupied data range, no midtone bending. */
export function dataRangeLevels(stat, bitDepth) {
  if (!stat || stat.max <= stat.min) return linearLevels();
  const max = maxAdu(bitDepth);
  return { black: stat.min / max, mid: 0.5, white: stat.max / max };
}

/** 65536-entry lookup table from ADU to an 8-bit display value. */
export function buildLut(levels, bitDepth) {
  const max = maxAdu(bitDepth);
  const { black, white } = levels;
  const range = Math.max(white - black, 1e-9);
  const mid = Math.min(0.9999, Math.max(0.0001, levels.mid));
  const lut = new Uint8Array(65536);
  for (let v = 0; v < 65536; v++) {
    const x = clamp01((v / max - black) / range);
    lut[v] = Math.round(mtf(mid, x) * 255);
  }
  return lut;
}

/**
 * Writes RGBA pixels for one (grey) or three (RGB) planes through the per-channel LUTs.
 * `luts` has one entry per plane.
 */
export function renderRgba(planes, luts, out) {
  const pixels = planes[0].length;
  if (planes.length === 1) {
    const p = planes[0];
    const lut = luts[0];
    for (let i = 0, o = 0; i < pixels; i++, o += 4) {
      const v = lut[p[i]];
      out[o] = v;
      out[o + 1] = v;
      out[o + 2] = v;
      out[o + 3] = 255;
    }
    return out;
  }

  const [r, g, b] = planes;
  const [lr, lg, lb] = luts;
  for (let i = 0, o = 0; i < pixels; i++, o += 4) {
    out[o] = lr[r[i]];
    out[o + 1] = lg[g[i]];
    out[o + 2] = lb[b[i]];
    out[o + 3] = 255;
  }
  return out;
}
