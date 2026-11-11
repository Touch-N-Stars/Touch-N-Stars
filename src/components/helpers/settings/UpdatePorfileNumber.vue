<template>
  <div class="flex flex-col md:flex-row w-full md:items-center">
    <NumberInputPicker
      v-model="value"
      :label="$t(`${labelKey}`)"
      :labelKey="labelKey"
      :helpMessage="helpKey ? $t(`${helpKey}`) : ''"
      :min="min"
      :max="max"
      :step="step"
      :decimalPlaces="decimalPlaces"
      :placeholder="placeholder"
      :useDefaultSentinel="modelDefaultValue !== null"
      wrapperClass="flex-1"
      @change="updateSetting"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  helpKey: {
    type: String,
    default: '',
  },
  settingKey: {
    type: String,
    required: true,
  },
  modelValue: {
    type: Number,
    required: true,
  },
  // Fallback for settings that use -1 as a "use the inherited default" sentinel (plate-solve Gain
  // falls back to the camera's, a filter's AutoFocus exposure time to the focuser's). Leave it unset
  // for every other setting, where -1 is an ordinary value and must not be substituted.
  modelDefaultValue: {
    type: Number,
    default: null,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: 100000,
  },
  step: {
    type: Number,
    default: 1,
  },
  placeholder: {
    type: String,
    default: '100',
  },
});

const isFocused = ref(false);

const decimalPlaces = computed(() => {
  const stepStr = String(props.step);
  return stepStr.includes('.') ? stepStr.split('.')[1].length : 0;
});

// Only honour the -1 sentinel when the caller actually supplied something to fall back to.
function resolveValue(v) {
  return v === -1 && props.modelDefaultValue !== null ? props.modelDefaultValue : v;
}

// The caller passes the profile value in, because some show it converted (rotator overshoot)
// or read it from a filter entry. Following it pauses while the field is focused, so a remote
// change does not overwrite what the user is typing.
const { value, save } = useProfileSetting(() => props.settingKey, {
  source: () => resolveValue(props.modelValue),
  toProfile: (v) => String(v).replace(',', '.'),
  hold: () => isFocused.value,
});

function updateSetting() {
  save();
}
</script>
