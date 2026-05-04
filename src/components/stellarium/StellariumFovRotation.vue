<template>
  <div :class="positionClasses" class="absolute z-30">
    <button
      v-if="!expanded"
      @click="expanded = true"
      class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md"
      :title="$t('components.framing.fovSettings.rotationAngle')"
    >
      <div class="relative flex items-center justify-center w-7 h-7">
        <ArrowPathIcon class="w-7 h-7 absolute text-cyan-300" />
        <CameraIcon class="w-3 h-3 text-white" />
      </div>
    </button>
    <div
      v-else
      class="flex items-center gap-2 bg-black bg-opacity-90 border border-cyan-600 rounded-lg p-2 shadow-md w-72"
    >
      <NumberInputPicker
        v-model="rotationModel"
        :label="$t('components.framing.fovSettings.rotationAngle')"
        labelKey="components.framing.fovSettings.rotationAngle"
        :min="0"
        :max="360"
        :step="1"
        :decimalPlaces="1"
        inputId="stellarium-fov-rotation"
      />
      <button @click="expanded = false" class="p-1 text-gray-300 hover:text-white shrink-0">
        <XMarkIcon class="w-5 h-5" />
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ArrowPathIcon, XMarkIcon, CameraIcon } from '@heroicons/vue/24/outline';
import { useFramingStore } from '@/store/framingStore';
import { useOrientation } from '@/composables/useOrientation';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const framingStore = useFramingStore();
const { isLandscape } = useOrientation();

const expanded = ref(false);

const rotationModel = computed({
  get: () => Number(framingStore.rotationAngle ?? 0),
  set: (value) => {
    framingStore.rotationAngle = Number(value);
  },
});

const positionClasses = computed(() => ({
  'top-3 right-3': !isLandscape.value,
  'top-3 right-20': isLandscape.value,
}));
</script>
