<template>
  <div
    class="flex flex-col gap-2 border border-line-strong p-1 md:p-2 rounded-control"
    data-testid="auto-cool-on-connect"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-1">
        <span class="text-xs md:text-sm font-medium text-content">
          {{ $t('components.camera.autoCoolOnConnect') }}
        </span>
        <InfoModal
          :title="$t('components.camera.autoCoolOnConnect')"
          :message="$t('components.camera.autoCoolOnConnectInfo')"
          size="w-4 h-4"
        />
      </div>
      <toggleButton
        @click="toggleAutoCool"
        :status-value="Boolean(config?.cool)"
        :disabled="!config"
        class="h-7 md:h-8"
      />
    </div>
    <div
      v-if="config?.cool && store.cameraInfo.HasDewHeater"
      class="flex items-center justify-between gap-3"
    >
      <span class="text-xs md:text-sm font-medium text-content">
        {{ $t('components.camera.autoDewHeaterOnConnect') }}
      </span>
      <toggleButton
        @click="toggleAutoDewHeater"
        :status-value="config.dewHeater"
        class="h-7 md:h-8"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';

const store = apiStore();
const cameraStore = useCameraStore();
const config = computed(() => cameraStore.autoStartConfig);

// Reachability too: a teardown clears the choice while the profile id can stay the same.
watch(
  [() => store.profileInfo?.Id, () => store.isBackendReachable],
  () => {
    if (store.isBackendReachable) cameraStore.loadAutoStartConfig();
  },
  { immediate: true }
);

function toggleAutoCool() {
  cameraStore.saveAutoStartConfig({ cool: !config.value?.cool });
}

function toggleAutoDewHeater() {
  cameraStore.saveAutoStartConfig({ dewHeater: !config.value?.dewHeater });
}
</script>
