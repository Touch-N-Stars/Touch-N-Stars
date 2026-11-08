<template>
  <div
    class="rounded-control border px-3 py-2 space-y-2"
    :class="
      isRunning
        ? 'border-accent/60 bg-accent/5'
        : isDone
          ? 'border-line bg-surface-2/40 opacity-70'
          : 'border-line bg-surface-2'
    "
  >
    <!-- Enabled + filter + progress + delete -->
    <div class="flex items-center gap-2">
      <ToggleButton
        :statusValue="row.enabled"
        :disabled="isRunning"
        :title="$t('components.sequence.simple.exposureEnabled')"
        @update:statusValue="store.enable(row.id, $event)"
      />
      <select
        v-if="row.filterItem"
        :id="`simple-filter-${row.id}`"
        class="tns-select w-auto! min-w-0 flex-1 text-sm"
        :value="row.filterName"
        :disabled="isRunning"
        :aria-label="$t('components.sequence.items.switchFilter.filter')"
        @change="saveFilter($event.target.value)"
      >
        <option
          v-if="row.filterName && !filterNames.includes(row.filterName)"
          :value="row.filterName"
        >
          {{ row.filterName }}
        </option>
        <option v-for="(name, i) in filterNames" :key="i" :value="name">{{ name }}</option>
      </select>
      <span v-else class="flex-1 min-w-0 truncate text-sm text-content-faint">
        {{ $t('components.sequence.simple.noFilter') }}
      </span>

      <span class="shrink-0 text-xs font-mono tabular-nums text-content-faint">
        {{ row.completed }} / {{ row.iterations }}
      </span>
      <button
        type="button"
        class="shrink-0 min-h-touch min-w-touch flex items-center justify-center rounded-control text-content-faint hover:text-status-danger disabled:opacity-40 disabled:cursor-not-allowed"
        :disabled="isRunning"
        :title="$t('components.sequence.simple.deleteExposure')"
        :aria-label="$t('components.sequence.simple.deleteExposure')"
        @click="$emit('delete', row)"
      >
        <TrashIcon class="w-5 h-5" />
      </button>
    </div>

    <!-- Progress bar -->
    <div class="h-1 rounded-full bg-surface-3 overflow-hidden">
      <div class="h-full bg-accent transition-all duration-300" :style="{ width: progressWidth }" />
    </div>

    <template v-if="row.exposureItem && row.loopCondition">
      <div
        class="space-y-2"
        :class="{ 'pointer-events-none opacity-60': isRunning || !row.enabled }"
      >
        <!-- Exposure time + count -->
        <div class="grid grid-cols-2 gap-2">
          <NumberInputPicker
            :modelValue="row.exposureTime"
            :label="$t('components.sequence.simple.exposureTime')"
            :labelKey="`simple-exposure-${row.id}`"
            :inputId="`simple-exposure-${row.id}`"
            :min="0"
            :max="3600"
            :step="1"
            :decimalPlaces="1"
            :useDefaultSentinel="false"
            labelPosition="top"
            wrapperClass="w-full"
            @change="saveExposure('ExposureTime', $event)"
          />
          <NumberInputPicker
            :modelValue="row.iterations"
            :label="$t('components.sequence.simple.count')"
            :labelKey="`simple-count-${row.id}`"
            :inputId="`simple-count-${row.id}`"
            :min="1"
            :max="9999"
            :step="1"
            :decimalPlaces="0"
            :useDefaultSentinel="false"
            labelPosition="top"
            wrapperClass="w-full"
            @change="saveLoop('Iterations', $event)"
          />
        </div>

        <!-- Gain, offset, type, binning: collapsed to one summary line -->
        <button
          type="button"
          class="w-full min-h-touch flex items-center gap-2 text-left text-xs text-content-faint hover:text-content-muted"
          :aria-expanded="showDetails"
          @click="showDetails = !showDetails"
        >
          <ChevronRightIcon
            class="w-4 h-4 shrink-0 transition-transform duration-200"
            :class="{ 'rotate-90': showDetails }"
          />
          <span class="min-w-0 flex-1 truncate">{{ detailSummary }}</span>
        </button>

        <div v-if="showDetails" class="space-y-2">
          <GainInput
            v-if="typeof row.gain === 'number'"
            :modelValue="row.gain"
            :labelKey="`simple-gain-${row.id}`"
            :min="0"
            :max="1000"
            @change="saveExposure('Gain', $event)"
          />
          <NumberInputPicker
            v-if="typeof row.offset === 'number'"
            :modelValue="row.offset"
            :label="$t('components.sequence.items.takeExposure.offset')"
            :labelKey="`simple-offset-${row.id}`"
            :inputId="`simple-offset-${row.id}`"
            :min="-1"
            :max="1000"
            :step="1"
            @change="saveExposure('Offset', $event)"
          />
          <div class="flex items-center gap-3">
            <label :for="`simple-type-${row.id}`" class="flex-1 text-xs text-content-muted">
              {{ $t('components.sequence.items.takeExposure.imageType') }}
            </label>
            <select
              :id="`simple-type-${row.id}`"
              class="tns-select w-36!"
              :value="row.imageType"
              @change="saveExposure('ImageType', $event.target.value)"
            >
              <option v-for="type in IMAGE_TYPES" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <label :for="`simple-binning-${row.id}`" class="flex-1 text-xs text-content-muted">
              {{ $t('components.sequence.items.takeExposure.binning') }}
            </label>
            <select
              :id="`simple-binning-${row.id}`"
              class="tns-select w-36!"
              :value="row.binning"
              @change="saveBinning($event.target.value)"
            >
              <option v-for="bin in BINNINGS" :key="bin" :value="`${bin}x${bin}`">
                {{ bin }}x{{ bin }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronRightIcon, TrashIcon } from '@heroicons/vue/24/outline';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import GainInput from '@/components/helpers/GainInput.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { apiStore } from '@/store/store';
import { switchFilterUpdate } from '@/utils/sequenceFilter';

// row: an entry from exposureRow() in src/utils/sequenceSimple.js. Every edit is written to
// the raw child item it came from, exactly like SmartExposureItem / TakeManyExposuresItem.
const props = defineProps({
  row: { type: Object, required: true },
});

defineEmits(['delete']);

const IMAGE_TYPES = ['LIGHT', 'DARK', 'FLAT', 'BIAS'];
const BINNINGS = [1, 2, 3, 4];

const { t } = useI18n();
const store = useSequenceV2Store();
const mainStore = apiStore();
const showDetails = ref(false);

const isRunning = computed(() => props.row.status === 'RUNNING');
const isDone = computed(() => ['FINISHED', 'SKIPPED', 'DISABLED'].includes(props.row.status));

const progressWidth = computed(() => {
  const { completed, iterations } = props.row;
  if (!iterations) return '0%';
  return `${Math.min(100, (completed / iterations) * 100)}%`;
});

// -1 means "whatever the camera is set to", like in the full editor.
function cameraValue(value) {
  return value === -1 || value === undefined || value === null
    ? t('components.sequence.simple.cameraDefault')
    : value;
}

const detailSummary = computed(() => {
  const { gain, offset, binning, imageType } = props.row;
  return [
    `${t('components.sequence.simple.gainShort')} ${cameraValue(gain)}`,
    `${t('components.sequence.simple.offsetShort')} ${cameraValue(offset)}`,
    binning,
    imageType,
  ]
    .filter(Boolean)
    .join(' · ');
});

// Sources in order: the item itself, the connected filter wheel, then the active profile. The
// profile keeps the list available while the wheel is disconnected, e.g. when planning the
// sequence during the day. All three use the wheel's slot order, so the index stays valid.
const filterNames = computed(() => {
  const fw = props.row.filterItem;
  if (fw?.FilterNames?.length) return fw.FilterNames;
  const wheel = mainStore.filterInfo?.AvailableFilters?.map((f) => f.Name) ?? [];
  if (wheel.length) return wheel;
  return mainStore.profileInfo?.FilterWheelSettings?.FilterWheelFilters?.map((f) => f.Name) ?? [];
});

// Same convention as SmartExposureItem.vue
function saveFilter(name) {
  const item = props.row.filterItem;
  if (!item?.Id) return;
  const { property, value } = switchFilterUpdate(item, filterNames.value, name);
  store.setProperty(item.Id, property, value);
}

function saveExposure(key, value) {
  const id = props.row.exposureItem?.Id;
  if (id) store.setProperty(id, key, value);
}

// Same value format as the binning select of SmartExposureItem.vue
function saveBinning(label) {
  const n = parseInt(label, 10);
  saveExposure('Binning', JSON.stringify({ X: n, Y: n }));
}

function saveLoop(key, value) {
  const id = props.row.loopCondition?.Id;
  if (id) store.setProperty(id, key, value);
}
</script>
