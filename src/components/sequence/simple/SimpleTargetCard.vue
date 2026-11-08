<template>
  <div
    class="tns-card space-y-3"
    :class="isRunning ? 'border-accent/70 shadow-lg shadow-accent/10' : ''"
  >
    <!-- Header: name, coordinates, time -->
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 min-w-0">
          <span class="tns-dot" :class="statusDot" />
          <span class="truncate text-base font-semibold text-content">
            {{ targetName || $t('components.sequence.simple.noTargetName') }}
          </span>
        </div>
        <div class="mt-0.5 text-xs font-mono text-content-faint truncate">
          <template v-if="raStr">{{ raStr }} {{ decStr }} · {{ displayPositionAngle }}°</template>
          <template v-else>{{ $t('components.sequence.simple.noCoordinates') }}</template>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <div class="text-sm font-semibold tabular-nums text-content">
          ≈ {{ formatDuration(target.remainingSeconds) }}
        </div>
        <div class="text-[11px] text-content-faint tabular-nums">
          {{
            $t('components.sequence.simple.ofTotal', { total: formatDuration(target.totalSeconds) })
          }}
        </div>
        <div v-if="clockRange" class="text-[11px] text-content-muted tabular-nums">
          {{ clockRange }}
        </div>
      </div>
    </div>

    <!-- Target actions -->
    <div class="flex flex-wrap gap-1.5">
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :class="{ 'border-accent!': showSearch }"
        :disabled="isRunning"
        @click="showSearch = !showSearch"
      >
        <MagnifyingGlassIcon class="w-4 h-4" />
        {{ $t('components.sequence.simple.search') }}
      </button>
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :disabled="isRunning"
        @click="showFavPicker = true"
      >
        <HeartIcon class="w-4 h-4 text-pink-400" />
        {{ $t('components.sequence.simple.favorites') }}
      </button>
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :disabled="!canLoadIntoFraming"
        @click="loadIntoFraming"
      >
        <CameraFramingIcon class="w-4 h-4 text-accent" />
        {{ $t('components.sequence.simple.framing') }}
      </button>
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs!"
        :class="{ 'border-accent!': showCoordinates }"
        :disabled="isRunning"
        @click="showCoordinates = !showCoordinates"
      >
        <PencilSquareIcon class="w-4 h-4" />
        {{ $t('components.sequence.simple.coordinates') }}
      </button>
    </div>

    <TargetSearch v-if="showSearch" @target-selected="onSearchSelected" />
    <DsoCoordinateFields v-if="showCoordinates && !isRunning" :item="container" />

    <!-- Altitude over the night -->
    <SkyChart
      v-if="canLoadIntoFraming && siteCoordinates"
      :target="{ RA: currentRaDeg, Dec: currentDecDeg }"
      :coordinates="siteCoordinates"
    />

    <SimpleTargetOptions :container="container" />

    <!-- Exposure rows -->
    <div class="space-y-2">
      <SimpleExposureRow
        v-for="row in target.rows"
        :key="row.id"
        :row="row"
        @delete="pendingDelete = { kind: 'row', id: row.id }"
      />
      <p v-if="!target.rows.length" class="text-sm text-content-faint">
        {{ $t('components.sequence.simple.noExposures') }}
      </p>
      <button type="button" class="tns-btn-secondary" @click="addExposureRow">
        <PlusIcon class="w-4 h-4" />
        {{ $t('components.sequence.simple.addExposure') }}
      </button>
    </div>

    <!-- Steps the simple view does not show -->
    <p v-if="target.otherItems.length" class="text-xs text-content-faint">
      {{ $t('components.sequence.simple.otherSteps', { count: target.otherItems.length }) }}:
      {{ otherStepNames }}
    </p>

    <!-- Container actions -->
    <div class="flex items-center gap-1.5 border-t border-line pt-3">
      <button
        type="button"
        class="tns-btn-secondary w-auto! px-3! text-xs! mr-auto"
        @click="copyTarget"
      >
        <DocumentDuplicateIcon class="w-4 h-4" />
        {{ $t('components.sequence.simple.copyTarget') }}
      </button>
      <button
        type="button"
        class="tns-btn-ghost"
        :disabled="!canMoveUp || isRunning"
        :title="$t('components.sequence.simple.moveUp')"
        :aria-label="$t('components.sequence.simple.moveUp')"
        @click="store.moveDsoTarget(container.Id, -1)"
      >
        <ArrowUpIcon class="w-5 h-5" />
      </button>
      <button
        type="button"
        class="tns-btn-ghost"
        :disabled="!canMoveDown || isRunning"
        :title="$t('components.sequence.simple.moveDown')"
        :aria-label="$t('components.sequence.simple.moveDown')"
        @click="store.moveDsoTarget(container.Id, 1)"
      >
        <ArrowDownIcon class="w-5 h-5" />
      </button>
      <button
        type="button"
        class="tns-btn-ghost text-status-danger"
        :disabled="isRunning"
        :title="$t('components.sequence.simple.deleteTarget')"
        :aria-label="$t('components.sequence.simple.deleteTarget')"
        @click="pendingDelete = { kind: 'target', id: container.Id }"
      >
        <TrashIcon class="w-5 h-5" />
      </button>
    </div>

    <DsoFavoritePickerModal
      :show="showFavPicker"
      @close="showFavPicker = false"
      @select="onFavoriteSelected"
    />

    <Modal :show="pendingDelete !== null" maxWidth="max-w-sm" @close="pendingDelete = null">
      <template #header>
        <span class="text-base font-semibold">{{ deleteTitle }}</span>
      </template>
      <template #body>
        <div class="w-full space-y-4">
          <p class="text-sm text-content">{{ deleteMessage }}</p>
          <div class="flex gap-2">
            <button type="button" class="tns-btn-secondary" @click="pendingDelete = null">
              {{ $t('common.cancel') }}
            </button>
            <button type="button" class="tns-btn-danger" @click="confirmDelete">
              {{ $t('components.sequence.delete') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  DocumentDuplicateIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import CameraFramingIcon from '@/components/icons/CameraFramingIcon.vue';
import SkyChart from '@/components/framing/SkyChart.vue';
import TargetSearch from '@/plugins/sequence-creator/components/TargetSearch.vue';
import DsoFavoritePickerModal from '@/components/sequence/items/DsoFavoritePickerModal.vue';
import DsoCoordinateFields from '@/components/sequence/items/DsoCoordinateFields.vue';
import SimpleExposureRow from './SimpleExposureRow.vue';
import SimpleTargetOptions from './SimpleTargetOptions.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useToastStore } from '@/store/toastStore';
import { apiStore } from '@/store/store';
import { useDsoContainerTarget } from '@/composables/useDsoContainerTarget';
import {
  formatClock,
  formatDuration,
  insertionPoint,
  itemDisplayName,
  SMART_EXPOSURE_TYPE,
  TARGET_ORDER,
} from '@/utils/sequenceSimple';

// target: an entry from summarizeTargets() in src/utils/sequenceSimple.js
const props = defineProps({
  target: { type: Object, required: true },
  canMoveUp: { type: Boolean, default: false },
  canMoveDown: { type: Boolean, default: false },
});

const { t } = useI18n();
const store = useSequenceV2Store();
const toastStore = useToastStore();
const mainStore = apiStore();

const container = computed(() => props.target.container);
const {
  raStr,
  decStr,
  displayPositionAngle,
  targetName,
  currentRaDeg,
  currentDecDeg,
  setFromSearch,
  setFromFavorite,
  canLoadIntoFraming,
  loadIntoFraming,
} = useDsoContainerTarget(() => container.value);

const showSearch = ref(false);
const showFavPicker = ref(false);
const showCoordinates = ref(false);

const siteCoordinates = computed(() => {
  const settings = mainStore.profileInfo?.AstrometrySettings;
  if (settings?.Latitude == null) return null;
  return { latitude: settings.Latitude, longitude: settings.Longitude };
});

// "21:40–23:15" while frames are left; summarizeTargets() chains the targets one after the
// other, starting now.
const clockRange = computed(() => {
  const { startMs, endMs, remainingSeconds } = props.target;
  if (startMs === undefined || !remainingSeconds) return '';
  return `${formatClock(startMs)}–${formatClock(endMs)}`;
});
// { kind: 'row' | 'target', id } while the delete confirmation is open
const pendingDelete = ref(null);

const isRunning = computed(() => container.value.Status === 'RUNNING');

const statusDot = computed(() => {
  switch (container.value.Status) {
    case 'RUNNING':
      return 'bg-accent animate-pulse';
    case 'FINISHED':
      return 'bg-status-ok';
    case 'FAILED':
      return 'bg-status-danger';
    case 'DISABLED':
    case 'SKIPPED':
      return 'bg-content-faint/40';
    default:
      return 'bg-content-faint';
  }
});

const otherStepNames = computed(() => props.target.otherItems.map(itemDisplayName).join(', '));

async function onSearchSelected(targetData) {
  await setFromSearch(targetData);
  showSearch.value = false;
}

function onFavoriteSelected(favorite) {
  setFromFavorite(favorite);
  showFavPicker.value = false;
}

// New rows go behind the last exposure row, or behind the target's steps when there is none.
function addExposureRow() {
  const { targetId, insertAfter } = insertionPoint(
    container.value,
    SMART_EXPOSURE_TYPE,
    TARGET_ORDER,
    'bottom'
  );
  store.addItem(targetId, SMART_EXPOSURE_TYPE, insertAfter);
}

async function copyTarget() {
  const result = await store.copyDsoTarget(container.value.Id);
  if (result.ok) return;
  toastStore.showToast({
    type: 'error',
    title: t('components.sequence.editFailed'),
    message: result.locked
      ? t('components.sequence.controlsLockedMessage')
      : result.error || t('components.sequence.simple.copyFailed'),
    autoClose: true,
  });
}

const deleteTitle = computed(() =>
  pendingDelete.value?.kind === 'target'
    ? t('components.sequence.simple.deleteTarget')
    : t('components.sequence.simple.deleteExposure')
);
const deleteMessage = computed(() =>
  pendingDelete.value?.kind === 'target'
    ? t('components.sequence.simple.deleteTargetConfirm', {
        name: targetName.value || t('components.sequence.simple.noTargetName'),
      })
    : t('components.sequence.simple.deleteExposureConfirm')
);

async function confirmDelete() {
  const pending = pendingDelete.value;
  pendingDelete.value = null;
  if (pending) await store.remove(pending.id);
}
</script>
