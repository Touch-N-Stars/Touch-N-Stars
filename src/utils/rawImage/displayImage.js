/**
 * Fallback for plugins without the /api/raw-image/* routes (1.5.0.0 and older): turns the
 * RGBA pixels of the JPEG the view already shows into the same { meta, histograms, planes }
 * that parseRawImage() returns, as 8-bit data. Histogram, statistics and stretch then run
 * unchanged, only on the already stretched and compressed preview instead of the sensor data.
 *
 * Free of browser APIs so it can run in tests; decoding the image is the caller's job.
 */

import { HISTOGRAM_BINS, RAW_IMAGE_FORMAT_VERSION } from './parseRawImage';

const DISPLAY_LEVELS = 256;

// Smallest value at or below which half of the pixels lie, like NINA's integer median.
function histogramMedian(histogram, total) {
  const half = total / 2;
  let sum = 0;
  for (let v = 0; v < histogram.length; v++) {
    sum += histogram[v];
    if (sum >= half) return v;
  }
  return 0;
}

function channelStats(histogram, total) {
  let min = -1;
  let max = 0;
  let sum = 0;
  for (let v = 0; v < DISPLAY_LEVELS; v++) {
    const count = histogram[v];
    if (!count) continue;
    if (min < 0) min = v;
    max = v;
    sum += v * count;
  }
  const median = histogramMedian(histogram, total);
  const deviations = new Float64Array(DISPLAY_LEVELS);
  for (let v = 0; v < DISPLAY_LEVELS; v++) {
    deviations[Math.abs(v - median)] += histogram[v];
  }
  return {
    min: Math.max(0, min),
    max,
    mean: total ? sum / total : 0,
    median,
    mad: histogramMedian(deviations, total),
    clipLow: total ? histogram[0] / total : 0,
    clipHigh: total ? histogram[DISPLAY_LEVELS - 1] / total : 0,
  };
}

/**
 * @param {Uint8ClampedArray} rgba  pixels of the decoded (possibly downscaled) image
 * @param {number} width            decoded width
 * @param {number} height           decoded height
 * @param {{ sourceWidth?: number, sourceHeight?: number }} source  size of the original JPEG
 */
export function rawFromRgba(rgba, width, height, { sourceWidth, sourceHeight } = {}) {
  const pixels = width * height;

  // NINA renders mono frames as grey JPEGs; one channel keeps the chart and table simple.
  let grey = true;
  for (let o = 0; o < pixels * 4; o += 4) {
    if (rgba[o] !== rgba[o + 1] || rgba[o] !== rgba[o + 2]) {
      grey = false;
      break;
    }
  }
  const channels = grey ? 1 : 3;

  const planes = [];
  const histograms = [];
  for (let c = 0; c < channels; c++) {
    const plane = new Uint16Array(pixels);
    const histogram = new Uint32Array(HISTOGRAM_BINS);
    for (let i = 0, o = c; i < pixels; i++, o += 4) {
      const v = rgba[o];
      plane[i] = v;
      histogram[v]++;
    }
    planes.push(plane);
    histograms.push(histogram);
  }

  const meta = {
    version: RAW_IMAGE_FORMAT_VERSION,
    displayImage: true,
    width,
    height,
    sourceWidth: sourceWidth ?? width,
    sourceHeight: sourceHeight ?? height,
    channels,
    bitDepth: 8,
    isBayered: false,
    bayerPattern: null,
    stats: histograms.map((h) => channelStats(h, pixels)),
  };

  return { meta, histograms, planes };
}
