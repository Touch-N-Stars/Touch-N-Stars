<template>
  <!-- Simple mode only: the imaging time instead of a number of pictures per row -->
  <div v-if="plan.length" class="rounded-control border border-line p-3 space-y-2">
    <NumberInputPicker
      v-model="hours"
      :label="$t('components.sequence.simple.budget.question')"
      labelKey="components.sequence.simple.budget.question"
      :inputId="`simple-budget-${target.container.Id}`"
      :min="0.5"
      :max="MAX_HOURS"
      :step="0.5"
      :decimalPlaces="1"
      :useDefaultSentinel="false"
      labelPosition="top"
      wrapperClass="w-full"
    />
    <p class="text-xs text-content-muted">{{ preview }}</p>
    <button
      type="button"
      class="tns-btn-secondary"
      :disabled="busy || isRunning"
      @click="apply(hours * 3600)"
    >
      <Spinner v-if="busy" size="sm" />
      {{ $t('components.sequence.simple.budget.apply') }}
    </button>
    <button
      v-if="nightSeconds >= MIN_NIGHT_SECONDS"
      type="button"
      class="tns-btn-secondary"
      :disabled="busy || isRunning"
      @click="apply(nightSeconds)"
    >
      {{
        $t('components.sequence.simple.budget.wholeNight', { time: formatDuration(nightSeconds) })
      }}
    </button>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { formatDuration, framesForTime } from '@/utils/sequenceSimple';
import { localDecimal } from '@/utils/localeNumber';

const props = defineProps({
  /** An entry from summarizeTargets(), with startMs and limitMs */
  target: { type: Object, required: true },
});

const base = 'components.sequence.simple.budget';
const MAX_HOURS = 14;
// Less than this is not worth a button of its own
const MIN_NIGHT_SECONDS = 600;

const { t } = useI18n();
const store = useSequenceV2Store();
const busy = ref(false);

const isRunning = computed(() => props.target.container.Status === 'RUNNING');

// Starts with what the plan says now, so opening the plan does not suggest another time.
const planned = Math.round((props.target.remainingSeconds / 3600) * 2) / 2;
const hours = ref(Math.min(MAX_HOURS, Math.max(0.5, planned)));

// What the night (and the target's altitude) still allow from the moment it is this target's turn
const nightSeconds = computed(() => {
  const { startMs, limitMs } = props.target;
  return limitMs ? Math.max(0, (limitMs - startMs) / 1000) : 0;
});

const plan = computed(() => framesForTime(props.target.rows, hours.value * 3600));
const preview = computed(() =>
  plan.value
    .map(({ row, frames }) => {
      const seconds = localDecimal(row.exposureTime, Number.isInteger(row.exposureTime) ? 0 : 1);
      const pictures = t(`${base}.pictures`, { count: frames, seconds }, frames);
      return row.filterName ? `${row.filterName}: ${pictures}` : pictures;
    })
    .join(', ')
);

async function apply(seconds) {
  busy.value = true;
  try {
    await store.setProperties(
      framesForTime(props.target.rows, seconds).map(({ row, iterations }) => ({
        id: row.loopCondition.Id,
        propertyName: 'Iterations',
        value: iterations,
      }))
    );
  } finally {
    busy.value = false;
  }
}
</script>
