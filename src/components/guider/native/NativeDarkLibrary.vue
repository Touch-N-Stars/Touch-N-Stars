<template>
  <section class="flex flex-col gap-3 rounded-card border border-line bg-surface-1 p-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold uppercase tracking-wide text-content">
        {{ t('components.guider.native.darks.title') }}
      </h3>
    </div>

    <p class="text-sm break-words" :class="libraryText ? 'text-content' : 'text-content-muted'">
      {{ libraryText || t('components.guider.native.darks.none') }}
    </p>

    <!-- Build progress -->
    <div v-if="darks" class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="font-semibold" :class="progressTone">{{ statusLabel }}</span>
        <span v-if="progressPercent !== null" class="tabular-nums text-content-muted">
          {{ progressPercent.toFixed(0) }}%
        </span>
      </div>
      <div class="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          class="h-full rounded-full transition-all duration-500"
          :class="[progressBarTone, { 'animate-pulse': isRunning && progressPercent === null }]"
          :style="{
            width: `${progressPercent === null ? (isRunning ? 100 : 0) : progressPercent}%`,
          }"
        ></div>
      </div>
      <p v-if="progressDetail" class="text-xs text-content-muted tabular-nums">
        {{ progressDetail }}
      </p>
      <p v-if="darks.message" class="text-xs break-words" :class="progressTone">
        {{ darks.message }}
      </p>
      <button
        v-if="isRunning"
        type="button"
        class="tns-btn-danger"
        :disabled="cancelling"
        @click="cancel"
      >
        {{ t('components.guider.native.darks.cancel') }}
      </button>
    </div>

    <template v-if="!isRunning">
      <button type="button" class="tns-btn-secondary" :disabled="!canBuild" @click="openDialog">
        {{ t('components.guider.native.darks.build') }}
      </button>
      <p v-if="!canBuild" class="text-xs text-content-muted">
        {{
          store.isAvailable
            ? t('components.guider.native.darks.stopFirst')
            : t('components.guider.native.darks.connectFirst')
        }}
      </p>
    </template>

    <Modal :show="showDialog" maxWidth="max-w-md" @close="showDialog = false">
      <template #header>
        <h2 class="text-lg font-semibold text-content">
          {{ t('components.guider.native.darks.dialogTitle') }}
        </h2>
      </template>
      <template #body>
        <div class="flex w-full flex-col gap-4">
          <div
            class="flex items-start gap-2 rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-status-warn"
          >
            <ExclamationTriangleIcon class="mt-0.5 h-6 w-6 shrink-0" />
            <div class="flex flex-col gap-1">
              <span class="font-bold">{{ t('components.guider.native.darks.coverWarning') }}</span>
              <span class="text-xs text-content-muted">
                {{ t('components.guider.native.darks.coverHint') }}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <label class="flex flex-col gap-1 text-sm text-content-muted">
              {{ t('components.guider.native.darks.minExposure') }}
              <div class="relative">
                <input
                  v-model="minExposure"
                  type="text"
                  inputmode="decimal"
                  class="tns-input pr-8 tabular-nums"
                />
                <span
                  class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
                  >s</span
                >
              </div>
            </label>
            <label class="flex flex-col gap-1 text-sm text-content-muted">
              {{ t('components.guider.native.darks.maxExposure') }}
              <div class="relative">
                <input
                  v-model="maxExposure"
                  type="text"
                  inputmode="decimal"
                  class="tns-input pr-8 tabular-nums"
                />
                <span
                  class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs"
                  >s</span
                >
              </div>
            </label>
          </div>
          <label class="flex flex-col gap-1 text-sm text-content-muted">
            {{ t('components.guider.native.darks.frames') }}
            <input
              v-model="frames"
              type="text"
              inputmode="numeric"
              class="tns-input tabular-nums"
            />
          </label>

          <p v-if="validationError" class="text-sm text-status-danger">{{ validationError }}</p>

          <div class="flex gap-2">
            <button type="button" class="tns-btn-secondary" @click="showDialog = false">
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="tns-btn-primary"
              :disabled="Boolean(validationError) || starting"
              @click="start"
            >
              {{ t('components.guider.native.darks.start') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { canPerform } from '@/utils/nativeGuider';

const { t } = useI18n();
const store = useNativeGuiderStore();

const showDialog = ref(false);
const minExposure = ref('0.5');
const maxExposure = ref('4');
const frames = ref('5');
const starting = ref(false);
const cancelling = ref(false);

const libraryText = computed(() => store.status?.darkLibrary || '');
const darks = computed(() => store.darks);

const darksStatus = computed(() => String(darks.value?.status || '').toLowerCase());
const isRunning = computed(() => ['starting', 'capturing'].includes(darksStatus.value));

const canBuild = computed(
  () => !isRunning.value && canPerform('darks', store.state, { connected: store.isAvailable })
);

function parseNumber(text) {
  const value = Number(
    String(text ?? '')
      .trim()
      .replace(',', '.')
  );
  return Number.isFinite(value) ? value : NaN;
}

const validationError = computed(() => {
  const min = parseNumber(minExposure.value);
  const max = parseNumber(maxExposure.value);
  const count = parseNumber(frames.value);
  if (!(min > 0) || !(max >= min) || max > 60) {
    return t('components.guider.native.darks.invalidExposure');
  }
  if (!Number.isInteger(count) || count < 1 || count > 50) {
    return t('components.guider.native.darks.invalidFrames');
  }
  return '';
});

// Overall progress. index/total count exposures and frame/framesPerExposure the frames of the
// current exposure; both are treated as 1-based ("exposure 2 of 7, frame 3 of 5").
const progressPercent = computed(() => {
  const d = darks.value;
  if (!d) return null;
  if (darksStatus.value === 'done') return 100;
  const total = Number(d.total);
  const index = Number(d.index);
  if (!(total > 0) || !Number.isFinite(index)) return null;
  // index counts all dark frames (1-based, the one being captured), total = exposures x frames.
  const done = Math.max(0, index - 1);
  return Math.min(100, Math.max(0, (done / total) * 100));
});

const progressDetail = computed(() => {
  const d = darks.value;
  if (!d || !isRunning.value) return '';
  const parts = [];
  if (Number.isFinite(Number(d.exposure))) {
    parts.push(t('components.guider.native.darks.exposureDetail', { exposure: d.exposure }));
  }
  if (Number(d.framesPerExposure) > 0 && Number.isFinite(Number(d.frame))) {
    parts.push(
      t('components.guider.native.darks.frameDetail', {
        frame: d.frame,
        frames: d.framesPerExposure,
      })
    );
  }
  return parts.join(' · ');
});

const statusLabel = computed(() => {
  switch (darksStatus.value) {
    case 'starting':
      return t('components.guider.native.darks.statusStarting');
    case 'capturing':
      return t('components.guider.native.darks.statusCapturing');
    case 'done':
      return t('components.guider.native.darks.statusDone');
    case 'failed':
      return t('components.guider.native.darks.statusFailed');
    default:
      return darks.value?.status || '';
  }
});

const progressTone = computed(() => {
  if (darksStatus.value === 'done') return 'text-status-ok';
  if (darksStatus.value === 'failed') return 'text-status-danger';
  return 'text-accent';
});

const progressBarTone = computed(() => {
  if (darksStatus.value === 'done') return 'bg-status-ok';
  if (darksStatus.value === 'failed') return 'bg-status-danger';
  return 'bg-accent';
});

function openDialog() {
  if (!canBuild.value) return;
  showDialog.value = true;
}

async function start() {
  if (validationError.value || starting.value) return;
  starting.value = true;
  try {
    const ok = await store.buildDarks(
      {
        minExposure: parseNumber(minExposure.value),
        maxExposure: parseNumber(maxExposure.value),
        frames: parseNumber(frames.value),
      },
      { title: t('components.guider.native.darks.title') }
    );
    if (ok) showDialog.value = false;
  } finally {
    starting.value = false;
  }
}

async function cancel() {
  cancelling.value = true;
  try {
    await store.cancelDarks();
  } finally {
    cancelling.value = false;
  }
}
</script>
