<template>
  <!-- Trigger Button — v-bind="$attrs" forwards positioning classes (fixed, right-*, z-*) from parent -->
  <div
    v-if="variant === 'fab'"
    v-bind="$attrs"
    :class="props.showBadgeLabel ? 'relative pb-3' : ''"
  >
    <button
      @click="start"
      class="p-2 bg-surface-3 border border-accent-action rounded-full shadow-md z-10"
      :title="$t('components.fitsPlatesolve.buttonTitle')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="w-6 h-6 text-white"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="12" x2="12" y2="16.5" />
        <line x1="9.5" y1="14" x2="14.5" y2="14" />
        <circle cx="12" cy="14" r="3.2" />
      </svg>
    </button>
    <span
      v-if="props.showBadgeLabel"
      class="absolute left-1/2 -translate-x-1/2 top-[calc(100%-20px)] text-[8.5px] font-semibold text-white/80 text-center leading-tight bg-surface-1/60 border border-line-strong/30 rounded px-1 py-0.5 whitespace-nowrap"
    >
      Solve
    </span>
  </div>
  <button
    v-else-if="variant === 'button'"
    v-bind="$attrs"
    type="button"
    class="tns-btn-secondary"
    @click="start"
  >
    <DocumentMagnifyingGlassIcon class="w-5 h-5 shrink-0" />
    <span>{{ $t('components.fitsPlatesolve.buttonTitle') }}</span>
  </button>
  <button
    v-else
    v-bind="$attrs"
    @click="start"
    class="flex items-center gap-1 px-2 py-1 bg-surface-3/60 border border-line-strong rounded text-xs text-content hover:bg-surface-3"
    :title="$t('components.fitsPlatesolve.buttonTitle')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      class="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="12" x2="12" y2="16.5" />
      <line x1="9.5" y1="14" x2="14.5" y2="14" />
      <circle cx="12" cy="14" r="3.2" />
    </svg>
  </button>

  <!-- File Browser (FITS files only) -->
  <FileBrowser
    v-model="showBrowser"
    :title="$t('components.fitsPlatesolve.browserTitle')"
    mode="file"
    :fileExtensions="['fits', 'fit', 'fts']"
    @select="onFileSelected"
  />

  <!-- Main Modal -->
  <Modal
    :show="showModal"
    max-width="max-w-2xl"
    z-index="z-top"
    :disable-close="step === 'solving'"
    :close-on-backdrop-click="step !== 'solving'"
    @close="onCancel"
  >
    <template #header>
      <span class="text-base font-semibold text-content tracking-wide">{{ modalTitle }}</span>
    </template>

    <template #body>
      <div class="w-full">
        <!-- Loading params -->
        <div
          v-if="step === 'loading_params'"
          class="flex flex-col items-center justify-center gap-3 py-8"
        >
          <span
            class="w-8 h-8 border-2 border-line-strong border-t-accent-action rounded-full animate-spin"
          ></span>
          <span class="text-content-muted text-sm">{{
            $t('components.fitsPlatesolve.loadingParams')
          }}</span>
        </div>

        <!-- Parameter Confirmation Form -->
        <div v-else-if="step === 'confirm'" class="flex flex-col gap-4">
          <!-- File path display -->
          <div class="rounded-md bg-surface-1/60 px-3 py-2">
            <span class="text-xs text-content-faint">{{
              $t('components.fitsPlatesolve.file')
            }}</span>
            <p class="text-xs text-content-muted font-mono truncate mt-0.5">{{ selectedFile }}</p>
          </div>

          <!-- Fields -->
          <div class="space-y-3">
            <!-- Focal Length -->
            <div class="flex items-center gap-3">
              <label class="text-xs text-content-muted w-28 shrink-0">{{
                $t('components.fitsPlatesolve.focalLength')
              }}</label>
              <NumberInputPicker
                v-model="form.focalLength"
                label-key="components.fitsPlatesolve.focalLength"
                :min="1"
                :max="10000"
                :step="1"
                :decimal-places="0"
                input-id="focalLength"
                wrapper-class="flex-1"
              />
              <span class="text-xs text-content-faint shrink-0 w-6">mm</span>
            </div>

            <!-- Pixel Size -->
            <div class="flex items-center gap-3">
              <label class="text-xs text-content-muted w-28 shrink-0">{{
                $t('components.fitsPlatesolve.pixelSize')
              }}</label>
              <NumberInputPicker
                v-model="form.pixelSize"
                label-key="components.fitsPlatesolve.pixelSize"
                :min="0.1"
                :max="100"
                :step="0.1"
                :decimal-places="2"
                input-id="pixelSize"
                wrapper-class="flex-1"
              />
              <span class="text-xs text-content-faint shrink-0 w-6">µm</span>
            </div>

            <!-- Binning -->
            <div class="flex items-center gap-3">
              <label class="text-xs text-content-muted w-28 shrink-0">{{
                $t('components.fitsPlatesolve.binning')
              }}</label>
              <NumberInputPicker
                v-model="form.binning"
                label-key="components.fitsPlatesolve.binning"
                :min="1"
                :max="4"
                :step="1"
                :decimal-places="0"
                input-id="binning"
                wrapper-class="flex-1"
              />
              <span class="text-xs text-content-faint shrink-0 w-6">×</span>
            </div>

            <!-- Separator -->
            <div class="border-t border-line pt-2">
              <p class="text-xs text-content-faint mb-3">
                {{ $t('components.fitsPlatesolve.coordinatesHint') }}
              </p>
            </div>

            <!-- RA -->
            <div class="flex items-start gap-3">
              <label class="text-xs text-content-muted w-28 shrink-0 pt-2">{{
                $t('components.fitsPlatesolve.ra')
              }}</label>
              <div class="flex-1 flex flex-col xs:flex-row items-stretch xs:items-center gap-1">
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.raH"
                    label-key="components.fitsPlatesolve.ra"
                    :min="0"
                    :max="23"
                    :step="1"
                    :decimal-places="0"
                    input-id="raH"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">h</span>
                </div>
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.raM"
                    label-key="components.fitsPlatesolve.ra"
                    :min="0"
                    :max="59"
                    :step="1"
                    :decimal-places="0"
                    input-id="raM"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">m</span>
                </div>
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.raS"
                    label-key="components.fitsPlatesolve.ra"
                    :min="0"
                    :max="59.99"
                    :step="0.01"
                    :decimal-places="2"
                    input-id="raS"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">s</span>
                </div>
              </div>
            </div>

            <!-- Dec -->
            <div class="flex items-start gap-3">
              <label class="text-xs text-content-muted w-28 shrink-0 pt-2">{{
                $t('components.fitsPlatesolve.dec')
              }}</label>
              <div class="flex-1 flex flex-col xs:flex-row items-stretch xs:items-center gap-1">
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.decD"
                    label-key="components.fitsPlatesolve.dec"
                    :min="-90"
                    :max="90"
                    :step="1"
                    :decimal-places="0"
                    input-id="decD"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">°</span>
                </div>
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.decM"
                    label-key="components.fitsPlatesolve.dec"
                    :min="0"
                    :max="59"
                    :step="1"
                    :decimal-places="0"
                    input-id="decM"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">'</span>
                </div>
                <div class="flex-1 flex items-center gap-1">
                  <NumberInputPicker
                    v-model="form.decS"
                    label-key="components.fitsPlatesolve.dec"
                    :min="0"
                    :max="59.99"
                    :step="0.01"
                    :decimal-places="2"
                    input-id="decS"
                    wrapper-class="w-full"
                  />
                  <span class="text-xs text-content-faint shrink-0">"</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2 pt-2 border-t border-line">
            <button class="tns-btn-secondary" @click="onCancel">
              {{ $t('common.cancel') }}
            </button>
            <button class="tns-btn-secondary" @click="solve(true)">
              {{ $t('components.fitsPlatesolve.blindSolve') }}
            </button>
            <button
              class="tns-btn-primary"
              :disabled="!form.focalLength || !form.pixelSize"
              @click="solve(false)"
            >
              {{ $t('components.fitsPlatesolve.plateSolve') }}
            </button>
          </div>
        </div>

        <!-- Solving -->
        <div
          v-else-if="step === 'solving'"
          class="flex flex-col items-center justify-center gap-3 py-8"
        >
          <span
            class="w-10 h-10 border-2 border-line-strong border-t-accent-action rounded-full animate-spin"
          ></span>
          <span class="text-content text-sm font-medium">{{
            $t('components.fitsPlatesolve.solving')
          }}</span>
          <span class="text-content-faint text-xs text-center max-w-[280px]">{{
            $t('components.fitsPlatesolve.solvingHint')
          }}</span>
        </div>

        <!-- Result -->
        <div v-else-if="step === 'result'" class="flex flex-col gap-4">
          <!-- Success banner -->
          <div class="flex items-center gap-2.5 rounded-md bg-status-ok/15 px-3 py-2">
            <div class="w-2 h-2 rounded-full bg-status-ok shrink-0"></div>
            <span class="text-status-ok text-sm font-medium">{{
              $t('components.fitsPlatesolve.success')
            }}</span>
          </div>

          <!-- Result details -->
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-xs text-content-faint">{{
                $t('components.fitsPlatesolve.ra')
              }}</span>
              <span class="text-sm text-accent font-mono">{{ result?.raString }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-content-faint">{{
                $t('components.fitsPlatesolve.dec')
              }}</span>
              <span class="text-sm text-accent font-mono">{{ result?.decString }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-content-faint">{{
                $t('components.fitsPlatesolve.rotation')
              }}</span>
              <span class="text-sm text-accent font-mono">{{ result?.rotation?.toFixed(2) }}°</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-content-faint">{{
                $t('components.fitsPlatesolve.pixelScale')
              }}</span>
              <span class="text-sm text-accent font-mono"
                >{{ result?.pixelScale?.toFixed(3) }}"</span
              >
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-col gap-2 pt-2 border-t border-line">
            <SaveFavTargets
              class="w-full"
              name="FITS Plate Solve"
              :ra="result.ra"
              :dec="result.dec"
              :ra-string="result.raString"
              :dec-string="result.decString"
              :rotation="result.rotation ?? 0"
              :show-label="true"
            />
            <button
              class="tns-btn-primary w-full flex items-center gap-2"
              :title="
                showSeqTarget
                  ? $t('components.framing.setSequnceTarget')
                  : $t('components.fitsPlatesolve.useAsTarget')
              "
              @click="useAsTarget"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{
                showSeqTarget
                  ? $t('components.framing.setSequnceTarget')
                  : $t('components.fitsPlatesolve.useAsTarget')
              }}
            </button>
          </div>
        </div>

        <!-- Error -->
        <div v-else-if="step === 'error'" class="flex flex-col gap-4">
          <!-- Error banner -->
          <div class="flex items-center gap-2.5 rounded-md bg-status-danger/15 px-3 py-2">
            <div class="w-2 h-2 rounded-full bg-status-danger shrink-0"></div>
            <span class="text-status-danger text-sm font-medium">{{
              $t('components.fitsPlatesolve.error')
            }}</span>
          </div>
          <p v-if="errorMessage" class="text-content-muted text-sm leading-relaxed">
            {{ errorMessage }}
          </p>
          <div class="flex justify-end gap-2 pt-2 border-t border-line">
            <button class="tns-btn-secondary" @click="onCancel">
              {{ $t('common.close') }}
            </button>
            <button class="tns-btn-primary" @click="start">
              {{ $t('components.fitsPlatesolve.tryAgain') }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue';

// Multiple root nodes (button + FileBrowser + Teleport) = fragment → Vue won't auto-inherit attrs.
// We manually forward them to the button so positioning classes from the parent work.
defineOptions({ inheritAttrs: false });
import { useI18n } from 'vue-i18n';
import FileBrowser from '@/components/helpers/fileBrowser.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Modal from '@/components/helpers/Modal.vue';
import { DocumentMagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import SaveFavTargets from '@/components/favTargets/SaveFavTargets.vue';
import { useFramingStore } from '@/store/framingStore';
import { degreesToHMS, degreesToDMS } from '@/utils/utils';
import { useSequenceStore } from '@/store/sequenceStore';
import { useToastStore } from '@/store/toastStore';
import apiService from '@/services/apiService';
import { positionAngleFromFitsAnalysis } from '@/integrations/celestiaAtlas/positionAngle';

const { t } = useI18n();
const framingStore = useFramingStore();
const sequenceStore = useSequenceStore();
const toastStore = useToastStore();

const props = defineProps({
  showFraming: { type: Boolean, default: true },
  showSeqTarget: { type: Boolean, default: false },
  showBadgeLabel: { type: Boolean, default: false },
  variant: { type: String, default: 'fab' }, // 'fab' = floating cyan circle | 'inline' = slate row button | 'button' = labelled tns-btn-secondary
});

const emit = defineEmits(['solved']);

const hasSequenceLoaded = computed(
  () =>
    sequenceStore.sequenceIsLoaded &&
    Array.isArray(sequenceStore.sequenceInfo) &&
    sequenceStore.sequenceInfo.length > 0
);

// State machine steps: idle | browsing | loading_params | confirm | solving | result | error
const step = ref('idle');
const showBrowser = ref(false);
const selectedFile = ref('');

const form = ref({
  focalLength: null,
  pixelSize: null,
  binning: 1,
  raH: null,
  raM: null,
  raS: null,
  decD: null,
  decM: null,
  decS: null,
  ra: null,
  dec: null,
});

const result = ref(null);
const errorMessage = ref('');

const showModal = computed(() =>
  ['loading_params', 'confirm', 'solving', 'result', 'error'].includes(step.value)
);

const modalTitle = computed(() => {
  switch (step.value) {
    case 'loading_params':
      return t('components.fitsPlatesolve.titleLoading');
    case 'confirm':
      return t('components.fitsPlatesolve.titleConfirm');
    case 'solving':
      return t('components.fitsPlatesolve.titleSolving');
    case 'result':
      return t('components.fitsPlatesolve.titleResult');
    case 'error':
      return t('components.fitsPlatesolve.titleError');
    default:
      return '';
  }
});

function start() {
  result.value = null;
  errorMessage.value = '';
  step.value = 'browsing';
  showBrowser.value = true;
}

async function onFileSelected(path) {
  selectedFile.value = path;
  step.value = 'loading_params';

  try {
    const params = await apiService.getFitsParameters(path);
    if (!params?.Success) {
      const serverMsg = params?.Error;
      const isGenericNetworkError =
        !serverMsg || /request failed|connection failed/i.test(serverMsg);
      throw new Error(isGenericNetworkError ? '' : serverMsg);
    }

    const raParts = parseRaToParts(params.RaString ?? '');
    const decParts = parseDecToParts(params.DecString ?? '');
    form.value = {
      focalLength: params.FocalLength ?? null,
      pixelSize: params.PixelSize ?? null,
      binning: params.Binning ?? 1,
      raH: raParts.h,
      raM: raParts.m,
      raS: raParts.s,
      decD: decParts.d,
      decM: decParts.m,
      decS: decParts.s,
      ra: params.Ra ?? null,
      dec: params.Dec ?? null,
    };

    if (params.HasWcs) {
      // Already solved — run analyze to get full result data
      await solve(false);
    } else {
      step.value = 'confirm';
    }
  } catch (e) {
    errorMessage.value = e?.message || t('components.fitsPlatesolve.errorLoadParams');
    step.value = 'error';
  }
}

// Parse "HH:MM:SS" string (from FITS header) into individual parts
function parseRaToParts(str) {
  if (!str) return { h: null, m: null, s: null };
  const parts = str.split(':').map(Number);
  if (parts.length === 3 && !parts.some(isNaN)) return { h: parts[0], m: parts[1], s: parts[2] };
  return { h: null, m: null, s: null };
}

// Parse Dec string from FITS header into individual parts.
// Handles both "DD:MM:SS" and the API format "41° 16' 07\"" (with optional leading +/-).
function parseDecToParts(str) {
  if (!str) return { d: null, m: null, s: null };

  // "DD:MM:SS" or "+/-DD:MM:SS"
  const colonMatch = str.match(/^([+-]?\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (colonMatch) {
    return { d: Number(colonMatch[1]), m: Number(colonMatch[2]), s: Number(colonMatch[3]) };
  }

  // "41° 16' 07\"" or "-41° 16' 07\""
  const dmsMatch = str.match(/^([+-]?\d+)°\s*(\d+)'\s*(\d+(?:\.\d+)?)/);
  if (dmsMatch) {
    return { d: Number(dmsMatch[1]), m: Number(dmsMatch[2]), s: Number(dmsMatch[3]) };
  }

  return { d: null, m: null, s: null };
}

function isValid(v) {
  return v !== null && v !== undefined && v !== -1 && !isNaN(v);
}

async function solve(blind) {
  step.value = 'solving';
  try {
    const body = {
      path: selectedFile.value,
      focalLength: form.value.focalLength,
      pixelSize: form.value.pixelSize,
      binning: form.value.binning,
      blindSolve: blind,
    };

    if (!blind) {
      if (isValid(form.value.raH)) {
        body.ra =
          ((form.value.raH ?? 0) + (form.value.raM ?? 0) / 60 + (form.value.raS ?? 0) / 3600) * 15;
      }
      if (isValid(form.value.decD)) {
        const sign = form.value.decD < 0 ? -1 : 1;
        body.dec =
          sign *
          (Math.abs(form.value.decD) + (form.value.decM ?? 0) / 60 + (form.value.decS ?? 0) / 3600);
      }
    }

    const data = await apiService.analyzeFits(body);
    const success = data?.Success ?? data?.success;
    if (!success) {
      const serverMsg = data?.Error || data?.error;
      const isGenericNetworkError =
        !serverMsg || /request failed|connection failed/i.test(serverMsg);
      throw new Error(isGenericNetworkError ? '' : serverMsg);
    }

    // Normalize PascalCase → camelCase for result display
    result.value = {
      ra: data.Ra ?? data.ra,
      dec: data.Dec ?? data.dec,
      raString: data.RaString ?? data.raString,
      decString: data.DecString ?? data.decString,
      rotation: data.Rotation ?? data.rotation,
      pixelScale: data.PixelScale ?? data.pixelScale,
      solvedFromWcs: data.SolvedFromWcs ?? data.solvedFromWcs ?? false,
    };
    const positionAngle = positionAngleFromFitsAnalysis(result.value);
    if (positionAngle === null) {
      throw new Error(t('components.fitsPlatesolve.solveFailed'));
    }
    // Write coordinates into framingStore exactly like selectTarget() in TargetSearch.vue.
    // Use degreesToHMS/DMS so slewAndCenter.vue can parse the strings correctly —
    // the API DecString uses "41° 16' 07\"" format which dmsToDegrees cannot handle.
    framingStore.RAangle = result.value.ra;
    framingStore.DECangle = result.value.dec;
    framingStore.RAangleString = degreesToHMS(result.value.ra);
    framingStore.DECangleString = degreesToDMS(result.value.dec);
    framingStore.rotationAngle = positionAngle;
    framingStore.isMosaicMode = false;
    framingStore.selectedItem = {
      Name: 'FITS Plate Solve',
      RA: result.value.ra,
      Dec: result.value.dec,
    };
    framingStore.framingReloadKey++;
    step.value = 'result';
  } catch (e) {
    errorMessage.value = e?.message || t('components.fitsPlatesolve.solveFailed');
    step.value = 'error';
  }
}

async function useAsTarget() {
  if (!result.value) return;

  if (props.showFraming) {
    // framingStore is already populated when the result arrived — nothing extra to do.
    toastStore.showToast({
      type: 'success',
      title: t('components.fitsPlatesolve.targetApplied'),
      message: `${result.value.raString} / ${result.value.decString}`,
    });
  }

  if (props.showSeqTarget) {
    if (!hasSequenceLoaded.value) {
      toastStore.showToast({
        type: 'error',
        title: t('components.fav_target.modal_sequence.titel'),
        message: t('components.fav_target.modal_sequence_error.message'),
      });
      return;
    }
    try {
      await apiService.sequnceTargetSet(
        'FITS Plate Solve',
        result.value.ra,
        result.value.dec,
        result.value.rotation ?? 0,
        0
      );
      toastStore.showToast({
        type: 'success',
        title: t('components.fav_target.modal_sequence.titel'),
        message: t('components.fav_target.modal_sequence_ok.message'),
      });
    } catch (error) {
      toastStore.showToast({
        type: 'error',
        title: t('components.fav_target.modal_sequence.titel'),
        message:
          error?.response?.data?.Message || t('components.fav_target.modal_sequence_error.message'),
      });
      return;
    }
  }

  emit('solved', { ...result.value });
  step.value = 'idle';
}

function onCancel() {
  step.value = 'idle';
  result.value = null;
  errorMessage.value = '';
}
</script>
