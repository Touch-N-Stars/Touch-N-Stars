<template>
  <Modal :show="show" @close="onClose">
    <template #header>
      <h2 class="text-2xl font-semibold">
        {{ $t('components.guider.phd2.darkLibrary.title') }}
      </h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 w-full min-w-0 max-w-full sm:min-w-[500px]">
        <!-- Info Section -->
        <div class="p-3 sm:p-4 bg-accent/10 border border-accent/30 rounded-control">
          <p class="text-content text-sm">
            {{ $t('components.guider.phd2.darkLibrary.info') }}
          </p>
          <p class="text-content-muted text-xs mt-2">
            {{ $t('components.guider.phd2.darkLibrary.warning') }}
          </p>
        </div>

        <!-- Current Library Status -->
        <div class="bg-surface-2 p-3 rounded-control space-y-2">
          <h3 class="text-sm font-medium text-content-muted mb-2">
            {{ $t('components.guider.phd2.darkLibrary.status') }}
          </h3>
          <div v-if="info" class="text-sm grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="text-content-muted">
              {{ $t('components.guider.phd2.darkLibrary.exists') }}:
            </div>
            <div :class="info.Exists ? 'text-status-ok' : 'text-content-muted'">
              {{ info.Exists ? '✓' : '–' }}
            </div>
            <div class="text-content-muted">
              {{ $t('components.guider.phd2.darkLibrary.loaded') }}:
            </div>
            <div :class="info.Loaded ? 'text-status-ok' : 'text-content-muted'">
              {{ info.Loaded ? '✓' : '–' }}
            </div>
            <template v-if="info.Exists">
              <div class="text-content-muted">
                {{ $t('components.guider.phd2.darkLibrary.numDarks') }}:
              </div>
              <div class="text-content">{{ info.NumDarks }}</div>
              <div class="text-content-muted">
                {{ $t('components.guider.phd2.darkLibrary.range') }}:
              </div>
              <div class="text-content">
                {{ (info.MinExposureSec / 1000).toFixed(1) }} –
                {{ (info.MaxExposureSec / 1000).toFixed(1) }} s
              </div>
            </template>
          </div>
          <div v-else class="text-sm text-content-muted">
            {{ $t('components.guider.phd2.darkLibrary.noLibrary') }}
          </div>
        </div>

        <!-- Exposure Configuration -->
        <div class="bg-surface-2 p-3 rounded-control space-y-3">
          <div class="flex flex-col gap-1">
            <label for="darkLibMinExposure" class="tns-label">
              {{ $t('components.guider.phd2.darkLibrary.minExposure') }}
            </label>
            <select v-model.number="minExposureSec" id="darkLibMinExposure" class="tns-select">
              <option v-for="t in phd2ExposureSteps" :key="`min-${t}`" :value="t">
                {{ formatSeconds(t) }} s
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <label for="darkLibMaxExposure" class="tns-label">
              {{ $t('components.guider.phd2.darkLibrary.maxExposure') }}
            </label>
            <select v-model.number="maxExposureSec" id="darkLibMaxExposure" class="tns-select">
              <option v-for="t in phd2ExposureSteps" :key="`max-${t}`" :value="t">
                {{ formatSeconds(t) }} s
              </option>
            </select>
          </div>
          <NumberInputPicker
            v-model="frameCount"
            :label="$t('components.guider.phd2.darkLibrary.frameCount')"
            labelKey="components.guider.phd2.darkLibrary.frameCount"
            :min="1"
            :max="50"
            :step="1"
            :decimalPlaces="0"
            inputId="darkLibFrameCount"
            wrapperClass="w-full"
          />

          <div v-if="rangeInvalid" class="text-xs text-status-danger">
            {{ $t('components.guider.phd2.darkLibrary.invalidRange') }}
          </div>
          <div v-else>
            <div class="text-xs text-content-muted mb-1">
              {{ $t('components.guider.phd2.darkLibrary.previewExposures') }}:
            </div>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="t in expTimesMs"
                :key="t"
                class="px-2 py-0.5 text-xs bg-surface-3 text-content rounded-chip"
              >
                {{ formatSeconds(t / 1000) }} s
              </span>
            </div>
            <div class="text-xs text-content-muted mt-2">
              {{ $t('components.guider.phd2.darkLibrary.totalFrames') }}:
              <span class="text-content">{{ totalFrames }}</span>
            </div>
          </div>
        </div>

        <!-- Progress -->
        <div
          v-if="isBuilding && buildStatus"
          class="p-3 rounded-control bg-accent/10 border border-accent/30"
        >
          <div class="flex items-center gap-2 mb-2">
            <Spinner size="sm" class="text-accent" />
            <span class="text-sm text-accent">
              {{ $t('components.guider.phd2.darkLibrary.building') }}
            </span>
          </div>
          <div class="text-xs text-content mb-2">
            {{
              $t('components.guider.phd2.darkLibrary.buildProgress', {
                frame: buildStatus.Frame ?? 0,
                total: buildStatus.TotalFrames ?? 0,
                exposure: ((buildStatus.ExposureMs ?? 0) / 1000).toFixed(1),
              })
            }}
          </div>
          <div class="w-full h-2 bg-surface-3 rounded-full">
            <div
              class="h-2 bg-accent rounded-full transition-all"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
        </div>

        <!-- Result -->
        <div v-if="lastResult" class="p-3 sm:p-4 rounded-control" :class="resultClass">
          <div class="text-sm">
            <div class="font-medium">
              {{
                lastResult.success
                  ? $t('components.guider.phd2.darkLibrary.buildSuccess')
                  : $t('components.guider.phd2.darkLibrary.buildFailed')
              }}
            </div>
            <div v-if="lastResult.error" class="mt-1 text-content-muted">
              {{ lastResult.error }}
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3">
          <!-- Build / Cancel -->
          <button
            @click="isBuilding ? onCancel() : onBuild()"
            :disabled="!isBuilding && (rangeInvalid || expTimesMs.length === 0)"
            :class="isBuilding ? 'tns-btn-danger' : 'tns-btn-primary'"
          >
            <StopIcon v-if="isBuilding" class="w-5 h-5" />
            <span>
              {{
                isBuilding
                  ? $t('components.guider.phd2.darkLibrary.cancel')
                  : $t('components.guider.phd2.darkLibrary.build')
              }}
            </span>
          </button>

          <div class="grid grid-cols-3 gap-2">
            <button
              @click="onLoad"
              :disabled="isBuilding || !info?.Exists || info?.Loaded"
              class="tns-btn-secondary px-2!"
            >
              {{ $t('components.guider.phd2.darkLibrary.load') }}
            </button>
            <button
              @click="onUnload"
              :disabled="isBuilding || !info?.Loaded"
              class="tns-btn-secondary px-2!"
            >
              {{ $t('components.guider.phd2.darkLibrary.unload') }}
            </button>
            <button
              @click="onDelete"
              :disabled="isBuilding || !info?.Exists"
              :class="confirmDelete ? 'tns-btn-danger' : 'tns-btn-secondary'"
              class="px-2!"
            >
              {{
                confirmDelete
                  ? $t('components.guider.phd2.darkLibrary.confirmDelete')
                  : $t('components.guider.phd2.darkLibrary.delete')
              }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { StopIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useGuiderStore } from '@/store/guiderStore';

const props = defineProps({
  show: Boolean,
});
const emit = defineEmits(['close']);

const guiderStore = useGuiderStore();

const phd2ExposureSteps = [
  0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0, 7.0, 8.0, 9.0,
  10.0, 15.0, 30.0,
];

function formatSeconds(t) {
  return t < 1 ? t.toFixed(2) : t.toFixed(1);
}

const minExposureSec = ref(0.5);
const maxExposureSec = ref(4.0);
const frameCount = ref(5);
const confirmDelete = ref(false);
let confirmDeleteTimer = null;

const info = computed(() => guiderStore.phd2DarkLibraryInfo);
const buildStatus = computed(() => guiderStore.phd2DarkLibraryBuildStatus);
const isBuilding = computed(() => guiderStore.isDarkLibraryBuildActive);
const lastResult = computed(() => guiderStore.phd2DarkLibraryLastResult);

const rangeInvalid = computed(() => minExposureSec.value > maxExposureSec.value);

const expTimesMs = computed(() => {
  if (rangeInvalid.value) return [];
  return phd2ExposureSteps
    .filter((t) => t >= minExposureSec.value && t <= maxExposureSec.value)
    .map((t) => Math.round(t * 1000));
});

const totalFrames = computed(() => expTimesMs.value.length * frameCount.value);

const progressPercent = computed(() => {
  const s = buildStatus.value;
  if (!s || !s.TotalFrames) return 0;
  return Math.min(100, Math.round((s.Frame / s.TotalFrames) * 100));
});

const resultClass = computed(() => {
  if (!lastResult.value) return '';
  return lastResult.value.success
    ? 'bg-status-ok/10 border border-status-ok/40 text-status-ok'
    : 'bg-status-danger/10 border border-status-danger/40 text-status-danger';
});

async function onBuild() {
  if (rangeInvalid.value || expTimesMs.value.length === 0) return;
  try {
    await guiderStore.buildPHD2DarkLibrary(expTimesMs.value, frameCount.value);
  } catch (error) {
    console.error('Build failed to start:', error);
  }
}

async function onCancel() {
  try {
    await guiderStore.cancelPHD2DarkLibraryBuild();
  } catch (error) {
    console.error('Cancel failed:', error);
  }
}

async function onLoad() {
  try {
    await guiderStore.loadPHD2DarkLibrary();
  } catch (error) {
    console.error('Load failed:', error);
  }
}

async function onUnload() {
  try {
    await guiderStore.unloadPHD2DarkLibrary();
  } catch (error) {
    console.error('Unload failed:', error);
  }
}

async function onDelete() {
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    if (confirmDeleteTimer) clearTimeout(confirmDeleteTimer);
    confirmDeleteTimer = setTimeout(() => {
      confirmDelete.value = false;
      confirmDeleteTimer = null;
    }, 3000);
    return;
  }
  if (confirmDeleteTimer) {
    clearTimeout(confirmDeleteTimer);
    confirmDeleteTimer = null;
  }
  confirmDelete.value = false;
  try {
    await guiderStore.deletePHD2DarkLibrary();
  } catch (error) {
    console.error('Delete failed:', error);
  }
}

function onClose() {
  emit('close');
}

watch(
  () => props.show,
  async (val) => {
    if (val) {
      await guiderStore.fetchPHD2DarkLibraryInfo();
      const status = await guiderStore.fetchPHD2DarkLibraryBuildStatus();
      if (status?.Active) {
        guiderStore.startDarkLibraryBuildPolling();
      }
    }
  }
);

onMounted(async () => {
  if (props.show) {
    await guiderStore.fetchPHD2DarkLibraryInfo();
    const status = await guiderStore.fetchPHD2DarkLibraryBuildStatus();
    if (status?.Active) {
      guiderStore.startDarkLibraryBuildPolling();
    }
  }
});

onBeforeUnmount(() => {
  if (confirmDeleteTimer) clearTimeout(confirmDeleteTimer);
});
</script>
