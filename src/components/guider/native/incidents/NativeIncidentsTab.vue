<template>
  <div class="flex flex-col gap-3">
    <section class="tns-card flex flex-col gap-3">
      <div class="flex items-start gap-2">
        <FilmIcon class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 class="text-sm font-semibold text-content">{{ k('title') }}</h3>
          <p class="text-xs text-content-muted">{{ k('intro') }}</p>
        </div>
        <button
          type="button"
          class="tns-btn-secondary w-auto! px-2! shrink-0"
          :disabled="store.incidentsLoading"
          :title="k('refresh')"
          :aria-label="k('refresh')"
          @click="store.loadIncidents()"
        >
          <ArrowPathIcon class="h-5 w-5" :class="{ 'animate-spin': store.incidentsLoading }" />
        </button>
      </div>

      <p
        v-if="list && list.enabled === false"
        class="rounded-control border border-status-warn/40 bg-status-warn/10 p-2 text-xs text-status-warn"
      >
        {{ k('disabled') }}
      </p>
      <p v-if="store.incidentsError" class="text-xs text-status-danger break-words">
        {{ k('loadFailed') }}: {{ store.incidentsError }}
      </p>

      <!-- Storage budget -->
      <div v-if="list" class="flex flex-col gap-1">
        <div
          class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-xs tabular-nums"
        >
          <span class="text-content">
            {{
              k('budget', {
                used: formatBytes(budget.used),
                budget: formatBytes(budget.budget),
                count: budget.count,
                max: budget.max,
              })
            }}
          </span>
          <span v-if="budget.simulatorCount > 0" class="text-content-muted">
            {{
              k('budgetSimulator', {
                used: formatBytes(budget.simulatorUsed),
                budget: formatBytes(budget.simulatorBudget),
              })
            }}
          </span>
        </div>
        <div
          v-if="budget.budget > 0"
          class="h-1 rounded-full bg-surface-3 overflow-hidden"
          aria-hidden="true"
        >
          <div
            class="h-full transition-all duration-500"
            :class="budgetRatio > 0.9 ? 'bg-status-warn' : 'bg-accent'"
            :style="{ width: `${Math.round(budgetRatio * 100)}%` }"
          ></div>
        </div>
      </div>

      <!-- Filter + delete all -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="seg" role="group" :aria-label="k('title')">
          <button
            v-for="option in FILTERS"
            :key="option"
            type="button"
            class="seg-btn"
            :class="{ 'seg-btn-active': filter === option }"
            :aria-pressed="filter === option"
            @click="setFilter(option)"
          >
            {{ option === 'profile' ? k('filterProfile') : k('filterAll') }}
          </button>
        </div>
        <button
          v-if="deletableCount > 0 && !confirmDeleteAll"
          type="button"
          class="tns-btn-danger ml-auto w-auto! px-3! text-xs!"
          :disabled="!!store.incidentPending"
          @click="confirmDeleteAll = true"
        >
          <TrashIcon class="h-4 w-4" />
          {{ k('deleteAll') }}
        </button>
      </div>
      <div
        v-if="confirmDeleteAll"
        class="flex flex-col gap-2 rounded-control border border-status-danger/40 bg-status-danger/10 p-2.5"
        role="alertdialog"
        :aria-label="k('deleteAll')"
      >
        <p class="text-sm text-content">{{ k('deleteAllConfirm') }}</p>
        <div class="flex gap-2">
          <button
            type="button"
            class="tns-btn-secondary text-xs!"
            @click="confirmDeleteAll = false"
          >
            {{ k('cancel') }}
          </button>
          <button
            type="button"
            class="tns-btn-danger text-xs!"
            :disabled="!!store.incidentPending"
            @click="deleteAll"
          >
            {{ k('deleteAllButton', { count: deletableCount }) }}
          </button>
        </div>
      </div>
    </section>

    <!-- Being recorded, not saved yet -->
    <div
      v-if="recordingRow"
      class="tns-card p-3! flex items-center gap-2 border-status-danger/40!"
      role="status"
      data-testid="native-guider-incident-recording"
    >
      <span class="tns-dot bg-status-danger animate-pulse"></span>
      <div class="flex min-w-0 flex-col">
        <span class="text-sm font-semibold text-content">
          {{ k('recording') }}
          <span v-if="recordingRow.kind" class="font-normal">· {{ kind(recordingRow.kind) }}</span>
          <span v-if="recordingRow.start" class="font-normal text-content-muted tabular-nums">
            · {{ dateTime(recordingRow.start) }}
          </span>
        </span>
        <span class="text-xs text-content-muted">{{ k('recordingHint') }}</span>
      </div>
    </div>

    <!-- Empty state: what gets recorded -->
    <div
      v-if="!visible.length && !recordingRow && !store.incidentsLoading"
      class="tns-card flex flex-col items-center gap-2 text-center"
    >
      <FilmIcon class="h-8 w-8 text-content-faint" />
      <p class="text-sm font-semibold text-content">
        {{ filter === 'profile' && store.incidents.length ? k('noneForProfile') : k('empty') }}
      </p>
      <p class="max-w-prose text-xs text-content-muted">{{ k('emptyHint') }}</p>
    </div>

    <ul v-if="visible.length" class="flex flex-col gap-2">
      <NativeIncidentRow
        v-for="incident in visible"
        :key="incident.id"
        :incident="incident"
        :recording="incident.id === store.incidentRecordingId"
        :own-profile="!profileId || incident.tags?.profileId === profileId"
        @replay="store.openReplay($event)"
      />
    </ul>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ArrowPathIcon, FilmIcon, TrashIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import {
  budgetSummary,
  formatBytes,
  parseIncidentId,
  visibleIncidents,
} from '@/utils/nativeGuiderIncidents';
import NativeIncidentRow from './NativeIncidentRow.vue';
import { useIncidentText } from './useIncidentText';
import { readStored, writeStored } from '@/utils/safeStorage';

const FILTERS = ['profile', 'all'];
const FILTER_KEY = 'nativeGuider.incidents.filter';

const store = useNativeGuiderStore();
const toastStore = useToastStore();
const { k, kind, dateTime } = useIncidentText();

const filter = ref(readStored(FILTER_KEY, 'profile'));
const confirmDeleteAll = ref(false);

function setFilter(value) {
  filter.value = value;
  writeStored(FILTER_KEY, value);
}

const profileId = computed(() => apiStore().profileInfo?.Id || null);
const list = computed(() => store.incidentList);
const budget = computed(() => budgetSummary({ ...(list.value || {}), incidents: store.incidents }));
const budgetRatio = computed(() =>
  budget.value.budget > 0 ? Math.min(1, budget.value.used / budget.value.budget) : 0
);
const visible = computed(() =>
  visibleIncidents(store.incidents, { filter: filter.value, profileId: profileId.value })
);
const deletableCount = computed(() => store.incidents.filter((i) => !i?.kept).length);

// The incident being recorded before its first save (an ongoing one has its own row).
const recordingRow = computed(() => {
  const id = store.incidentRecordingId;
  if (!id || store.incidents.some((i) => i?.id === id)) return null;
  return { id, ...parseIncidentId(id) };
});

async function deleteAll() {
  const deleted = await store.deleteAllIncidents({ title: k('actionFailed') });
  confirmDeleteAll.value = false;
  if (deleted !== null) {
    toastStore.showToast({
      type: 'success',
      title: k('deleteAll'),
      message: k('deletedAll', { count: deleted }),
    });
  }
}

// Opening the tab (and every incident saved while it is open) clears the badge.
watch(
  () => store.incidents,
  () => store.markIncidentsSeen()
);

onMounted(async () => {
  await store.loadIncidents();
  store.markIncidentsSeen();
});
</script>

<style scoped>
@reference '../../../../assets/tailwind.css';

.seg {
  @apply flex overflow-hidden rounded-chip border border-line-strong bg-surface-2;
}

.seg-btn {
  @apply min-h-touch min-w-touch px-3 text-xs font-semibold text-content-muted
    transition-colors border-r border-line last:border-r-0;
}

.seg-btn-active {
  @apply bg-accent/15 text-accent;
}
</style>
