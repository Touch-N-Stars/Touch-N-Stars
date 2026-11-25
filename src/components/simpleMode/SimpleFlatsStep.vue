<template>
  <div class="flex flex-col gap-3">
    <!-- The step drives the plugin-side run only: it keeps going while the app is closed. -->
    <p v-if="flatsStore.serverWorkflow === false" class="text-sm text-status-warn">
      {{ $t('components.simpleMode.steps.flats.needsPlugin') }}
    </p>
    <DeviceNotConnected
      v-else-if="!store.cameraInfo.Connected && !running"
      messageKey="components.simpleMode.needsCamera"
    />

    <!-- Running: progress per filter, then the dark flats -->
    <template v-else-if="running">
      <ul class="flex flex-col gap-1">
        <li
          v-for="filter in runFilters"
          :key="filter.key"
          class="flex items-center justify-between gap-2 text-sm"
        >
          <span class="text-content">{{ filter.name }}</span>
          <span class="text-content-muted tabular-nums">
            {{ $t('components.simpleMode.steps.flats.progress', filter) }}
          </span>
        </li>
        <li
          v-if="darksTotal > 0"
          class="flex items-center justify-between gap-2 text-sm text-content-muted"
        >
          <span>{{ $t('components.simpleMode.steps.flats.darksLabel') }}</span>
          <span class="tabular-nums">
            {{
              $t('components.simpleMode.steps.flats.progress', {
                done: darksDone,
                total: darksTotal,
              })
            }}
          </span>
        </li>
      </ul>
      <button type="button" class="tns-btn-danger" :disabled="stopping" @click="stop">
        <Spinner v-if="stopping" size="sm" />
        {{ $t('components.simpleMode.steps.flats.stop') }}
      </button>
    </template>

    <template v-else>
      <!-- Result of tonight's last run, in plain words -->
      <ul v-if="lastResults.length" class="flex flex-col gap-1">
        <li v-for="result in lastResults" :key="result.key" class="text-sm flex flex-col">
          <span class="flex items-center gap-2">
            <CheckIcon v-if="result.state === 'success'" class="w-4 h-4 text-status-ok" />
            <ExclamationTriangleIcon v-else class="w-4 h-4 text-status-warn" />
            <span class="text-content">{{ result.name }}</span>
          </span>
          <span
            class="text-xs pl-6"
            :class="result.state === 'success' ? 'text-content-muted' : 'text-status-warn'"
          >
            {{ result.text }}
          </span>
        </li>
      </ul>
      <p v-if="stopReason" class="text-xs text-status-warn">{{ stopReason }}</p>

      <!-- Light source: decides how the brightness is found -->
      <fieldset class="flex flex-col gap-1">
        <legend class="tns-label mb-1">
          {{ $t('components.simpleMode.steps.flats.lightSource') }}
        </legend>
        <label
          v-for="source in ['panel', 'tablet']"
          :key="source"
          class="flex items-center gap-3 min-h-touch rounded-control border px-3"
          :class="
            lightSource === source ? 'border-accent bg-accent/10' : 'border-line bg-surface-2'
          "
        >
          <input
            v-model="lightSource"
            type="radio"
            name="simple-flats-light"
            :value="source"
            class="w-5 h-5 accent-accent-action shrink-0"
            :disabled="source === 'panel' && !panelAvailable"
            @change="lightSourceTouched = true"
          />
          <span class="flex flex-col">
            <span class="text-sm text-content">
              {{ $t(`components.simpleMode.steps.flats.${source}`) }}
            </span>
            <span class="text-xs text-content-muted">
              {{
                source === 'panel' && !panelAvailable
                  ? $t('components.simpleMode.steps.flats.panelMissing')
                  : $t(`components.simpleMode.steps.flats.${source}Hint`)
              }}
            </span>
          </span>
        </label>
      </fieldset>

      <!-- Filters: those of the plan are ticked -->
      <fieldset v-if="filters.length" class="flex flex-col gap-1">
        <legend class="tns-label mb-1">
          {{ $t('components.simpleMode.steps.flats.filters') }}
        </legend>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="filter in filters"
            :key="filter.Id"
            class="flex items-center gap-2 min-h-touch rounded-chip bg-surface-2 px-3"
          >
            <input
              type="checkbox"
              class="w-5 h-5 accent-accent-action"
              :checked="selectedFilterIds.includes(filter.Id)"
              @change="toggleFilter(filter.Id, $event.target.checked)"
            />
            <span class="text-sm text-content">{{ filter.Name }}</span>
          </label>
        </div>
      </fieldset>

      <NumberInputPicker
        v-model="count"
        :labelKey="countLabelKey"
        :label="$t(countLabelKey)"
        inputId="simple-flats-count"
        :min="1"
        :max="200"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />

      <label class="flex items-center gap-3 min-h-touch">
        <input v-model="withDarks" type="checkbox" class="w-5 h-5 accent-accent-action" />
        <span class="flex flex-col">
          <span class="text-sm text-content">
            {{ $t('components.simpleMode.steps.flats.darks') }}
          </span>
          <span class="text-xs text-content-muted">
            {{ $t('components.simpleMode.steps.flats.darksHint') }}
          </span>
        </span>
      </label>

      <p v-if="blocker" class="text-xs text-status-warn">{{ $t(blocker) }}</p>
      <button
        type="button"
        class="tns-btn-primary"
        :disabled="!!blocker || starting"
        @click="start"
      >
        <Spinner v-if="starting" size="sm" />
        {{ $t('components.simpleMode.steps.flats.start') }}
      </button>
    </template>

    <router-link to="/flats" class="text-xs text-accent underline self-start">
      {{ $t('components.simpleMode.steps.flats.allSettings') }}
    </router-link>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { apiStore } from '@/store/store';
import { useFlatassistantStore } from '@/store/flatassistantStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import {
  defaultLightSource,
  flatFilterConfig,
  flatsTargetName,
  hasDimmablePanel,
  planFilterNames,
  LIGHT_SOURCE_MODES,
  SIMPLE_FLAT_COUNT,
} from '@/utils/simpleFlats';
import { isInNight } from '@/utils/simpleMode';

const props = defineProps({
  // The night key of the start page, so a result of an earlier night is not shown.
  night: { type: String, required: true },
});

const { t } = useI18n();
const store = apiStore();
const flatsStore = useFlatassistantStore();
const sequenceStore = useSequenceStore();
const sequenceV2Store = useSequenceV2Store();

onMounted(() => flatsStore.detectServerWorkflow());

// --- Inputs -------------------------------------------------------------------------------
const panelAvailable = computed(() => hasDimmablePanel(store.flatdeviceInfo));
const lightSource = ref(defaultLightSource(store.flatdeviceInfo));
// A panel that connects later becomes the default until the user picked one.
const lightSourceTouched = ref(false);
watch(panelAvailable, (available) => {
  if (!available && lightSource.value === 'panel') lightSource.value = 'tablet';
  else if (available && !lightSourceTouched.value) lightSource.value = 'panel';
});

const filters = computed(() =>
  store.filterInfo?.Connected ? (store.filterInfo.AvailableFilters ?? []) : []
);
const selectedFilterIds = ref([]);
const filtersTouched = ref(false);
// The plan's filters are ticked; without any, the filter in the wheel right now.
watch(
  [filters, () => sequenceV2Store.data],
  () => {
    if (filtersTouched.value) return;
    const names = planFilterNames(sequenceV2Store.data);
    const fromPlan = filters.value.filter((f) => names.includes(f.Name)).map((f) => f.Id);
    const current = store.filterInfo?.SelectedFilter?.Id;
    selectedFilterIds.value = fromPlan.length
      ? fromPlan
      : filters.value.some((f) => f.Id === current)
        ? [current]
        : [];
  },
  { immediate: true }
);
function toggleFilter(id, checked) {
  filtersTouched.value = true;
  selectedFilterIds.value = checked
    ? [...selectedFilterIds.value, id]
    : selectedFilterIds.value.filter((existing) => existing !== id);
}

const count = ref(SIMPLE_FLAT_COUNT);
const countLabelKey = computed(() =>
  filters.value.length
    ? 'components.simpleMode.steps.flats.count'
    : 'components.simpleMode.steps.flats.countNoWheel'
);
const withDarks = ref(false);

// --- Run state ------------------------------------------------------------------------------
const status = computed(() => flatsStore.status ?? {});
const running = computed(() => status.value.State === 'Running');
const runFilters = computed(() =>
  (status.value.Filters ?? []).map((filter, index) => ({
    key: filter.FilterId ?? `none-${index}`,
    name: filter.FilterName || t('components.simpleMode.steps.flats.noFilter'),
    done: Math.max(0, Number(filter.Completed) || 0),
    total: Number(filter.Count) || 0,
  }))
);
const darksTotal = computed(() =>
  (status.value.Filters ?? []).reduce((sum, f) => sum + (Number(f.DarkCount) || 0), 0)
);
const darksDone = computed(() =>
  (status.value.Filters ?? []).reduce((sum, f) => sum + (Number(f.DarkCompleted) || 0), 0)
);

// Tonight's last run, per filter in plain words
const finishedTonight = computed(
  () => status.value.State === 'Finished' && isInNight(status.value.FinishedAt, props.night)
);
const lastResults = computed(() => {
  if (!finishedTonight.value) return [];
  return (status.value.Filters ?? []).map((filter, index) => {
    const state = ['success', 'dim', 'bright', 'stopped'].includes(filter.State)
      ? filter.State
      : 'failed';
    const done = Math.max(0, Number(filter.Completed) || 0);
    return {
      key: filter.FilterId ?? `none-${index}`,
      state,
      name: filter.FilterName || t('components.simpleMode.steps.flats.noFilter'),
      // The rig's own message wins: the plugin guesses dim/bright from the last measured
      // level, NINA's message says what actually stopped the run.
      text:
        state === 'success' || !filter.Error
          ? t(`components.simpleMode.steps.flats.result.${state}`, { count: done }, done)
          : filter.Error,
    };
  });
});
const stopReason = computed(() =>
  finishedTonight.value && typeof status.value.Error === 'string' ? status.value.Error : ''
);

// Why "Take flats" cannot start now (locale key), or null.
const blocker = computed(() => {
  if (sequenceStore.sequenceRunning) return 'components.simpleMode.steps.flats.planRunning';
  if (filters.value.length && !selectedFilterIds.value.length) {
    return 'components.simpleMode.steps.flats.noFilterSelected';
  }
  return null;
});

// --- Actions ------------------------------------------------------------------------------
const starting = ref(false);
async function start() {
  if (blocker.value) return;
  starting.value = true;
  try {
    const wheelOrder = filters.value.map((f) => f.Id);
    const filterIds = filters.value.length
      ? [...selectedFilterIds.value].sort((a, b) => wheelOrder.indexOf(a) - wheelOrder.indexOf(b))
      : [null];
    const flatCount = Math.max(1, Math.round(Number(count.value) || SIMPLE_FLAT_COUNT));
    const profileDarks = Number(store.profileInfo?.FlatWizardSettings?.DarkFlatCount);
    await flatsStore.startServerRun({
      mode: LIGHT_SOURCE_MODES[lightSource.value],
      // A panel covers the telescope for the dark flats itself; a tablet has to be replaced
      // by a cover, which the run asks for.
      keepClosed: lightSource.value === 'panel',
      darkCount: withDarks.value ? (profileDarks > 0 ? profileDarks : flatCount) : 0,
      targetName: flatsTargetName(sequenceV2Store.data),
      filters: filterIds.map((filterId) => ({
        filterId,
        ...flatFilterConfig(store.profileInfo, filterId, flatCount),
      })),
    });
  } finally {
    starting.value = false;
  }
}

const stopping = ref(false);
async function stop() {
  stopping.value = true;
  try {
    await flatsStore.stopWorkflow();
  } finally {
    stopping.value = false;
  }
}
</script>
