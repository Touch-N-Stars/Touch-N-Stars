<template>
  <div>
    <div class="mb-2 flex items-center gap-1">
      <label class="block text-sm font-medium text-gray-300">{{ label }}</label>
      <InfoModal v-if="help" :title="label" :message="help" size="w-4 h-4" />
    </div>
    <input
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      type="text"
      class="tns-input py-2"
      :class="status === 'saved' ? 'glow-green' : status === 'error' ? 'glow-red' : ''"
      @change="onChange"
    />
    <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import InfoModal from '@/components/helpers/infoModal.vue';

defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, required: true },
  help: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
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
