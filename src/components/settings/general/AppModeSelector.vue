<template>
  <div class="flex flex-col gap-2">
    <div
      class="flex p-1 gap-1 rounded-control border border-line bg-surface-2"
      role="radiogroup"
      :aria-label="$t('components.settings.appMode.title')"
    >
      <button
        v-for="mode in APP_MODES"
        :key="mode"
        type="button"
        role="radio"
        :aria-checked="activeMode === mode"
        :data-testid="`app-mode-${mode}`"
        class="flex-1 min-h-touch rounded-chip text-sm font-semibold transition-colors"
        :class="
          activeMode === mode
            ? 'bg-accent-action text-white'
            : 'text-content-muted hover:bg-surface-3'
        "
        @click="settingsStore.setAppMode(mode)"
      >
        {{ $t(`components.settings.appMode.mode.${mode}`) }}
      </button>
    </div>
    <p class="text-sm text-content-muted">
      {{ $t(`components.settings.appMode.hint.${activeMode}`) }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '@/store/settingsStore';
import { APP_MODES, normalizeAppMode } from '@/utils/appMode';

const settingsStore = useSettingsStore();
const activeMode = computed(() => normalizeAppMode(settingsStore.appMode));
</script>
