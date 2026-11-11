<template>
  <div class="guider-status">
    <div class="flex items-center gap-3">
      <div class="status-indicator" :class="statusClasses">
        <div class="status-dot"></div>
      </div>
      <div>
        <p class="font-semibold text-sm">{{ $t('components.guider.statusLabel') }}</p>
        <p class="text-lg font-bold" :class="statusTextClasses">{{ statusText }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useI18n } from 'vue-i18n';

const store = apiStore();
const { t: $t } = useI18n();

const statusText = computed(() => {
  const state = store.guiderInfo?.State;
  if (!state) return $t('components.guider.status.unknown');

  switch (state) {
    case 'Looping':
      return $t('components.guider.status.looping');
    case 'LostLock':
      return $t('components.guider.status.lostLock');
    case 'Guiding':
      return $t('components.guider.status.guiding');
    case 'Stopped':
      return $t('components.guider.status.stopped');
    case 'Calibrating':
      return $t('components.guider.status.calibrating');
    default:
      return state;
  }
});

const statusClasses = computed(() => {
  const state = store.guiderInfo?.State;

  return {
    'status-guiding': state === 'Guiding',
    'status-calibrating': state === 'Calibrating',
    'status-looping': state === 'Looping',
    'status-error': state === 'LostLock',
    'status-stopped': state === 'Stopped',
    'status-unknown': !state,
  };
});

const statusTextClasses = computed(() => {
  const state = store.guiderInfo?.State;

  return {
    'text-status-ok': state === 'Guiding',
    'text-accent': state === 'Calibrating',
    'text-status-warn': state === 'Looping',
    'text-status-danger': state === 'LostLock',
    'text-content-muted': state === 'Stopped',
    'text-content-faint': !state,
  };
});
</script>

<style scoped>
@reference '../../assets/tailwind.css';
.guider-status {
  @apply tns-card;
}

.status-indicator {
  @apply relative w-4 h-4 rounded-full flex items-center justify-center;
}

.status-dot {
  @apply w-3 h-3 rounded-full animate-pulse;
}

.status-guiding .status-dot {
  @apply bg-status-ok shadow-lg shadow-status-ok/50;
}

.status-calibrating .status-dot {
  @apply bg-accent shadow-lg shadow-accent/50;
}

.status-looping .status-dot {
  @apply bg-status-warn shadow-lg shadow-status-warn/50;
}

.status-error .status-dot {
  @apply bg-status-danger shadow-lg shadow-status-danger/50;
}

.status-stopped .status-dot {
  @apply bg-content-muted shadow-lg shadow-content-muted/50;
  animation: none;
}

.status-unknown .status-dot {
  @apply bg-content-faint shadow-lg shadow-content-faint/50;
  animation: none;
}
</style>
