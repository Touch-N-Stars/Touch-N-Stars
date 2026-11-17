<template>
  <div class="tns-card space-y-1">
    <div class="text-xs font-semibold uppercase tracking-wider text-content-faint">
      {{ $t('components.sequence.simple.end') }}
    </div>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.warmCamera')"
      :active="isActive(warmCamera)"
      :disabled="!endArea || warmCamera?.Status === 'RUNNING'"
      :change="(on) => store.setEndItemEnabled(WARM_CAMERA_TYPE, on)"
    >
      <NumberInputPicker
        v-if="warmCamera"
        :modelValue="Number(warmCamera.Duration ?? 0)"
        :label="$t('components.sequence.items.warmCamera.duration')"
        labelKey="simple-warm-duration"
        inputId="simple-warm-duration"
        :min="0"
        :max="999"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        @change="store.setProperty(warmCamera.Id, 'Duration', $event)"
      />
    </SimpleSwitchRow>

    <SimpleSwitchRow
      :label="$t('components.sequence.simple.parkMount')"
      :active="isActive(park)"
      :disabled="!endArea || park?.Status === 'RUNNING'"
      :change="(on) => store.setEndItemEnabled(PARK_SCOPE_TYPE, on)"
    />

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
  findAreaContainer,
  findByType,
  isActive,
  END_AREA_TYPE,
  END_ORDER,
  PARK_SCOPE_TYPE,
  WARM_CAMERA_TYPE,
} from '@/utils/sequenceSimple';

defineEmits(['show-full']);

const store = useSequenceV2Store();

const endArea = computed(() => findAreaContainer(store.data, END_AREA_TYPE));
const warmCamera = computed(() => findByType(endArea.value?.Items, WARM_CAMERA_TYPE));
const park = computed(() => findByType(endArea.value?.Items, PARK_SCOPE_TYPE));

const otherNames = computed(() => enabledItemNames(endArea.value?.Items, END_ORDER));
</script>
