<template>
  <div class="flex items-center">
    <button
      @click="updateToggled"
      :disabled="disabled"
      :class="[
        statusValue ? 'bg-accent/20 border-accent/60' : 'bg-surface-3 border-line-strong',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-content-faint active:scale-95',
        'relative inline-flex h-6 w-12 items-center rounded-full transition-all duration-300 ease-out border shadow-inner focus:outline-none focus:ring-2 focus:ring-accent/40',
      ]"
      type="button"
      :aria-pressed="statusValue?.toString() || 'false'"
    >
      <!-- What a screen reader announces: the caller's label, otherwise a generic "On/Off" -->
      <span class="sr-only">{{ label || t('common.onOff') }}</span>

      <!-- Toggle Knopf -->
      <span
        :class="[
          statusValue
            ? 'translate-x-6 bg-gradient-to-br from-accent to-accent-action'
            : 'translate-x-1 bg-gradient-to-br from-content to-content-faint',
          'inline-block h-4 w-4 transform rounded-full shadow-sm transition-all duration-300 ease-out',
        ]"
      />
    </button>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// Props definition
const props = defineProps({
  // Name of the setting the switch turns on and off, for screen readers
  label: {
    type: String,
    default: '',
  },
  statusValue: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

// Emits for parent communication
const emits = defineEmits(['update:statusValue']);

// Toggle the current value
function updateToggled() {
  if (!props.disabled) {
    emits('update:statusValue', !props.statusValue);
  }
}
</script>
