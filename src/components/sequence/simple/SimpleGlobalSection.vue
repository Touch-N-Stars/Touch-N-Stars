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
      :active="isActive(dither)"
      :disabled="isRunning(dither)"
      :change="(on) => store.setGlobalDither(on)"
    >
      <NumberInputPicker
        v-if="dither"
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
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SimpleAlsoActive from './SimpleAlsoActive.vue';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  enabledItemNames,
  findByType,
  isActive,
  DITHER_AFTER_EXPOSURES_TYPE,
  MERIDIAN_FLIP_TRIGGER_TYPE,
} from '@/utils/sequenceSimple';

defineEmits(['show-full']);

const store = useSequenceV2Store();

const meridianFlip = computed(() => findByType(store.globalTriggers, MERIDIAN_FLIP_TRIGGER_TYPE));
const dither = computed(() => findByType(store.globalTriggers, DITHER_AFTER_EXPOSURES_TYPE));

const otherNames = computed(() =>
  enabledItemNames(store.globalTriggers, [MERIDIAN_FLIP_TRIGGER_TYPE, DITHER_AFTER_EXPOSURES_TYPE])
);

function isRunning(item) {
  return item?.Status === 'RUNNING';
}
</script>
