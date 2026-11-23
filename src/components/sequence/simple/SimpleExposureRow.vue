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
    <!-- Enabled + progress + delete. The filter has a line of its own below: nested in the
         target card the row is too narrow on a phone to show its name next to these. -->
    <div class="flex items-center gap-2">
      <ToggleButton
        :statusValue="row.enabled"
        :disabled="isRunning"
        :title="$t('components.sequence.simple.exposureEnabled')"
        @update:statusValue="store.enable(row.id, $event)"
      />
      <span class="flex-1 min-w-0 text-xs font-mono tabular-nums text-content-faint">
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

    <!-- Without a filter wheel (and no filter in the item) the select would be empty -->
    <div v-if="row.filterItem && (filterNames.length || row.filterName)" class="space-y-1">
      <label :for="`simple-filter-${row.id}`" class="tns-label">
        {{ $t('components.sequence.items.switchFilter.filter') }}
      </label>
      <select
        :id="`simple-filter-${row.id}`"
        class="tns-select"
        :value="row.filterName"
        :disabled="isRunning"
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
    </div>
    <!-- Only worth a line with a filter wheel: a colour camera has nothing to choose here -->
    <p v-else-if="filterNames.length" class="text-sm text-content-faint">
      {{ $t('components.sequence.simple.noFilter') }}
    </p>

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
            :labelKey="'components.sequence.simple.exposureTime'"
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
            :labelKey="'components.sequence.simple.count'"
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

        <!-- Gain stays in view: it changes with the target and the filter. -1 means the
             camera's default, set on the home page. -->
        <GainInput
          v-if="typeof row.gain === 'number'"
          :modelValue="row.gain"
          labelKey="components.sequence.items.takeExposure.gain"
          :min="-1"
          :max="1000"
          :defaultValue="profileGain"
          :inputId="`simple-gain-${row.id}`"
          @change="saveExposure('Gain', $event)"
        />
        <!-- Offset (set once per camera), type and binning: collapsed to one summary line -->
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
          <NumberInputPicker
            v-if="typeof row.offset === 'number'"
            :modelValue="row.offset"
            :label="$t('components.sequence.items.takeExposure.offset')"
            :labelKey="'components.sequence.items.takeExposure.offset'"
            :inputId="`simple-offset-${row.id}`"
            :min="-1"
            :max="1000"
            :step="1"
            :decimalPlaces="0"
            :defaultValue="profileOffset"
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
import { filterNameChoices, switchFilterUpdate } from '@/utils/sequenceFilter';

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

const detailSummary = computed(() => {
  const { offset, binning, imageType } = props.row;
  const offsetText =
    typeof offset === 'number'
      ? `${t('components.sequence.simple.offsetShort')} ${offset === -1 ? (profileOffset.value ?? '–') : offset}`
      : '';
  return [offsetText, imageType, binning].filter(Boolean).join(' · ');
});

// What -1 stands for: the profile default the home page sets
const profileGain = computed(() => finiteOrNull(mainStore.profileInfo?.CameraSettings?.Gain));
const profileOffset = computed(() => finiteOrNull(mainStore.profileInfo?.CameraSettings?.Offset));

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// All sources use the wheel's slot order, so the index stays valid.
const filterNames = computed(() =>
  filterNameChoices(props.row.filterItem, mainStore.filterInfo, mainStore.profileInfo)
);

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
