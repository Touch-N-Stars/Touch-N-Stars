<template>
  <div class="action-properties h-full flex flex-col">
    <!-- Header -->
    <div class="p-4 border-b border-gray-200 dark:border-gray-700">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div
            :class="[
              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm',
              action.color,
            ]"
          >
            {{ action.icon }}
          </div>
          <div>
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ action.name }}</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ action.description }}</p>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors lg:hidden"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="!hasParameters" class="text-center py-8">
        <div class="text-gray-400 dark:text-gray-500 text-4xl mb-4">⚙️</div>
        <p class="text-gray-600 dark:text-gray-400">
          {{ t('plugins.sequenceCreator.actions.noConfigurableParameters') }}
        </p>
      </div>

      <div v-else class="space-y-6">
        <!-- Special handling for target-settings action -->
        <div v-if="action.type === 'target-settings'" class="space-y-6">
          <!-- Target Search -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {{ t('plugins.sequenceCreator.targetSearch.searchLabel') }}
            </label>
            <TargetSearch @target-selected="handleTargetSelected" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {{ t('plugins.sequenceCreator.targetSearch.searchDescription') }}
            </p>
          </div>
        </div>

        <!-- Special handling for orbital-target action -->
        <div v-if="action.type === 'orbital-target'" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Search orbital object
            </label>
            <OrbitalTargetSearch @target-selected="handleTargetSelected" />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Position is computed at selection time and stored as static RA/Dec for NINA.
              Use Recalculate to refresh before running the sequence.
            </p>
          </div>
        </div>

        <div v-for="(param, key) in action.parameters" :key="key">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {{ formatParameterName(key) }}
            <span v-if="param.required" class="text-red-500">*</span>
          </label>

          <!-- Text Input -->
          <input
            v-if="param.type === 'text'"
            :value="param.value || param.default"
            @input="updateParameter(key, $event.target.value)"
            type="text"
            :placeholder="param.placeholder || param.default"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
          />

          <!-- Number Input -->
          <div v-else-if="param.type === 'number'" class="space-y-2">
            <input
              :value="param.value !== undefined ? param.value : param.default"
              @input="handleNumberInput(key, $event.target.value, param)"
              :type="
                param.allowNegative || (param.min !== undefined && param.min < 0)
                  ? 'text'
                  : 'number'
              "
              :min="
                param.allowNegative || (param.min !== undefined && param.min < 0)
                  ? undefined
                  : param.min
              "
              :max="
                param.allowNegative || (param.min !== undefined && param.min < 0)
                  ? undefined
                  : param.max
              "
              :step="
                param.allowNegative || (param.min !== undefined && param.min < 0)
                  ? undefined
                  : param.step || 1
              "
              :placeholder="param.default?.toString()"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
            />
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span v-if="param.min !== undefined"
                >{{ t('plugins.sequenceCreator.actions.min') }} {{ param.min }}</span
              >
              <span v-if="param.max !== undefined"
                >{{ t('plugins.sequenceCreator.actions.max') }} {{ param.max }}</span
              >
            </div>
          </div>

          <!-- Select Input -->
          <select
            v-else-if="param.type === 'select'"
            :value="param.value || param.default"
            @change="updateParameter(key, $event.target.value)"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option v-for="option in param.options" :key="option" :value="option">
              {{ option }}
            </option>
          </select>

          <!-- Boolean Input -->
          <div v-else-if="param.type === 'boolean'">
            <div
              v-if="action.type === 'dew-heater' && key === 'onOff'"
              class="flex w-full items-center"
            >
              <span class="text-sm text-gray-700 dark:text-gray-300">
                {{ param.label || t('plugins.sequenceCreator.actions.enabled') }}
              </span>
              <button
                type="button"
                role="switch"
                :aria-checked="getBooleanValue(param)"
                :class="[
                  'relative ml-auto inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500',
                  getBooleanValue(param) ? 'bg-blue-600' : 'bg-gray-400 dark:bg-gray-600',
                ]"
                @click="updateParameter(key, !getBooleanValue(param))"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    getBooleanValue(param) ? 'translate-x-6' : 'translate-x-1',
                  ]"
                />
              </button>
            </div>
            <div v-else class="flex items-center space-x-3">
              <input
                :id="`param-${key}`"
                :checked="getBooleanValue(param)"
                @change="updateParameter(key, $event.target.checked)"
                type="checkbox"
                class="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
              />
              <label
                :for="`param-${key}`"
                class="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                {{ param.label || t('plugins.sequenceCreator.actions.enabled') }}
              </label>
            </div>
          </div>

          <!-- Range Input -->
          <div v-else-if="param.type === 'range'" class="space-y-2">
            <input
              :value="param.value || param.default"
              @input="updateParameter(key, parseFloat($event.target.value))"
              type="range"
              :min="param.min || 0"
              :max="param.max || 100"
              :step="param.step || 1"
              class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4 slider-thumb:rounded-full slider-thumb:bg-blue-600 slider-thumb:cursor-pointer"
            />
            <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{{ param.min || 0 }}</span>
              <span class="font-medium">{{ param.value || param.default }}</span>
              <span>{{ param.max || 100 }}</span>
            </div>
          </div>

          <!-- Parameter Description -->
          <p v-if="param.description" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ param.description }}
          </p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
      <div class="text-xs text-gray-500 dark:text-gray-400">
        <div class="flex items-center justify-between">
          <span
            >{{ t('plugins.sequenceCreator.actions.actionId') }}:
            {{ action.id.split('-')[0] }}</span
          >
          <span>{{ t('plugins.sequenceCreator.actions.category') }}: {{ action.category }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import TargetSearch from './TargetSearch.vue';
import OrbitalTargetSearch from './OrbitalTargetSearch.vue';

const { t } = useI18n();

// Props
const props = defineProps({
  action: {
    type: Object,
    required: true,
  },
});

// Emits
const emit = defineEmits(['update-parameter', 'close']);

// Computed
const hasParameters = computed(() => {
  return Object.keys(props.action.parameters || {}).length > 0;
});

// Methods
function formatParameterName(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function updateParameter(key, value) {
  emit('update-parameter', props.action.id, key, value);
}

function getBooleanValue(param) {
  return param.value !== undefined ? param.value : param.default;
}

function handleNumberInput(key, value, param) {
  // Allow empty string and minus sign for all number inputs
  if (value === '' || value === '-') {
    emit('update-parameter', props.action.id, key, value);
    return;
  }

  // For text inputs (negative number fields), handle partial negative numbers like "-1", "-12", etc.
  const isNegativeField = param.allowNegative || (param.min !== undefined && param.min < 0);
  if (isNegativeField && value.startsWith('-') && value.length > 1) {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      // Valid negative number being typed
      emit('update-parameter', props.action.id, key, value);
      return;
    }
  }

  // Parse the number for validation
  const numValue = parseFloat(value);

  // Check if it's a valid number
  if (isNaN(numValue)) {
    // For text inputs, keep the invalid input to allow continued typing
    if (isNegativeField) {
      emit('update-parameter', props.action.id, key, value);
      return;
    }
    // For number inputs, revert to fallback
    const fallbackValue = param.value !== undefined ? param.value : param.default;
    emit('update-parameter', props.action.id, key, fallbackValue);
    return;
  }

  // Apply min/max constraints if specified
  let constrainedValue = numValue;
  if (param.min !== undefined && numValue < param.min) {
    constrainedValue = param.min;
  }
  if (param.max !== undefined && numValue > param.max) {
    constrainedValue = param.max;
  }

  emit('update-parameter', props.action.id, key, constrainedValue);
}

function handleTargetSelected(targetData) {
  console.log('Target selected:', targetData);

  // Update target settings parameters with the selected target data
  if (targetData.name) {
    updateParameter('targetName', targetData.name);
  }
  if (targetData.ra) {
    updateParameter('ra', targetData.ra);
  }
  if (targetData.dec) {
    updateParameter('dec', targetData.dec);
  }
  if (targetData.positionAngle !== undefined) {
    updateParameter('positionAngle', targetData.positionAngle);
  }
}
</script>

<style scoped>
/* Custom slider styles for webkit browsers */
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type='range']::-webkit-slider-track {
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
}

.dark input[type='range']::-webkit-slider-track {
  background: #374151;
}

/* Custom slider styles for Firefox */
input[type='range']::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

input[type='range']::-moz-range-track {
  height: 8px;
  border-radius: 4px;
  background: #e5e7eb;
  border: none;
}

.dark input[type='range']::-moz-range-track {
  background: #374151;
}
</style>
