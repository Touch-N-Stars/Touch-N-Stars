<template>
  <div v-if="binningOptions.length > 1">
    <label for="tppa-binning" class="tns-label mb-1 block">
      {{ $t('components.tppa.settings.binning') }}
    </label>
    <select id="tppa-binning" v-model="tppaStore.settings.Binning" class="tns-select w-full">
      <option :value="null">{{ $t('components.tppa.settings.nina_default') }}</option>
      <option v-for="bin in binningOptions" :key="bin" :value="bin">{{ bin }}x{{ bin }}</option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useTppaStore } from '@/store/tppaStore';
import { apiStore } from '@/store/store';

const tppaStore = useTppaStore();
const store = apiStore();

// The TPPA plugin only takes one value and bins both axes with it, so only
// the camera's symmetric modes are offered.
const binningOptions = computed(() =>
  (store.cameraInfo?.BinningModes ?? []).filter((mode) => mode.X === mode.Y).map((mode) => mode.X)
);
</script>
