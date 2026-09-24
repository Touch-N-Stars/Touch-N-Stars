<template>
  <div>
    <!-- Label left / control right, matching HfToggleRow so a card of mixed toggles and
         numbers reads as one column of rows. -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 flex-col">
        <div class="flex items-center gap-1">
          <label :for="inputId" class="text-sm font-medium text-gray-300">{{ label }}</label>
          <InfoModal v-if="help" :title="label" :message="help" size="w-4 h-4" />
        </div>
        <span v-if="auto && isAuto" class="text-xs text-gray-500">{{ autoActiveLabel }}</span>
        <button
          v-else-if="auto"
          type="button"
          class="self-start text-xs text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
          @click="setAuto"
        >
          {{ autoResetLabel }}
        </button>
        <span v-else-if="hint" class="text-xs text-gray-500">{{ hint }}</span>
      </div>
      <!-- NumberInputPicker flashes its own green glow on a committed edit, so only the
           failure case needs decorating here. -->
      <div
        class="w-40 shrink-0 rounded-control md:w-56"
        :class="status === 'error' ? 'glow-red' : ''"
      >
        <NumberInputPicker
          :model-value="Number(modelValue)"
          :labelKey="labelKey || label"
          :min="min"
          :max="max"
          :step="step"
          :decimalPlaces="decimals"
          :inputId="inputId"
          :useDefaultSentinel="auto"
          wrapperClass="w-full"
          @update:modelValue="onModelValue"
          @change="emit('change', normalize($event))"
        />
      </div>
    </div>
    <p v-if="warning" class="mt-1 text-xs text-amber-400">{{ warning }}</p>
    <p v-if="error" class="mt-1 text-xs text-red-400">{{ error }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import InfoModal from '@/components/helpers/infoModal.vue';

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  label: { type: String, required: true },
  // Title for the touch number pad; falls back to the visible label.
  labelKey: { type: String, default: '' },
  help: { type: String, default: '' },
  // Short note under the label, e.g. a unit or the allowed range
  hint: { type: String, default: '' },
  // Amber note under the row, e.g. "differs from the focuser driver"
  warning: { type: String, default: '' },
  // true when -1 means "inherit the default" rather than the number -1; clearing the box then
  // sends -1 and the field renders blank. Requires min: -1.
  auto: { type: Boolean, default: false },
  // Smallest real value an `auto` field may hold. Stepping up from the blank sentinel starts at
  // min (-1), so without this a 0.5-step exposure field lands on -0.5. Defaults to one step.
  floor: { type: Number, default: null },
  // Shown under the label while an `auto` field is on its default.
  autoActiveLabel: { type: String, default: 'Automatic' },
  // Clickable label that puts an overridden `auto` field back on its default.
  autoResetLabel: { type: String, default: 'Use automatic' },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  step: { type: Number, default: 1 },
  decimals: { type: Number, default: null },
  inputId: { type: String, default: 'hf-number' },
  // '' | 'saving' | 'saved' | 'error'
  status: { type: String, default: '' },
  error: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue', 'change']);

const isAuto = computed(() => Number(props.modelValue) === -1);

function setAuto() {
  emit('update:modelValue', -1);
  emit('change', -1);
}

// Clearing the box emits update:modelValue(-1) WITHOUT a change event, so it would never save.
// Turn that one case into a committed edit; every other keystroke already comes with `change`.
function onModelValue(value) {
  const next = normalize(value);
  emit('update:modelValue', next);
  if (props.auto && next === -1) emit('change', next);
}

// -1 stays the "inherit" sentinel; anything below the first real value is a step off that
// sentinel and snaps up to it, so the field can never sit on a negative in-between value.
function normalize(value) {
  if (!props.auto || value === null || value === undefined) return value;
  if (value <= -1) return -1;
  const floor = props.floor ?? props.step;
  return value < floor ? floor : value;
}
</script>
