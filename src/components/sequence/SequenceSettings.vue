<template>
  <div class="space-y-6">
    <!-- Layout of the sequence tab: simple cards or the expert tree -->
    <div class="flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.sequence.simple.viewMode') }}
      </h3>
      <p class="text-content-muted text-sm">
        {{ $t('components.sequence.simple.viewModeHint') }}
      </p>
      <div
        class="flex p-1 gap-1 rounded-control border border-line bg-surface-2"
        role="radiogroup"
        :aria-label="$t('components.sequence.simple.viewMode')"
      >
        <button
          v-for="mode in VIEW_MODES"
          :key="mode"
          type="button"
          role="radio"
          :aria-checked="viewMode === mode"
          class="flex-1 min-h-touch rounded-chip text-sm font-semibold transition-colors"
          :class="
            viewMode === mode
              ? 'bg-accent-action text-white'
              : 'text-content-muted hover:bg-surface-3'
          "
          @click="settingsStore.setSequenceViewMode(mode)"
        >
          {{ $t(`components.sequence.simple.mode.${mode}`) }}
        </button>
      </div>
    </div>

    <!-- Auto-lock the sequence controls on start -->
    <div class="flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.sequenceAutoLock.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-content-muted text-sm mr-4">
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
import { computed } from 'vue';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSettingsStore } from '@/store/settingsStore';
import ToggleButton from '@/components/helpers/toggleButton.vue';

const VIEW_MODES = ['simple', 'full'];

const sequenceStore = useSequenceStore();
const settingsStore = useSettingsStore();
// Older persisted settings have no `sequence` block yet; they get the expert view.
const viewMode = computed(() =>
  settingsStore.sequence?.viewMode === 'simple' ? 'simple' : 'full'
);
</script>
