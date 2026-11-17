// Fails when the legacy UI patterns in METRICS grow beyond the committed baseline, so the
// UI migration can only move forward. `--update` lowers the baseline after a migration; it
// never raises it, because a higher limit should be a deliberate edit visible in review.
import fs from 'node:fs';
import path from 'node:path';
import { METRICS, compareToBaseline, countMetric } from './lib/uiRatchet.mjs';

const SOURCE_DIR = path.resolve('src');
const BASELINE_FILE = path.resolve('scripts/ui-ratchet-baseline.json');
const IGNORED_DIRS = new Set(['__tests__', 'locales']);

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (!entry.isDirectory()) return [entryPath];
    return IGNORED_DIRS.has(entry.name) ? [] : listFiles(entryPath);
  });
}

function countAll() {
  const counts = Object.fromEntries(Object.keys(METRICS).map((name) => [name, 0]));

  for (const filePath of listFiles(SOURCE_DIR)) {
    if (!/\.(vue|js)$/.test(filePath)) continue;
    const source = fs.readFileSync(filePath, 'utf8');
    for (const [name, metric] of Object.entries(METRICS)) {
      counts[name] += countMetric(metric, filePath, source);
    }
  }

  return counts;
}

const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
const counts = countAll();
const { increased, decreased } = compareToBaseline(counts, baseline);

for (const { name, count, limit } of increased) {
  console.error(`${METRICS[name].label}: ${count}, limit ${limit}. ${METRICS[name].hint}.`);
}
if (increased.length > 0) process.exit(1);

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log('UI ratchet baseline updated.');
  process.exit(0);
}

for (const { name, count, limit } of decreased) {
  console.log(`${METRICS[name].label}: ${count}, limit ${limit}. Run npm run ratchet:update.`);
}
console.log('UI ratchet passed.');
