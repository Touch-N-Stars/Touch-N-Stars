<template>
  <div>
    <div
      class="flex flex-row items-center justify-between w-full border border-line-strong p-2 rounded-lg"
    >
      <label class="text-content-muted">
        {{ $t('components.settings.devChannel.title') }}
      </label>
      <div>
        <toggleButton
          @update:statusValue="toggleDevChannel"
          :statusValue="settingsStore.useDevUpdateChannel || false"
        />
      </div>
    </div>
    <p class="text-xs text-content-faint mt-1">
      {{ $t('components.settings.devChannel.description') }}
    </p>
  </div>
</template>
<script setup>
import { useSettingsStore } from '@/store/settingsStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { getPreferredUpdateChannel } from '@/services/updateService';

const settingsStore = useSettingsStore();

async function toggleDevChannel(value) {
  settingsStore.useDevUpdateChannel = value;

  // Trigger update check in App.vue via custom event
  // Pass reset flag to clear dismissed version when switching channels
  console.log('[Dev Settings] Update channel switched, triggering update check...');
  window.dispatchEvent(
    new CustomEvent('check-app-update', {
      detail: {
        resetDismissed: true,
        syncChannel: true,
        channel: getPreferredUpdateChannel(),
      },
    })
  );
}
</script>
