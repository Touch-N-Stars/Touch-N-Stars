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
};

export function countMetric(metric, filePath, source) {
  if (!metric.extensions.some((extension) => filePath.endsWith(extension))) return 0;
  return source.match(metric.pattern)?.length ?? 0;
}

export function compareToBaseline(counts, baseline) {
  const increased = [];
  const decreased = [];

  for (const name of Object.keys(METRICS)) {
    const entry = { name, count: counts[name], limit: baseline[name] };
    if (entry.count > entry.limit) increased.push(entry);
    if (entry.count < entry.limit) decreased.push(entry);
  }

  return { increased, decreased };
}
