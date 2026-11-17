<script setup>
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { displayExposure, exposureSeconds, exposureSupported } from '../utils/exposureUnits';
const props = defineProps({
  control: { type: Object, required: true },
  modelValue: { type: [Number, String], default: null },
  invalid: Boolean,
});
const emit = defineEmits(['update:modelValue']);
const { t, locale } = useI18n();
const id = useId();
const isExposure = computed(() => props.control.id === 'exposure');
const exposureUnit = ref('ms');
const displayValue = computed(() =>
  isExposure.value ? displayExposure(props.modelValue, exposureUnit.value) : props.modelValue
);
const displayBound = (value) =>
  value == null ? undefined : isExposure.value ? displayExposure(value, exposureUnit.value) : value;
const shortExposures = [0.0001, 0.0002, 0.001, 0.005, 0.02];
const milliseconds = (seconds) =>
  new Intl.NumberFormat(locale.value, { maximumFractionDigits: 6 }).format(
    displayExposure(seconds, 'ms')
  );
function update(event) {
  const value = event.target.value;
  if (isExposure.value) {
    emit('update:modelValue', exposureSeconds(value, exposureUnit.value));
    return;
  }
  emit(
    'update:modelValue',
    props.control.type === 'enum' || props.control.options?.length
      ? value
      : value === ''
        ? null
        : Number(value)
  );
}
</script>
<template>
  <div class="camera-field" :class="{ 'exposure-field': isExposure }">
    <label :for="id"
      >{{ t(`luckycapture.${control.id}`)
      }}<span v-if="isExposure || control.unit">
        ({{ isExposure ? exposureUnit : control.unit }})</span
      ></label
    >
    <output v-if="control.readOnly" :id="id" :aria-describedby="`${id}-help`">{{
      control.currentValue
    }}</output>
    <select
      v-else-if="control.type === 'enum' || control.options?.length"
      :id="id"
      :value="modelValue"
      :aria-describedby="`${id}-help`"
      @change="update"
    >
      <option v-for="option in control.options" :key="option" :value="option">{{ option }}</option>
    </select>
    <div v-else class="number-control" :class="{ 'exposure-control': isExposure }">
      <input
        :id="id"
        :value="displayValue"
        :data-control="control.id"
        :aria-invalid="invalid"
        :aria-describedby="`${id}-help`"
        type="number"
        :inputmode="control.id === 'exposure' ? 'decimal' : 'numeric'"
        :required="control.id === 'exposure'"
        :min="displayBound(control.min)"
        :max="displayBound(control.max)"
        :step="isExposure ? 'any' : control.step || 'any'"
        @input="update"
      />
      <select v-if="isExposure" v-model="exposureUnit" :aria-label="t('luckycapture.exposureUnit')">
        <option value="ms">ms</option>
        <option value="s">s</option>
      </select>
    </div>
    <div
      v-if="isExposure && !control.readOnly"
      class="exposure-presets"
      role="group"
      :aria-label="t('luckycapture.shortExposures')"
    >
      <button
        v-for="seconds in shortExposures"
        :key="seconds"
        type="button"
        :disabled="!exposureSupported(seconds, control)"
        :aria-pressed="Number(modelValue) === seconds"
        @click="emit('update:modelValue', seconds)"
      >
        {{ milliseconds(seconds) }} ms
      </button>
    </div>
    <p v-if="isExposure && control.min != null" class="field-help">
      {{ t('luckycapture.exposureMinimum', { value: milliseconds(control.min) }) }}
    </p>
    <p :id="`${id}-help`" class="field-help">{{ t(`luckycapture.help${control.id}`) }}</p>
  </div>
</template>
<style scoped>
.camera-field {
  min-width: 0;
}
.exposure-field {
  grid-column: 1 / -1;
}
.exposure-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 76px;
  gap: 6px;
}
.exposure-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}
.exposure-presets button {
  min-height: 44px;
  padding: 5px 7px;
  border: 1px solid var(--lc-border, #69758a);
  border-radius: 8px;
  background: var(--color-surface-1, #111827);
  color: inherit;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.exposure-presets button[aria-pressed='true'] {
  border-color: #22d3ee;
  background: #123047;
}
.exposure-presets button:disabled {
  opacity: 0.4;
  cursor: default;
}
.exposure-presets button:focus-visible {
  outline: 3px solid #22d3ee;
  outline-offset: 2px;
}
label {
  display: block;
  font-size: 0.9rem;
  line-height: 1.45;
}
input,
select,
output {
  box-sizing: border-box;
  display: block;
  width: 100%;
  min-height: 48px;
  margin-top: 0.25rem;
  border: 1px solid var(--lc-border, #69758a);
  border-radius: var(--radius-control, 12px);
  padding: 0.6rem 0.75rem;
  font: inherit;
  font-size: 1rem;
  background: var(--color-surface-1, #111827);
  color: inherit;
}
input:focus-visible,
select:focus-visible {
  outline: 3px solid var(--color-accent, #22d3ee);
  outline-offset: 3px;
}
input[aria-invalid='true'] {
  border-color: #ff978a;
}
.field-help {
  color: var(--lc-muted, #b8c5d8);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0.35rem 0 0;
  overflow-wrap: anywhere;
}
select option {
  background: #111827;
  color: #e2e8f0;
}
</style>
