const COLOR_FAMILIES =
  'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITIES =
  'bg|text|border(?:-[trblxyse])?|ring|ring-offset|divide|from|via|to|outline|placeholder|fill|stroke|shadow|accent|caret|decoration';

// Tailwind's default palette, with or without variants (`hover:`) and opacity (`/50`).
// The design tokens from src/assets/tailwind.css have no numeric shade, so they never match.
const LEGACY_COLOR_RE = new RegExp(
  `(?<![\\w-])(?:${COLOR_UTILITIES})-(?:${COLOR_FAMILIES})-\\d{2,3}(?![\\w-])`,
  'g'
);
const RAW_NUMBER_INPUT_RE = /\btype=(["'])number\1/g;

const POLLING_TIMER_RE = /\bsetInterval\s*\(/g;
const AD_HOC_SPINNER_RE = /(?<![\w-])animate-spin(?![\w-])/g;
const AD_HOC_OVERLAY_RE = /(?<![\w:-])(?:fixed inset-0|inset-0 fixed)(?![\w-])/g;
// Overlay layers only: arbitrary `z-[n]`, the numeric classes from z-40 up, and literal
// z-index values of 40 or more. z-10..z-30 for stacking inside a component stay allowed.
const RAW_OVERLAY_Z_RE =
  /(?<![\w-])z-(?:\[\d+\]|[4-9]0)(?![\w-])|\bz-index\s*:\s*(?:[4-9]\d|\d{3,})\b|\bzIndex\s*:\s*['"]?(?:[4-9]\d|\d{3,})\b/g;
const WEBKIT_SELECTION_RE = /-webkit-(?:user-select|touch-callout)\s*:/g;

// Opening <draggable> tags, attribute values may contain `>` (arrow functions).
const DRAGGABLE_TAG_RE = /<draggable\b(?:[^>"']|"[^"]*"|'[^']*')*>/g;
const FORCE_FALLBACK_RE = /\bforce-?[fF]allback\b\s*[:=]\s*["']?true\b/g;

function countDraggablesWithoutFallbackOnBody(source) {
  const tags = source.match(DRAGGABLE_TAG_RE) ?? [];
  return tags.filter((tag) => !/fallback-?[oO]n-?[bB]ody/.test(tag)).length;
}

// Every metric ratchets against scripts/ui-ratchet-baseline.json and may only go down; once
// a metric reaches 0 it works as a plain ban.
export const METRICS = {
  legacyColors: {
    label: 'legacy color classes',
    hint: 'use the design tokens from src/assets/tailwind.css',
    extensions: ['.vue', '.js'],
    pattern: LEGACY_COLOR_RE,
  },
  rawNumberInputs: {
    label: 'raw number inputs',
    hint: 'use NumberInputPicker from src/components/helpers/',
    extensions: ['.vue'],
    pattern: RAW_NUMBER_INPUT_RE,
  },
  pollingTimers: {
    label: 'setInterval calls',
    hint: 'use usePolling (src/composables/usePolling.js) in components, createPoller (src/utils/poller.js) elsewhere',
    extensions: ['.vue', '.js'],
    pattern: POLLING_TIMER_RE,
  },
  adHocSpinners: {
    label: 'animate-spin outside Spinner',
    hint: 'use Spinner from src/components/helpers/',
    extensions: ['.vue', '.js'],
    pattern: AD_HOC_SPINNER_RE,
    excludeFiles: ['src/components/helpers/Spinner.vue'],
  },
  adHocOverlays: {
    label: 'fixed inset-0 overlays outside Modal',
    hint: 'use Modal from src/components/helpers/',
    extensions: ['.vue', '.js'],
    pattern: AD_HOC_OVERLAY_RE,
    excludeFiles: ['src/components/helpers/Modal.vue'],
  },
  rawOverlayZIndex: {
    label: 'raw overlay z-index values',
    hint: 'pick a layer from the zIndex scale in tailwind.config.cjs (z-modal, z-dialog, ...)',
    extensions: ['.vue', '.js'],
    pattern: RAW_OVERLAY_Z_RE,
  },
  webkitSelectionBlocks: {
    label: 'per-component -webkit-user-select/-webkit-touch-callout',
    hint: 'both are switched off app-wide on body in src/assets/tailwind.css; use select-text to opt in',
    extensions: ['.vue'],
    pattern: WEBKIT_SELECTION_RE,
  },
  draggableWithoutFallbackOnBody: {
    label: '<draggable> without :fallbackOnBody="true"',
    hint: 'Sortable.js misplaces the drag ghost on Android Chrome under backdrop-filter, see CLAUDE.md',
    extensions: ['.vue'],
    count: countDraggablesWithoutFallbackOnBody,
  },
  forceFallback: {
    label: 'forceFallback: true',
    hint: 'use :fallbackOnBody="true" instead, see CLAUDE.md',
    extensions: ['.vue', '.js'],
    pattern: FORCE_FALLBACK_RE,
  },
};

export function countMetric(metric, filePath, source) {
  if (!metric.extensions.some((extension) => filePath.endsWith(extension))) return 0;
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (metric.excludeFiles?.some((file) => normalizedPath.endsWith(file))) return 0;
  if (metric.count) return metric.count(source);
  return source.match(metric.pattern)?.length ?? 0;
}

// A metric missing from the baseline gets limit 0, so a new metric only passes once its
// starting count has been written to the baseline on purpose.
export function compareToBaseline(counts, baseline) {
  const increased = [];
  const decreased = [];

  for (const name of Object.keys(counts)) {
    const entry = { name, count: counts[name], limit: baseline[name] ?? 0 };
    if (entry.count > entry.limit) increased.push(entry);
    if (entry.count < entry.limit) decreased.push(entry);
  }

  return { increased, decreased };
}
