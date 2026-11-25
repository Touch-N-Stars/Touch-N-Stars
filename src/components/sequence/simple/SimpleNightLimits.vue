<template>
  <!-- Simple mode only: the plan's time window. The number of pictures stays the goal, these are
       the limits it has to fit in. -->
  <div class="tns-card space-y-1">
    <div class="text-xs font-semibold uppercase tracking-wider text-content-faint">
      {{ $t('components.sequence.simple.limits.title') }}
    </div>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.limits.wait')"
      :hint="$t('components.sequence.simple.limits.waitHint')"
      :active="state.waits"
      :disabled="!startArea || waitRunning"
      :change="changeWait"
    >
      <label for="simple-start-darkness" class="tns-label">
        {{ $t('components.sequence.simple.limits.startAt') }}
      </label>
      <select
        id="simple-start-darkness"
        class="tns-select"
        :value="startDarkness"
        :disabled="saving || waitRunning || targetRunning"
        @change="changeStart(Number($event.target.value))"
      >
        <option v-for="option in startOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </SimpleSwitchRow>
    <SimpleSwitchRow
      :label="$t('components.sequence.simple.limits.dawn')"
      :hint="$t(limitBlocker || 'components.sequence.simple.limits.dawnHint')"
      :active="state.stopsAtDawn"
      :disabled="Boolean(limitBlocker)"
      :change="(on) => changeLimit(SUN_CONDITION_TYPE, on, endDarkness)"
    >
      <label for="simple-end-darkness" class="tns-label">
        {{ $t('components.sequence.simple.limits.endAt') }}
      </label>
      <select
        id="simple-end-darkness"
        class="tns-select"
        :value="endDarkness"
        :disabled="saving || Boolean(limitBlocker)"
        @change="changeEnd(Number($event.target.value))"
      >
        <option v-for="option in endOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
    </SimpleSwitchRow>
    <SimpleSwitchRow
      :label="$t('components.sequence.simple.limits.low')"
      :hint="$t(limitBlocker || 'components.sequence.simple.limits.lowHint')"
      :active="state.stopsWhenLow"
      :disabled="Boolean(limitBlocker)"
      :change="(on) => changeLimit(ALTITUDE_CONDITION_TYPE, on, minAltitude)"
    >
      <NumberInputPicker
        :modelValue="minAltitude"
        :label="$t('components.sequence.simple.limits.minAltitude')"
        labelKey="components.sequence.simple.limits.minAltitude"
        inputId="simple-min-altitude"
        :min="0"
        :max="80"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        @change="changeLimit(ALTITUDE_CONDITION_TYPE, true, $event)"
      />
      <p class="text-xs text-content-faint">
        {{ $t('components.sequence.simple.limits.minAltitudeHint') }}
      </p>
    </SimpleSwitchRow>

    <SimpleNightWindow :planSummary="planSummary" :planTimes="planTimes" />
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SimpleNightWindow from '@/components/simpleMode/SimpleNightWindow.vue';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  DARK_SUN_ALTITUDES,
  MIN_TARGET_ALT_DEG,
  clampEndDarkness,
  darkFrom,
  darkUntil,
  defaultDarkness,
  planLimitState,
} from '@/utils/planLimits';
import {
  ALTITUDE_CONDITION_TYPE,
  START_AREA_TYPE,
  SUN_CONDITION_TYPE,
  darknessWait,
  findAreaContainer,
  formatClock,
} from '@/utils/sequenceSimple';
import { NIGHT_SUN_ALT_DEG } from '@/utils/tonightPicks';

const props = defineProps({
  /** planSummary, planTimes and site from usePlanSummary(), with the clock they count from */
  planSummary: { type: Object, required: true },
  planTimes: { type: Object, required: true },
  site: { type: Object, default: null },
  nowMs: { type: Number, required: true },
});

const base = 'components.sequence.simple.limits';
const DARKNESS_NAMES = {
  '-6': 'bright',
  '-9': 'dusky',
  '-12': 'usual',
  '-15': 'dark',
  '-18': 'darkest',
};

const { t } = useI18n();
const store = useSequenceV2Store();
const saving = ref(false);

const containers = computed(() => props.planSummary.targets.map((target) => target.container));
const state = computed(() => planLimitState(store.data, containers.value));
const startArea = computed(() => findAreaContainer(store.data, START_AREA_TYPE));
const waitRunning = computed(() => darknessWait(store.data).wait?.Status === 'RUNNING');
// The conditions end a running target the moment they do not hold; they change between runs only.
const targetRunning = computed(() => containers.value.some((c) => c.Status === 'RUNNING'));

// Why the two limits cannot be switched now (locale key), or ''. They belong to the targets.
const limitBlocker = computed(() => {
  if (!containers.value.length) return 'components.sequence.simple.limits.noTarget';
  return targetRunning.value ? 'components.sequence.simple.limits.targetRunning' : '';
});

const usualDarkness = computed(() => defaultDarkness(props.nowMs, props.site) ?? NIGHT_SUN_ALT_DEG);
const startDarkness = computed(() => state.value.startDarkness ?? usualDarkness.value);
const endDarkness = computed(
  () =>
    (state.value.stopsAtDawn ? state.value.endDarkness : null) ??
    clampEndDarkness(
      state.value.endDarkness ?? startDarkness.value,
      startDarkness.value,
      state.value.waits
    )
);
const minAltitude = computed(() => state.value.minAltitude ?? MIN_TARGET_ALT_DEG);

// A value from the full editor must not vanish from the list
function options(values, current, label) {
  return [...new Set([...values, current])]
    .sort((x, y) => y - x)
    .map((value) => ({ value, label: label(value) }));
}

const startOptions = computed(() =>
  options(DARK_SUN_ALTITUDES, startDarkness.value, (value) =>
    darknessLabel(value, 'from', (site) => darkFrom(props.nowMs, value, site))
  )
);

// The end is offered no darker than the start, see clampEndDarkness()
const endOptions = computed(() =>
  options(
    DARK_SUN_ALTITUDES.filter(
      (value) => clampEndDarkness(value, startDarkness.value, state.value.waits) === value
    ),
    endDarkness.value,
    (value) =>
      darknessLabel(value, 'until', (site) => {
        const dark = darkFrom(props.nowMs, value, site);
        return dark === null ? null : darkUntil(dark, value, site);
      })
  )
);

// "from 17:38 · usual (sun 12° below the horizon)": the time first, the rest may not fit
function darknessLabel(value, timeKey, timeAt) {
  const sun = t(`${base}.sunBelow`, { degrees: Math.abs(value) });
  const name = DARKNESS_NAMES[value];
  const text = name ? `${t(`${base}.darknessName.${name}`)} (${sun})` : sun;
  if (!props.site) return text;
  const time = timeAt(props.site);
  if (time === null) return `${t(`${base}.notTonight`)} · ${text}`;
  return time > props.nowMs
    ? `${t(`${base}.${timeKey}`, { time: formatClock(time) })} · ${text}`
    : text;
}

async function changeLimit(type, on, offset) {
  for (const container of containers.value) {
    if (!(await store.setTargetLimit(container.Id, type, on, offset))) break;
  }
}

async function changeWait(on, value = startDarkness.value) {
  await store.setDarknessWait(on, value);
  const { stopsAtDawn, endDarkness: end } = state.value;
  if (!on || !stopsAtDawn || end === null) return;
  const clamped = clampEndDarkness(end, value, true);
  if (clamped !== end) await changeLimit(SUN_CONDITION_TYPE, true, clamped);
}

async function whileSaving(action) {
  saving.value = true;
  try {
    await action();
  } finally {
    saving.value = false;
  }
}
const changeStart = (value) => whileSaving(() => changeWait(true, value));
const changeEnd = (value) => whileSaving(() => changeLimit(SUN_CONDITION_TYPE, true, value));
</script>
