<template>
  <div class="rounded-control border border-line">
    <!-- Collapsed: one line with what is switched on -->
    <button
      type="button"
      class="w-full min-h-touch flex items-center gap-2 px-3 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronRightIcon
        class="w-4 h-4 shrink-0 text-content-faint transition-transform duration-200"
        :class="{ 'rotate-90': open }"
      />
      <span class="shrink-0 text-sm font-medium text-content">
        {{ $t('components.sequence.simple.targetOptions') }}
      </span>
      <span class="min-w-0 flex-1 truncate text-xs text-content-faint text-right">
        {{ activeSummary || $t('components.sequence.simple.nothing') }}
      </span>
    </button>

    <div v-if="open" class="px-3 pb-3 space-y-1 border-t border-line">
      <!-- Approach -->
      <div class="min-h-touch flex items-center gap-3 pt-2">
        <label :for="`simple-slew-${container.Id}`" class="flex-1 text-sm text-content">
          {{ $t('components.sequence.simple.approach') }}
        </label>
        <select
          :id="`simple-slew-${container.Id}`"
          class="tns-select w-auto! text-sm"
          :value="mode"
          :disabled="isRunning || busy"
          @change="changeMode($event.target.value)"
        >
          <option v-for="option in SLEW_MODES" :key="option" :value="option">
            {{ $t(`components.sequence.simple.approachMode.${option}`) }}
          </option>
        </select>
      </div>

      <SimpleSwitchRow
        :label="$t('components.sequence.simple.startGuiding')"
        :active="isActive(startGuiding)"
        :disabled="isRunning"
        :change="(on) => store.setTargetItemEnabled(container.Id, START_GUIDING_TYPE, on)"
      />

      <!-- Autofocus -->
      <div class="pt-2 text-xs font-semibold uppercase tracking-wider text-content-faint">
        {{ $t('components.sequence.simple.autofocus') }}
      </div>

      <SimpleSwitchRow
        :label="$t('components.sequence.simple.afOnStart')"
        :active="isActive(runAutofocus)"
        :disabled="isRunning"
        :change="(on) => store.setTargetItemEnabled(container.Id, RUN_AUTOFOCUS_TYPE, on)"
      />

      <SimpleSwitchRow
        v-for="trigger in afTriggers"
        :key="trigger.type"
        :label="$t(`components.sequence.simple.${trigger.labelKey}`)"
        :active="isActive(trigger.item)"
        :disabled="trigger.item?.Status === 'RUNNING'"
        :change="(on) => store.setContainerTriggerEnabled(container.Id, trigger.type, on)"
      >
        <NumberInputPicker
          v-if="trigger.item && trigger.field"
          :modelValue="Number(trigger.item[trigger.field] ?? 0)"
          :label="$t(trigger.fieldLabel)"
          :labelKey="`simple-${trigger.labelKey}`"
          :inputId="`simple-${trigger.labelKey}-${container.Id}`"
          :min="trigger.min"
          :max="trigger.max"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          @change="store.setProperty(trigger.item.Id, trigger.field, $event)"
        />
      </SimpleSwitchRow>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon } from '@heroicons/vue/24/outline';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  findByType,
  isActive,
  slewMode,
  AF_AFTER_EXPOSURES_TYPE,
  AF_AFTER_FILTER_CHANGE_TYPE,
  AF_AFTER_HFR_TYPE,
  AF_AFTER_TEMPERATURE_TYPE,
  AF_AFTER_TIME_TYPE,
  RUN_AUTOFOCUS_TYPE,
  START_GUIDING_TYPE,
} from '@/utils/sequenceSimple';

// Steps (approach, guiding, autofocus at the start) and autofocus triggers of one target.
// Steps of a running target are locked, its triggers stay adjustable -- NINA reads them
// after every frame, so e.g. "autofocus after HFR increase" can still be switched mid-run.
const props = defineProps({
  container: { type: Object, required: true },
});

const SLEW_MODES = ['off', 'slew', 'center', 'centerAndRotate'];

const { t } = useI18n();
const store = useSequenceV2Store();
const open = ref(false);
const busy = ref(false);

const isRunning = computed(() => props.container.Status === 'RUNNING');
const mode = computed(() => slewMode(props.container));
const startGuiding = computed(() => findByType(props.container.Items, START_GUIDING_TYPE));
const runAutofocus = computed(() => findByType(props.container.Items, RUN_AUTOFOCUS_TYPE));

const afTriggers = computed(() =>
  [
    { type: AF_AFTER_FILTER_CHANGE_TYPE, labelKey: 'afOnFilterChange' },
    {
      type: AF_AFTER_TIME_TYPE,
      labelKey: 'afAfterTime',
      field: 'Amount',
      fieldLabel: 'components.sequence.items.autofocus.minutes',
      min: 1,
      max: 999,
    },
    {
      type: AF_AFTER_EXPOSURES_TYPE,
      labelKey: 'afAfterExposures',
      field: 'AfterExposures',
      fieldLabel: 'components.sequence.items.autofocus.afterExposures',
      min: 1,
      max: 9999,
    },
    {
      type: AF_AFTER_TEMPERATURE_TYPE,
      labelKey: 'afAfterTemperature',
      field: 'Amount',
      fieldLabel: 'components.sequence.items.autofocus.deltaT',
      min: 1,
      max: 50,
    },
    {
      type: AF_AFTER_HFR_TYPE,
      labelKey: 'afAfterHfr',
      field: 'Amount',
      fieldLabel: 'components.sequence.items.autofocus.hfrIncrease',
      min: 1,
      max: 100,
    },
  ].map((trigger) => ({ ...trigger, item: findByType(props.container.Triggers, trigger.type) }))
);

const activeSummary = computed(() => {
  const parts = [];
  if (mode.value !== 'off') parts.push(t(`components.sequence.simple.approachMode.${mode.value}`));
  if (isActive(startGuiding.value)) parts.push(t('components.sequence.simple.startGuiding'));
  const afCount =
    (isActive(runAutofocus.value) ? 1 : 0) +
    afTriggers.value.filter((trigger) => isActive(trigger.item)).length;
  if (afCount) parts.push(t('components.sequence.simple.autofocusCount', { count: afCount }));
  return parts.join(' · ');
});

async function changeMode(value) {
  busy.value = true;
  try {
    await store.setTargetSlewMode(props.container.Id, value);
  } finally {
    busy.value = false;
  }
}
</script>
