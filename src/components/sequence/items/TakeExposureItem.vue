<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted shrink-0 font-mono">{{ item.ExposureTime }}s</span>
      <span class="text-xs text-content-faint shrink-0">G{{ item.Gain }}</span>
      <span class="text-xs text-content-faint shrink-0">{{ item.ImageType }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.ExposureTime"
        :label="$t('components.sequence.items.takeExposure.exposureTime')"
        labelKey="takeExposure-exposureTime"
        :min="0"
        :max="3600"
        :step="0.1"
        :decimalPlaces="3"
        @change="save('ExposureTime', $event)"
      />
      <GainInput
        :modelValue="item.Gain"
        labelKey="takeExposure-gain"
        :min="0"
        :max="1000"
        @change="save('Gain', $event)"
      />
      <NumberInputPicker
        :modelValue="item.Offset"
        :label="$t('components.sequence.items.takeExposure.offset')"
        labelKey="takeExposure-offset"
        :min="-1"
        :max="1000"
        :step="1"
        @change="save('Offset', $event)"
      />

      <!-- Binning -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.binning')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="binningValue"
          @change="save('Binning', $event.target.value)"
        >
          <option value='{"X":1,"Y":1}'>1x1</option>
          <option value='{"X":2,"Y":2}'>2x2</option>
          <option value='{"X":3,"Y":3}'>3x3</option>
          <option value='{"X":4,"Y":4}'>4x4</option>
        </select>
      </div>

      <!-- Image Type -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.imageType')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="item.ImageType"
          @change="save('ImageType', $event.target.value)"
        >
          <option value="LIGHT">LIGHT</option>
          <option value="DARK">DARK</option>
          <option value="FLAT">FLAT</option>
          <option value="BIAS">BIAS</option>
        </select>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import GainInput from '@/components/helpers/GainInput.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

const binningValue = computed(() => {
  const b = props.item.Binning;
  if (!b) return '{"X":1,"Y":1}';
  return JSON.stringify({ X: b.X, Y: b.Y });
});
</script>
