<template>
  <section class="tns-card flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">{{ k('history.title') }}</h3>
      <span v-if="trend.length" class="text-xs text-content-faint">
        {{ k('history.nights', { count: trend.length }) }}
      </span>
    </div>

    <p v-if="store.coachHistoryError" class="text-xs text-status-danger">
      {{ k('history.loadFailed') }}: {{ store.coachHistoryError }}
    </p>
    <p v-else-if="!reports.length" class="text-xs text-content-muted">
      {{ store.coachHistoryLoading ? '…' : k('history.empty') }}
    </p>

    <template v-else>
      <!-- Per-night trend sparklines -->
      <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div v-for="metric in metrics" :key="metric.key" class="tns-stat-tile gap-1!">
          <span class="tns-stat-label">{{ k(`history.metrics.${metric.key}`) }}</span>
          <span class="tns-stat-value">{{ metric.latest }}</span>
          <svg
            v-if="metric.points"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            class="h-6 w-full"
            aria-hidden="true"
          >
            <polyline
              :points="metric.points"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
              class="text-accent"
            />
          </svg>
        </div>
      </div>

      <!-- Comparison with the previous report -->
      <div v-if="comparison.length" class="flex flex-col gap-1.5">
        <span class="text-xs text-content-muted">
          {{ k('history.compare', { date: formatDate(previous?.timestamp) }) }}
        </span>
        <ul class="flex flex-col divide-y divide-line text-sm">
          <li
            v-for="row in comparison"
            :key="row.key"
            class="flex items-baseline justify-between gap-3 py-1.5"
          >
            <span class="text-content-muted">{{ k(`history.metrics.${row.key}`) }}</span>
            <span class="flex items-baseline gap-2 tabular-nums">
              <span class="text-content-faint">{{ formatMetric(row.field, row.before) }}</span>
              →
              <span class="font-semibold text-content">{{ formatMetric(row.field, row.now) }}</span>
              <span class="text-xs font-semibold" :class="trendClass(row.trend)">
                {{ k(`history.trend.${row.trend}`) }}
              </span>
            </span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { fmt } from '@/utils/nativeGuider';
import { compareReports, nightlyTrend, sparklinePoints } from '@/utils/nativeGuiderCoach';
import { useCoachText } from './useCoachText';

const store = useNativeGuiderStore();
const { k } = useCoachText();

const reports = computed(() => store.coachHistory || []);
const trend = computed(() => nightlyTrend(reports.value));
const current = computed(() => reports.value[0] || null);
const previous = computed(() => reports.value[1] || null);
const comparison = computed(() => compareReports(current.value, previous.value));

const FORMAT = {
  guidedRmsArcsec: (v) => `${fmt(v, 2)}″`,
  seeingArcsec: (v) => `${fmt(v, 2)}″`,
  polarAlignmentErrorArcmin: (v) => `${fmt(v, 1)}′`,
  backlashArcsec: (v) => `${fmt(v, 1)}″`,
  periodicErrorAmplitudeArcsec: (v) => `±${fmt(v, 1)}″`,
};

function formatMetric(field, value) {
  return Number.isFinite(value) ? (FORMAT[field] || ((v) => fmt(v, 2)))(value) : '–';
}

function lastValue(values) {
  for (let i = values.length - 1; i >= 0; i--) if (Number.isFinite(values[i])) return values[i];
  return null;
}

function gradeLabel(value) {
  const grade = { 4: 'excellent', 3: 'good', 2: 'fair', 1: 'poor' }[value];
  return grade ? k(`report.grades.${grade}`) : '–';
}

const metrics = computed(() => {
  const rows = trend.value;
  const series = (key) => rows.map((r) => r[key]);
  const build = (key, values, format) => ({
    key,
    latest: lastValue(values) === null ? '–' : format(lastValue(values)),
    points: values.filter((v) => Number.isFinite(v)).length > 1 ? sparklinePoints(values) : '',
  });
  return [
    build('rms', series('rms'), (v) => `${fmt(v, 2)}″`),
    build('grade', series('grade'), gradeLabel),
    build('polarAlignment', series('polarAlignment'), (v) => `${fmt(v, 1)}′`),
    build('backlash', series('backlash'), (v) => `${fmt(v, 1)}″`),
  ];
});

function trendClass(trend) {
  if (trend === 'better') return 'text-status-ok';
  if (trend === 'worse') return 'text-status-warn';
  return 'text-content-faint';
}

function formatDate(timestamp) {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return '–';
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
</script>
