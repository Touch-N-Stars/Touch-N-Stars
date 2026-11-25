<template>
  <div class="tns-card space-y-1">
    <div class="text-xs font-semibold uppercase tracking-wider text-content-faint">
      {{ $t('components.sequence.simple.globalTriggers') }}
    </div>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.meridianFlip')"
      :hint="$t('components.sequence.simple.meridianFlipHint')"
      :active="isActive(meridianFlip)"
      :disabled="isRunning(meridianFlip)"
      :change="(on) => store.setGlobalTriggerEnabled(MERIDIAN_FLIP_TRIGGER_TYPE, on)"
    />

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.dither')"
      :hint="$t('components.sequence.simple.ditherHint')"
      :active="ditherActive"
      :disabled="isRunning(dither)"
      :change="(on) => store.setGlobalDither(on)"
    >
      <!-- Without the global trigger the exposure rows dither themselves (NINA's default). -->
      <p v-if="!isActive(dither) && exposureDitherText" class="text-xs text-content-muted">
        {{ exposureDitherText }}
      </p>
      <NumberInputPicker
        v-else-if="dither"
        :modelValue="Number(dither.AfterExposures ?? 1)"
        :label="$t('components.sequence.simple.ditherEvery')"
        labelKey="simple-dither-every"
        inputId="simple-dither-every"
        :min="1"
        :max="999"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        @change="store.setProperty(dither.Id, 'AfterExposures', $event)"
      />
    </SimpleSwitchRow>

    <SimpleAlsoActive :names="otherNames" @click="$emit('show-full')" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SimpleAlsoActive from './SimpleAlsoActive.vue';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  collectSmartExposureDithers,
  enabledItemNames,
  findByType,
  isActive,
  DITHER_AFTER_EXPOSURES_TYPE,
  MERIDIAN_FLIP_TRIGGER_TYPE,
} from '@/utils/sequenceSimple';

const props = defineProps({
  /** Trigger types another card shows, so they are not listed as "also active" here */
  shownElsewhere: { type: Array, default: () => [] },
});
defineEmits(['show-full']);

const store = useSequenceV2Store();
const { t } = useI18n();

const meridianFlip = computed(() => findByType(store.globalTriggers, MERIDIAN_FLIP_TRIGGER_TYPE));
const dither = computed(() => findByType(store.globalTriggers, DITHER_AFTER_EXPOSURES_TYPE));
// The dither triggers built into the Smart Exposures that still dither.
const exposureDithers = computed(() => collectSmartExposureDithers(store.data));
const ditherActive = computed(() => isActive(dither.value) || exposureDithers.value.length > 0);
const exposureDitherText = computed(() => {
  const intervals = new Set(exposureDithers.value.map((trigger) => Number(trigger.AfterExposures)));
  if (!intervals.size) return '';
  if (intervals.size > 1) return t('components.sequence.simple.ditherInExposuresMixed');
  const [every] = intervals;
  return t('components.sequence.simple.ditherInExposures', { count: every }, every);
});

const otherNames = computed(() =>
  enabledItemNames(store.globalTriggers, [
    MERIDIAN_FLIP_TRIGGER_TYPE,
    DITHER_AFTER_EXPOSURES_TYPE,
    ...props.shownElsewhere,
  ])
);

function isRunning(item) {
  return item?.Status === 'RUNNING';
}
</script>
