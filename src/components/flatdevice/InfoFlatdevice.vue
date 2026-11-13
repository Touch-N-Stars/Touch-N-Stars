<template>
  <div v-if="!store.flatdeviceInfo.Connected" class="text-status-danger">
    <p>{{ $t('components.flat.please_connect_flatDevice') }}</p>
  </div>
  <div
    v-else
    :class="
      compact
        ? 'flex flex-wrap items-center gap-x-5 gap-y-2'
        : 'grid grid-cols-2 landscape:grid-cols-3 gap-2'
    "
  >
    <StatusString
      :class="compact ? 'basis-full!' : 'col-span-full'"
      :compact="compact"
      :isEnabled="store.flatdeviceInfo.Name !== undefined"
      :Name="$t('components.flat.device_name')"
      :Value="store.flatdeviceInfo.Name"
    />
    <StatusString
      :compact="compact"
      :isEnabled="store.flatdeviceInfo.LocalizedCoverState !== undefined"
      :Name="$t('components.flat.cover_state')"
      :Value="store.flatdeviceInfo.LocalizedCoverState"
    />
    <StatusString
      :compact="compact"
      :isEnabled="store.flatdeviceInfo.LocalizedLightOnState !== undefined"
      :Name="$t('components.flat.light_state')"
      :Value="store.flatdeviceInfo.LocalizedLightOnState"
    />
    <StatusString
      :compact="compact"
      :isEnabled="
        store.flatdeviceInfo.Brightness !== undefined && !isNaN(store.flatdeviceInfo.Brightness)
      "
      :Name="$t('components.flat.brightness')"
      :Value="store.flatdeviceInfo.Brightness"
    />
    <StatusString
      v-if="isWandererCover"
      :compact="compact"
      :isEnabled="typeof currentPosition === 'number' && !isNaN(currentPosition)"
      :Name="$t('components.flat.settings.currentPosition')"
      :Value="
        typeof currentPosition === 'number' && !isNaN(currentPosition)
          ? `${currentPosition.toFixed(1)}°`
          : ''
      "
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import StatusString from '@/components/helpers/StatusString.vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';

const store = apiStore();

// Dense page layout: two quiet value columns (device name spans the full row).
const { compact } = defineProps({
  compact: {
    type: Boolean,
    default: false,
  },
});
const currentPosition = ref(undefined);

const isWandererCover = computed(() => {
  return store.flatdeviceInfo.Name && store.flatdeviceInfo.Name.includes('Wanderer');
});

async function loadCurrentPosition() {
  try {
    const response = await apiService.flatdeviceGetCurrentPosition();
    if (response.Success) {
      currentPosition.value = response.Response;
    }
  } catch (error) {
    console.error('Error loading current position:', error);
  }
}

onMounted(() => {
  if (isWandererCover.value) {
    loadCurrentPosition();
  }
});

// Watch for cover state changes and reload current position
watch(
  () => store.flatdeviceInfo.CoverState,
  () => {
    if (isWandererCover.value) {
      loadCurrentPosition();
    }
  }
);
</script>
