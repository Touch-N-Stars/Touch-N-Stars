<template>
  <div
    class="flex items-center w-full justify-between gap-3"
    :class="
      compact
        ? 'bg-surface-2 rounded-chip px-3 py-2 min-h-touch'
        : 'border border-line-strong p-1 md:p-2 rounded-control'
    "
  >
    <label
      for="setDewHeaterStrength"
      class="font-medium text-content"
      :class="compact ? 'text-sm md:text-base' : 'text-xs md:text-sm'"
    >
      {{ $t('components.camera.dewHeaterStrength') }}
    </label>
    <select
      @change="setDewHeaterStrength"
      id="setDewHeaterStrength"
      v-model="dewHeaterStrength"
      class="tns-select w-20 md:w-28"
    >
      <option v-for="n in dewHeaterOptions" :key="n" :value="n">
        {{ n }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';

// Compact (status bar panel): row styled like the switch panel entries.
const { compact } = defineProps({
  compact: { type: Boolean, default: false },
});

const cameraStore = useCameraStore();
const dewHeaterStrength = ref(0);

// The parent only renders this component when MaxDewHeaterStrength is set.
const dewHeaterOptions = computed(() =>
  Array.from({ length: cameraStore.cameraSettings.MaxDewHeaterStrength + 1 }, (_, i) => i)
);

// Follow the backend value so changes made in NINA itself show up here too.
watch(
  () => cameraStore.cameraSettings?.TargetDewHeaterStrength,
  (value) => {
    if (Number.isFinite(value)) dewHeaterStrength.value = value;
  },
  { immediate: true }
);

async function setDewHeaterStrength() {
  try {
    const response = await apiService.cameraAction(
      `set-setting?settingName=TargetDewHeaterStrength&newValue=${dewHeaterStrength.value}`
    );
    await cameraStore.readSettings();
    console.log('[dewHeaterStrength] ', response);
  } catch (error) {
    console.log('Error while setting dewHeaterStrength');
  }
}
</script>
