<template>
  <div class="flex items-center justify-between">
    <span class="flex items-center gap-1">
      <label for="plateSolveBinning" class="text-sm font-medium text-content">
        {{ $t('components.settings.plate_solver.Binning') }}
      </label>
      <InfoModal
        :title="$t('components.settings.plate_solver.Binning')"
        :message="$t('components.settings.plate_solver.help.Binning')"
        size="w-4 h-4"
      />
    </span>
    <select
      id="plateSolveBinning"
      v-model="binning"
      @change="saveBinning"
      :class="statusClass"
      class="tns-select w-40 ml-3 shrink-0"
    >
      <option v-for="bin in binningOptions" :key="bin" :value="bin">{{ bin }}x{{ bin }}</option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
import InfoModal from '@/components/helpers/infoModal.vue';

const store = apiStore();

// Offered while no camera is connected, so the setting can still be prepared.
const DEFAULT_BINNINGS = [1, 2, 3, 4];

const {
  value: binning,
  save: saveBinning,
  glowClass: statusClass,
} = useProfileSetting('PlateSolveSettings-Binning', { fallback: 1 });

// NINA bins both axes with the one profile value, so only symmetric modes are offered.
// The stored value stays listed even when the connected camera does not offer it.
const binningOptions = computed(() => {
  const cameraBins = (store.cameraInfo?.BinningModes ?? [])
    .filter((mode) => mode.X === mode.Y)
    .map((mode) => mode.X);
  const options = new Set(cameraBins.length ? cameraBins : DEFAULT_BINNINGS);
  if (binning.value != null) options.add(binning.value);
  return [...options].sort((a, b) => a - b);
});
</script>
