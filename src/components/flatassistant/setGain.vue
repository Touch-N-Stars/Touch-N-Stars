<template>
  <div
    v-if="store.cameraInfo.Gains && store.cameraInfo.Gains.length > 0"
    class="flex flex-row w-full items-center min-w-28 border border-line-strong p-1 rounded-lg"
  >
    <label for="gain" class="text-sm mr-3 mb-1 text-content-muted">
      {{ $t('components.camera.gain_iso') }}
    </label>
    <select id="gain" v-model.number="flatsStore.gain" class="tns-select ml-auto w-28">
      <option v-for="(value, key) in store.cameraInfo.Gains" :key="key" :value="value">
        {{ value }}
      </option>
    </select>
  </div>
  <NumberInputPicker
    v-else
    v-model="flatsStore.gain"
    :label="$t('components.camera.gain_iso')"
    labelKey="components.camera.gain_iso"
    :min="0"
    :max="9999"
    :step="1"
    :decimalPlaces="0"
    placeholder="1"
    inputId="gain"
  />
</template>
<script setup>
import { onMounted } from 'vue';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const flatsStore = useFlatassistantStore();
const store = apiStore();

onMounted(() => {
  flatsStore.gain = store.profileInfo?.CameraSettings?.Gain;
});
</script>
