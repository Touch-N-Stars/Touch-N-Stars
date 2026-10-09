<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="value in modelValue"
        :key="value"
        class="inline-flex min-h-10 items-center gap-1 rounded-chip border border-line-strong bg-surface-2 pl-3 pr-1 text-sm tabular-nums text-content"
      >
        {{ format(value) }}
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-full text-content-muted hover:bg-surface-3"
          :aria-label="removeLabel(value)"
          :title="removeLabel(value)"
          :disabled="modelValue.length <= 1"
          @click="remove(value)"
        >
          <XMarkIcon class="h-4 w-4" />
        </button>
      </span>
    </div>
    <div class="flex items-center gap-2">
      <input
        v-model="draft"
        type="text"
        :inputmode="integer ? 'numeric' : 'decimal'"
        class="tns-input min-w-0 flex-1 tabular-nums"
        :placeholder="placeholder"
        :aria-label="placeholder"
        @keyup.enter="add"
      />
      <button
        type="button"
        class="tns-btn-secondary w-auto! shrink-0 px-4!"
        :disabled="!draft.trim() || modelValue.length >= maxCount"
        @click="add"
      >
        <PlusIcon class="h-4 w-4" />
        {{ addLabel }}
      </button>
    </div>
    <p v-if="error" class="text-xs text-status-danger">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { PlusIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { addSorted, parseNumberInput, trimmed } from '@/utils/nativeGuiderCoach';

const props = defineProps({
  modelValue: { type: Array, required: true },
  unit: { type: String, default: '' },
  integer: { type: Boolean, default: false },
  min: { type: Number, default: -Infinity },
  max: { type: Number, default: Infinity },
  maxCount: { type: Number, default: 12 },
  placeholder: { type: String, default: '' },
  addLabel: { type: String, default: '+' },
  invalidText: { type: String, default: '' },
  tooManyText: { type: String, default: '' },
  removeLabel: { type: Function, default: (value) => String(value) },
});
const emit = defineEmits(['update:modelValue']);

const draft = ref('');
const error = ref('');

function format(value) {
  const text = props.integer ? String(value) : trimmed(value, 2);
  return props.unit ? `${text} ${props.unit}` : text;
}

function add() {
  if (props.modelValue.length >= props.maxCount) {
    error.value = props.tooManyText;
    return;
  }
  const value = parseNumberInput(draft.value, {
    integer: props.integer,
    min: props.min,
    max: props.max,
  });
  if (value === null) {
    error.value = props.invalidText;
    return;
  }
  error.value = '';
  draft.value = '';
  emit('update:modelValue', addSorted(props.modelValue, value));
}

function remove(value) {
  if (props.modelValue.length <= 1) return;
  emit(
    'update:modelValue',
    props.modelValue.filter((v) => v !== value)
  );
}
</script>
