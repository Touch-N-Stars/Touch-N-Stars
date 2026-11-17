// Shared look of the native guider's uPlot charts (guide graph, incident graph, coach plots).
// uPlot draws on canvas, so the theme tokens are read once from the CSS variables; the
// fallbacks are the dark theme's values for environments without CSS (tests).

function cssVar(name, fallback) {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Series colours: RA blue and Dec red, as in the app's PHD2 guide graph. */
export const RA_COLOR = '#60a5fa';
export const DEC_COLOR = '#f87171';
export const RA_BAR_COLOR = 'rgba(96, 165, 250, 0.35)';
export const DEC_BAR_COLOR = 'rgba(248, 113, 113, 0.35)';
export const SNR_COLOR = '#22d3ee';
export const MASS_COLOR = 'rgba(167, 139, 250, 0.6)';
export const SETTLE_SHADE = 'rgba(251, 191, 36, 0.08)';
export const SETTLE_LEGEND_COLOR = 'rgba(251, 191, 36, 0.35)';
export const FONT = '10px system-ui, -apple-system, sans-serif';

/** Axis, grid and zero-line colours of the current theme. */
export const AXIS_COLOR = cssVar('--color-content-muted', '#8fa3bf');
export const GRID_COLOR = cssVar('--color-line', 'rgba(148, 163, 184, 0.16)');
export const ZERO_COLOR = cssVar('--color-line-strong', 'rgba(148, 163, 184, 0.32)');

export function pad2(n) {
  return String(n).padStart(2, '0');
}

/** hh:mm:ss of an epoch in seconds (uPlot's time unit). */
export function formatClock(epochSeconds) {
  const d = new Date(epochSeconds * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Axis tick: at most two decimals, a clean 0. */
export function formatTick(value) {
  if (Math.abs(value) < 1e-9) return '0';
  return String(Number(value.toFixed(2)));
}
