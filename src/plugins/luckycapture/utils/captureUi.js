export function readLimit(value, integer = false) {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || (integer && !Number.isSafeInteger(number)))
    throw new RangeError('Limit must be positive');
  return number;
}

export function moveCaptureRoi(roi, camera, settings, dx, dy, fraction = 0.1) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const alignment = (bin) => (2 * bin) / gcd(2, bin);
  const ax = alignment(settings.binX || 1);
  const ay = alignment(settings.binY || 1);
  const shift = (size, step) => Math.max(step, Math.round((size * fraction) / step) * step);
  const x = Math.max(
    0,
    Math.min(Math.floor((camera.width - roi.width) / ax) * ax, roi.x + dx * shift(roi.width, ax))
  );
  const y = Math.max(
    0,
    Math.min(Math.floor((camera.height - roi.height) / ay) * ay, roi.y + dy * shift(roi.height, ay))
  );
  return { ...roi, x, y };
}

export function selectionToRoi(source, selection) {
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const endX = source.x + source.width;
  const endY = source.y + source.height;
  const x = Math.min(endX - 2, Math.floor((source.x + source.width * clamp(selection.x)) / 2) * 2);
  const y = Math.min(endY - 2, Math.floor((source.y + source.height * clamp(selection.y)) / 2) * 2);
  const width = Math.min(
    endX - x,
    Math.max(2, Math.floor((source.width * clamp(selection.width)) / 2) * 2)
  );
  const height = Math.min(
    endY - y,
    Math.max(2, Math.floor((source.height * clamp(selection.height)) / 2) * 2)
  );
  return { x, y, width, height };
}

// Common planetary capture sizes. Frame rate on most CMOS cameras scales with ROI height,
// so these are the quickest way to trade field of view for speed.
export const ROI_PRESET_SIZES = [
  [320, 240],
  [640, 480],
  [800, 600],
  [1024, 768],
];

export function centeredRoi(camera, settings, width, height) {
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  // Even coordinates keep the Bayer phase; multiples of the binning keep the driver happy.
  const alignment = (bin) => (2 * bin) / gcd(2, bin);
  const ax = alignment(settings?.binX || 1);
  const ay = alignment(settings?.binY || 1);
  const w = Math.floor(Math.min(width, camera.width) / ax) * ax;
  const h = Math.floor(Math.min(height, camera.height) / ay) * ay;
  return {
    x: Math.floor((camera.width - w) / 2 / ax) * ax,
    y: Math.floor((camera.height - h) / 2 / ay) * ay,
    width: w,
    height: h,
  };
}

export function roiPresets(camera, settings) {
  if (!camera?.width || !camera?.height) return [];
  return ROI_PRESET_SIZES.filter(([w, h]) => w < camera.width && h < camera.height).map(
    ([w, h]) => ({ key: `${w}x${h}`, roi: centeredRoi(camera, settings, w, h) })
  );
}
