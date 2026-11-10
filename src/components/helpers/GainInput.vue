<template>
  <!--
    Cameras that expose a discrete value list (DSLRs report their ISO values here, as do cameras
    with a fixed gain table) must be picked from that list; everything else keeps the free
    numeric input driven by GainMin/GainMax.
  -->
  <div v-if="hasGainList" class="flex items-center gap-3">
    <label class="tns-label shrink-0">{{ label }}</label>
    <select
      class="tns-select-compact ml-auto w-36 md:w-40"
      :value="modelValue"
      @change="emit('change', Number($event.target.value))"
    >
      <option v-if="allowDefault" :value="-1">
        {{ $t('components.camera.gainDefault') }}
      </option>
      <!-- Keep a value that came from a different camera visible instead of silently showing
           someone else's gain. -->
      <option v-if="isUnlistedValue" :value="modelValue">{{ modelValue }}</option>
      <option v-for="value in gainList" :key="value" :value="value">{{ value }}</option>
    </select>
  </div>
  <NumberInputPicker
    v-else
    :modelValue="modelValue"
    :label="label"
    :labelKey="labelKey"
    :min="min"
    :max="cameraGainMax"
    :step="1"
    :decimalPlaces="0"
    @change="emit('change', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  labelKey: { type: String, required: true },
  min: { type: Number, required: true },
  max: { type: Number, required: true },
});

const emit = defineEmits(['change']);

const { t } = useI18n();
const store = apiStore();

// `camera.gain_iso` carries a trailing colon for the camera page layout; sequence editor labels
// have none.
const label = computed(() => t('components.camera.gain_iso').replace(/:\s*$/, ''));

const gainList = computed(() => store.cameraInfo?.Gains ?? []);
const hasGainList = computed(() => gainList.value.length > 0);

// A negative minimum marks the item as accepting -1 for "whatever the camera is set to".
const allowDefault = computed(() => props.min < 0);

const isUnlistedValue = computed(
  () =>
    !gainList.value.includes(props.modelValue) && !(allowDefault.value && props.modelValue === -1)
);

const cameraGainMax = computed(() => store.cameraInfo?.GainMax || props.max);
</script>
