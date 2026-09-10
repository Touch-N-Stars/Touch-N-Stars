<template>
  <div class="space-y-6">
    <!-- Auto-lock the sequence controls on start -->
    <div class="flex flex-col gap-2 sm:gap-3">
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.sequenceAutoLock.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-gray-300 text-sm mr-4">
          {{ $t('components.settings.sequenceAutoLock.description') }}
        </p>
        <ToggleButton
          :statusValue="sequenceStore.autoLockControlsOnStart"
          @update:statusValue="sequenceStore.setAutoLockControlsOnStart($event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { useSequenceStore } from '@/store/sequenceStore';
import ToggleButton from '@/components/helpers/toggleButton.vue';

const sequenceStore = useSequenceStore();
</script>
