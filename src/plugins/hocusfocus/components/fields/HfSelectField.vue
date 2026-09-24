<template>
  <div>
    <!-- Label left / control right, matching HfToggleRow and HfNumberField. -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-1 min-w-0">
        <label class="text-sm font-medium text-gray-300">{{ label }}</label>
        <InfoModal v-if="help" :title="label" :message="help" size="w-4 h-4" />
      </div>
      <select
        :value="modelValue"
        :disabled="disabled"
        class="tns-select w-40 shrink-0 py-2 md:w-56"
        :class="status === 'saved' ? 'glow-green' : status === 'error' ? 'glow-red' : ''"
        @change="onChange"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import InfoModal from '@/components/helpers/infoModal.vue';

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  help: { type: String, default: '' },
  // [{ value, label }] — value is the backend enum name, label the display text
  options: { type: Array, required: true },
  disabled: { type: Boolean, default: false },
  // '' | 'saving' | 'saved' | 'error'
  status: { type: String, default: '' },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

function onChange(event) {
  const value = event.target.value;
  emit('update:modelValue', value);
  emit('change', value);
}
</script>
