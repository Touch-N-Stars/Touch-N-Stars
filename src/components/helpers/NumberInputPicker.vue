<template>
  <div
    :class="[
      labelPosition === 'top'
        ? ''
        : 'flex flex-row w-full items-center min-w-0 @max-[18rem]:flex-col @max-[18rem]:items-stretch',
      wrapperClass,
    ]"
  >
    <!-- The @max-[18rem]: rules only fire inside an @container ancestor (sequence items), so
         every other screen keeps the single-line layout unchanged. -->
    <span v-if="label" class="flex items-center gap-1 mr-3 mb-1 @max-[18rem]:mr-0">
      <label
        :for="inputId"
        :class="
          labelPosition === 'top'
            ? 'block text-sm font-medium text-content mb-2'
            : 'text-xs md:text-sm text-content'
        "
      >
        {{ label }}
      </label>
      <InfoModal
        v-if="helpMessage"
        :title="helpTitle || label"
        :message="helpMessage"
        size="w-4 h-4"
      />
    </span>
    <div
      :class="[
        'flex items-stretch overflow-hidden',
        labelPosition === 'top' || wrapperClass === 'w-full'
          ? 'w-full'
          : 'ml-auto w-36 md:w-40 @max-[18rem]:ml-0 @max-[18rem]:w-full',
      ]"
    >
      <button
        type="button"
        class="flex items-center justify-center shrink-0 w-6 rounded-l-lg bg-surface-3 hover:bg-surface-2 active:bg-surface-1 text-content text-sm font-bold border border-line-strong select-none"
        @click="stepDown"
      >
        &minus;
      </button>
      <input
        :id="inputId"
        :value="formattedValue"
        type="number"
        :class="[
          'tns-input rounded-none border-x-0 text-center min-w-12! px-1! flex-1',
          statusClass,
        ]"
        :placeholder="isDefaultValue ? defaultPlaceholder : placeholder"
        :step="step"
        :min="min"
        :max="max"
        :readonly="settingsStore.touchOptimized"
        @focus="onFocus"
        @blur="emit('blur')"
        @input="onDirectInput"
      />
      <button
        type="button"
        class="flex items-center justify-center shrink-0 w-6 rounded-r-lg bg-surface-3 hover:bg-surface-2 active:bg-surface-1 text-content text-sm font-bold border border-line-strong select-none"
        @click="stepUp"
      >
        +
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useNumberPicker } from '@/composables/useNumberPicker';
import { useSettingsStore } from '@/store/settingsStore';
import InfoModal from '@/components/helpers/infoModal.vue';

const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  label: {
    type: String,
    required: false,
    default: '',
  },
  labelKey: {
    type: String,
    required: true,
  },
  helpTitle: {
    type: String,
    required: false,
    default: '',
  },
  helpMessage: {
    type: String,
    required: false,
    default: '',
  },
  min: {
    type: Number,
    required: true,
  },
  max: {
    type: Number,
    required: true,
  },
  step: {
    type: Number,
    required: true,
  },
  decimalPlaces: {
    type: Number,
    required: false,
    default: null,
  },
  placeholder: {
    type: String,
    required: false,
    default: '',
  },
  wrapperClass: {
    type: String,
    required: false,
    default: '',
  },
  inputId: {
    type: String,
    required: false,
    default: 'number-input',
  },
  defaultValue: {
    type: Number,
    required: false,
    default: null,
  },
  // Whether -1 means "use the inherited default" rather than the number -1. Leave unset to derive it
  // from `min`: a control whose range reaches below -1 treats -1 as an ordinary value (an altitude
  // offset of -1 deg, a cooler target of -1 C), while min === -1 marks it as the sentinel and min >= 0
  // puts -1 out of range entirely. Pass a Boolean to override.
  useDefaultSentinel: {
    type: Boolean,
    required: false,
    default: null,
  },
  labelPosition: {
    type: String,
    required: false,
    default: 'left',
    validator: (value) => ['left', 'top'].includes(value),
  },
});

const emit = defineEmits(['update:modelValue', 'change', 'focus', 'blur']);

const { t } = useI18n();
const { openPicker: openNumberPicker } = useNumberPicker();
const settingsStore = useSettingsStore();
const statusClass = ref('');

function emitWithGlow(value) {
  emit('update:modelValue', value);
  emit('change', value);
  statusClass.value = 'glow-green';
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
}

const sentinelActive = computed(() =>
  props.useDefaultSentinel !== null && props.useDefaultSentinel !== undefined
    ? props.useDefaultSentinel
    : props.min >= -1
);

const isDefaultValue = computed(() => {
  if (props.modelValue === null || props.modelValue === undefined) {
    return true;
  }
  return sentinelActive.value && props.modelValue === -1;
});

// The value that applies while the field is at its default, or null when it is not known.
// A defaultValue equal to the sentinel itself says nothing about the effective value.
const knownDefault = computed(() => {
  const value = props.defaultValue;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  if (sentinelActive.value && Number(value) === -1) return null;
  return Number(value);
});

// At the default the field stays empty and the greyed placeholder names the effective value,
// so it cannot be mistaken for a value the user set.
const defaultPlaceholder = computed(() => {
  if (knownDefault.value === null) return t('components.helpers.numberInput.default');
  const value =
    props.decimalPlaces !== null
      ? knownDefault.value.toFixed(props.decimalPlaces)
      : String(knownDefault.value);
  return t('components.helpers.numberInput.defaultWithValue', { value });
});

const formattedValue = computed(() => {
  if (isDefaultValue.value) {
    return '';
  }
  if (props.decimalPlaces !== null) {
    return Number(props.modelValue).toFixed(props.decimalPlaces);
  }
  return props.modelValue;
});

function onFocus() {
  emit('focus');
  openPicker();
}

function openPicker() {
  // If touch optimization is disabled, don't open picker
  if (!settingsStore.touchOptimized) {
    return;
  }

  let valueToPass;
  if (isDefaultValue.value) {
    valueToPass = knownDefault.value !== null ? knownDefault.value : props.min;
  } else {
    valueToPass = props.modelValue;
  }

  openNumberPicker(
    props.labelKey,
    props.min,
    props.max,
    props.step,
    valueToPass,
    (newValue) => {
      emitWithGlow(newValue);
    },
    props.decimalPlaces
  );
}

function currentValue() {
  if (isDefaultValue.value) {
    return knownDefault.value !== null ? knownDefault.value : props.min;
  }
  const val = Number(props.modelValue);
  return isNaN(val) ? 0 : val;
}

function stepDown() {
  const newValue = Math.max(currentValue() - props.step, props.min);
  emitWithGlow(parseFloat(newValue.toFixed(10)));
}

function stepUp() {
  const newValue = Math.min(currentValue() + props.step, props.max);
  emitWithGlow(parseFloat(newValue.toFixed(10)));
}

function onDirectInput(event) {
  const value = event.target.value;
  if (value === '' || value === null) {
    // Clearing the field means "fall back to the default" -- only meaningful where -1 is the
    // sentinel. Otherwise there is nothing to fall back to, so keep the last value.
    if (sentinelActive.value) {
      emit('update:modelValue', -1);
    }
  } else {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      const clamped = Math.min(Math.max(numValue, props.min), props.max);
      emitWithGlow(clamped);
    }
  }
}
</script>

<style scoped>
input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
