<template>
  <div class="tns-card relative overflow-hidden flex flex-row items-center justify-between gap-3">
    <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
      <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
    </div>
    <div class="relative z-10 min-w-0">
      <h3 class="tns-section-title mb-1">{{ $t('plugins.pins.sambaTitle') }}</h3>
      <p class="text-content-muted text-sm">{{ $t('plugins.pins.sambaDescription') }}</p>
    </div>
    <div class="relative z-10 shrink-0">
      <toggleButton
        :status-value="enabled"
        @update:status-value="$emit('toggle', $event)"
        :disabled="disabled"
      />
    </div>
  </div>
</template>

<script setup>
import toggleButton from '@/components/helpers/toggleButton.vue';

defineProps({
  enabled: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['toggle']);
</script>
