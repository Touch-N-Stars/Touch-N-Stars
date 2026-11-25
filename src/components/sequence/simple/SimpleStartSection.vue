<template>
  <div class="tns-card space-y-1">
    <div class="text-xs font-semibold uppercase tracking-wider text-content-faint">
      {{ $t('components.sequence.simple.start') }}
    </div>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.coolCamera')"
      :hint="$t('components.sequence.simple.coolCameraHint')"
      :active="isActive(coolCamera)"
      :disabled="!startArea || coolCamera?.Status === 'RUNNING'"
      :change="(on) => store.setStartItemEnabled(COOL_CAMERA_TYPE, on)"
    >
      <template v-if="coolCamera">
        <NumberInputPicker
          :modelValue="Number(coolCamera.Temperature ?? 0)"
          :label="$t('components.sequence.items.coolCamera.temperature')"
          labelKey="simple-cool-temp"
          inputId="simple-cool-temp"
          :min="-50"
          :max="40"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          @change="store.setProperty(coolCamera.Id, 'Temperature', $event)"
        />
        <NumberInputPicker
          :modelValue="Number(coolCamera.Duration ?? 0)"
          :label="$t('components.sequence.items.coolCamera.duration')"
          labelKey="simple-cool-duration"
          inputId="simple-cool-duration"
          :min="0"
          :max="999"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          @change="store.setProperty(coolCamera.Id, 'Duration', $event)"
        />
      </template>
    </SimpleSwitchRow>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.unparkMount')"
      :active="isActive(unpark)"
      :disabled="!startArea || unpark?.Status === 'RUNNING'"
      :change="(on) => store.setStartItemEnabled(UNPARK_SCOPE_TYPE, on)"
    />

    <SimpleAlsoActive :names="otherNames" @click="$emit('show-full')" />
  </div>
</template>

<script setup>
import { computed } from 'vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import SimpleAlsoActive from './SimpleAlsoActive.vue';
import SimpleSwitchRow from './SimpleSwitchRow.vue';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  enabledItemNames,
  findAreaContainer,
  findByType,
  isActive,
  COOL_CAMERA_TYPE,
  START_AREA_TYPE,
  UNPARK_SCOPE_TYPE,
  darknessWait,
} from '@/utils/sequenceSimple';

defineEmits(['show-full']);

const store = useSequenceV2Store();
const { active: simpleMode } = useSimpleMode();

const startArea = computed(() => findAreaContainer(store.data, START_AREA_TYPE));
const coolCamera = computed(() => findByType(startArea.value?.Items, COOL_CAMERA_TYPE));
const unpark = computed(() => findByType(startArea.value?.Items, UNPARK_SCOPE_TYPE));

// The wait for darkness has its switch in SimpleNightLimits, which only the simple mode shows.
const otherNames = computed(() => {
  const waitParts = simpleMode.value ? Object.values(darknessWait(store.data)) : [];
  const items = (startArea.value?.Items ?? []).filter((item) => !waitParts.includes(item));
  return enabledItemNames(items, [COOL_CAMERA_TYPE, UNPARK_SCOPE_TYPE]);
});
</script>
