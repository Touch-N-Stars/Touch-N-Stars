<template>
  <div class="flex flex-col">
    <div
      v-for="row in rows"
      :key="row.key"
      class="flex items-center justify-between gap-3 border-b border-gray-700/40 py-1.5 text-sm"
    >
      <span class="flex items-center gap-1 text-gray-400">
        {{ L(row.key) }}
        <InfoModal
          v-if="row.help"
          :title="L(row.key)"
          :message="L(`help.${row.key}`)"
          size="w-4 h-4"
        />
      </span>
      <span class="text-right text-gray-100 tabular-nums">{{ row.value }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import InfoModal from '@/components/helpers/infoModal.vue';

// The metrics HocusFocus shows under its AutoFocus chart, in the same order and under the same
// conditions: a row only appears when the run produced its value.
const props = defineProps({
  // Response of GET /hocusfocus/autofocus/last-run
  run: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`components.focuser.hf.${key}`);

const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const fixed = (v, digits) => (isNumber(v) ? v.toFixed(digits) : '--');

function formatDuration(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatTimestamp(value) {
  const date = new Date(value);
  return isNaN(date.getTime()) ? '--' : `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

const rows = computed(() => {
  const run = props.run;
  const curves = run.Curves || {};
  const out = [];
  const add = (key, value, help = false) => out.push({ key, value, help });

  if (run.Timestamp) add('time', formatTimestamp(run.Timestamp));
  if (isNumber(run.FinalFocuserPosition)) {
    add(
      'position',
      isNumber(run.InitialFocuserPosition)
        ? `${run.InitialFocuserPosition} → ${run.FinalFocuserPosition}`
        : `${run.FinalFocuserPosition}`
    );
  }
  if (isNumber(run.FinalHFR)) {
    add('hfrChange', `${fixed(run.InitialHFR, 2)} → ${fixed(run.FinalHFR, 2)}`);
  } else if (isNumber(run.InitialHFR)) {
    add('startHfr', fixed(run.InitialHFR, 2));
  }
  if (isNumber(run.EstimatedFinalHFR)) add('estimatedFinalHfr', fixed(run.EstimatedFinalHFR, 2));
  if (isNumber(run.Temperature)) add('temperature', `${fixed(run.Temperature, 2)} °C`);
  if (run.Filter) add('filter', run.Filter);

  if (curves.Quadratic) add('parabolicR2', fixed(curves.Quadratic.RSquared, 2));
  if (curves.Hyperbolic) {
    add('hyperbolicR2', fixed(curves.Hyperbolic.RSquared, 2));
    add(
      'focusStdError',
      isNumber(run.HyperbolicMinimumStdError)
        ? t('components.focuser.hf.stepsValue', { value: run.HyperbolicMinimumStdError.toFixed(1) })
        : '--',
      true
    );
  }
  if (run.HyperbolicFitModel) add('hyperbolicModel', run.HyperbolicFitModel, true);
  if (isNumber(run.AcceptedStarCountMin) && isNumber(run.AcceptedStarCountMax)) {
    add(
      'starsDetected',
      run.AcceptedStarCountMin === run.AcceptedStarCountMax
        ? run.AcceptedStarCountMin.toLocaleString()
        : `${run.AcceptedStarCountMin.toLocaleString()} – ${run.AcceptedStarCountMax.toLocaleString()}`,
      true
    );
  }
  if (curves.Trendlines) {
    add(
      'trendlinesR2',
      `${fixed(curves.Trendlines.LeftRSquared, 2)} | ${fixed(curves.Trendlines.RightRSquared, 2)}`
    );
  }
  if (isNumber(run.DurationSeconds) && run.DurationSeconds > 0) {
    add('duration', formatDuration(run.DurationSeconds));
  }
  return out;
});
</script>
