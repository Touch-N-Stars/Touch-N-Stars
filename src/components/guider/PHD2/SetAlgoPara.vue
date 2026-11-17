<template>
  <template v-for="field in visibleFields" :key="field.name">
    <NumberInputPicker
      v-model="values[field.name]"
      :label="$t(`components.guider.phd2.${axis}.${field.labelKey}`)"
      :labelKey="`components.guider.phd2.${axis}.${field.labelKey}`"
      :help-message="$t(`components.guider.phd2.help.algo.${field.name}`)"
      :min="0"
      :max="field.max"
      :step="field.step"
      :decimalPlaces="field.decimalPlaces"
      :inputId="`${field.inputId}-${axis}`"
      @change="debouncedSetters[field.name]()"
    />
  </template>
</template>

<script setup>
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useGuiderStore } from '@/store/guiderStore';
import { computed, onMounted, reactive, watch } from 'vue';

const props = defineProps({
  axis: {
    type: String,
    required: true,
    validator: (value) => ['ra', 'dec'].includes(value),
  },
});

const guiderStore = useGuiderStore();

// How a PHD2 value maps to the field:
// - 'raw':     shown as sent, rounded to 2 decimals
// - 'percent': PHD2 sends 0..1, the field shows 0..100
// - 'seconds': worm period, a whole number of seconds
const FIELDS = [
  {
    name: 'minMove',
    labelKey: 'MinMove',
    inputId: 'min-move',
    unit: 'raw',
    max: 1,
    step: 0.01,
    decimalPlaces: 2,
  },
  {
    name: 'maxMove',
    labelKey: 'MaxMove',
    inputId: 'max-move',
    unit: 'raw',
    max: 10,
    step: 0.01,
    decimalPlaces: 2,
  },
  {
    name: 'aggression',
    labelKey: 'aggression',
    inputId: 'aggression',
    unit: 'percent',
    max: 100,
    step: 1,
    decimalPlaces: 0,
  },
  {
    name: 'hysteresis',
    labelKey: 'hysteresis',
    inputId: 'hysteresis',
    unit: 'percent',
    max: 100,
    step: 1,
    decimalPlaces: 0,
  },
  {
    name: 'predictiveWeight',
    labelKey: 'predictive_weight',
    inputId: 'predictive-weight',
    unit: 'percent',
    max: 100,
    step: 1,
    decimalPlaces: 0,
  },
  {
    name: 'reactiveWeight',
    labelKey: 'reactive_weight',
    inputId: 'reactive-weight',
    unit: 'percent',
    max: 100,
    step: 1,
    decimalPlaces: 0,
  },
  // Predictive PEC only runs on RA, and only RA has a label for it
  {
    name: 'periodLength',
    labelKey: 'period_length',
    inputId: 'period-length',
    unit: 'seconds',
    max: 3000,
    step: 1,
    decimalPlaces: 0,
    raOnly: true,
  },
  {
    name: 'slopeWeight',
    labelKey: 'slope_weight',
    inputId: 'slope-weight',
    unit: 'raw',
    max: 1,
    step: 0.01,
    decimalPlaces: 2,
  },
  {
    name: 'expFactor',
    labelKey: 'exp_factor',
    inputId: 'exp-factor',
    unit: 'raw',
    max: 5,
    step: 0.1,
    decimalPlaces: 1,
  },
];
const FIELD_BY_NAME = Object.fromEntries(FIELDS.map((field) => [field.name, field]));

// null = the selected algorithm does not have this parameter
const values = reactive(Object.fromEntries(FIELDS.map((field) => [field.name, null])));

const visibleFields = computed(() =>
  FIELDS.filter((field) => values[field.name] !== null && (!field.raOnly || props.axis === 'ra'))
);

function validatePositiveInput(value) {
  const numericValue = Number(value);
  return numericValue > 0 ? numericValue : 0.01;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

async function setParameter(name) {
  const { unit } = FIELD_BY_NAME[name];
  let sent;
  if (unit === 'seconds') {
    values[name] = Math.max(0, Math.round(Number(values[name]) || 0));
    sent = values[name];
  } else {
    values[name] = validatePositiveInput(values[name]);
    sent = unit === 'percent' ? values[name] / 100 : values[name];
  }
  try {
    await apiService.setPHD2AlgoParam(props.axis, name, sent);
  } catch (error) {
    fetchParameters();
  }
}

const debouncedSetters = Object.fromEntries(
  FIELDS.map((field) => [field.name, debounce(() => setParameter(field.name), 1000)])
);

function toFieldValue(name, value) {
  switch (FIELD_BY_NAME[name].unit) {
    case 'percent':
      return Math.round(value * 100);
    case 'seconds':
      return Math.round(value);
    default:
      return Math.round(value * 100) / 100;
  }
}

async function fetchParameters() {
  // 1. Get the parameter names of the currently selected algorithm
  const namesResponse = await apiService.getPhd2AlgoParaName(props.axis);
  const paramNames = namesResponse.Response.ParameterNames;

  // Drop the parameters of the previously selected algorithm
  for (const field of FIELDS) values[field.name] = null;

  // 2. Query the API for each name and store it in the matching field
  for (const name of paramNames) {
    if (name === 'algorithmName') continue;
    if (!FIELD_BY_NAME[name]) {
      console.warn('Unknown parameter:', name);
      continue;
    }
    const response = await apiService.getPhd2AlgoPara(props.axis, name);
    values[name] = toFieldValue(name, response.Response.Value);
  }
}

// The algorithm can be switched while the settings modal stays open
watch(
  () =>
    props.axis === 'ra' ? guiderStore.phd2GuideAlgorithmRA : guiderStore.phd2GuideAlgorithmDEC,
  () => fetchParameters()
);

onMounted(fetchParameters);
</script>
