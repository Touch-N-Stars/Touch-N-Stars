<template>
  <!-- Three columns on phones: four would clip longer labels (e.g. German "Kalibrieren"). -->
  <div
    class="tns-card p-2! grid grid-cols-3 gap-1.5"
    :class="showMark ? 'sm:grid-cols-7' : 'sm:grid-cols-6'"
  >
    <!-- The mount is on its way to the calibration position; Stop cancels the slew -->
    <p
      v-if="calibrationSlewRunning"
      class="col-span-full flex items-center gap-2 px-1 text-xs text-accent"
      role="status"
      data-testid="native-guider-calibration-slew"
    >
      <ArrowPathIcon class="w-4 h-4 shrink-0 animate-spin" />
      {{ t('components.guider.native.controls.calibrationSlewRunning') }}
    </p>

    <!-- Loop / Stop -->
    <button
      v-if="showLoop"
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('loop') || busy"
      @click="run('loop')"
    >
      <ArrowPathIcon class="w-5 h-5" :class="{ 'animate-spin': pending === 'loop' }" />
      {{ t('components.guider.native.controls.loop') }}
    </button>
    <button
      v-else
      type="button"
      class="tns-btn-danger flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('stop') || busy"
      @click="stop"
    >
      <StopIcon class="w-5 h-5" />
      {{ t('components.guider.native.controls.stop') }}
    </button>

    <!-- Guide (without a calibration it opens the calibrate dialog first) -->
    <button
      type="button"
      class="tns-btn-primary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('guide') || busy"
      @click="guide"
    >
      <PlayIcon class="w-5 h-5" :class="{ 'animate-pulse': pending === 'start-guiding' }" />
      {{ t('components.guider.native.controls.guide') }}
    </button>

    <!-- Force calibration -->
    <button
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('calibrate') || busy"
      @click="calibrate"
    >
      <ArrowsPointingOutIcon class="w-5 h-5" :class="{ 'animate-pulse': calibrationSlewRunning }" />
      {{ t('components.guider.native.controls.calibrate') }}
    </button>

    <!-- Pause / Resume -->
    <button
      v-if="store.state === 'Paused'"
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs! border-status-warn/60!"
      :disabled="!can('resume') || busy"
      @click="run('resume')"
    >
      <PlayPauseIcon class="w-5 h-5 text-status-warn" />
      {{ t('components.guider.native.controls.resume') }}
    </button>
    <button
      v-else
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('pause') || busy"
      @click="run('pause')"
    >
      <PauseIcon class="w-5 h-5" />
      {{ t('components.guider.native.controls.pause') }}
    </button>

    <!-- Dither -->
    <button
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('dither') || busy"
      @click="showDither = true"
    >
      <ArrowsRightLeftIcon class="w-5 h-5" />
      {{ t('components.guider.native.controls.dither') }}
    </button>

    <!-- Clear calibration -->
    <button
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="!can('clearCalibration') || busy"
      @click="clearCalibration"
    >
      <TrashIcon class="w-5 h-5" />
      {{ t('components.guider.native.controls.clearCalibration') }}
    </button>

    <!-- Mark incident (flight recorder): only while guiding or calibrating -->
    <button
      v-if="showMark"
      type="button"
      class="tns-btn-secondary flex-col gap-0.5! px-1! text-xs!"
      :disabled="marking"
      :title="t('components.guider.native.incidents.mark.title')"
      data-testid="native-guider-mark-incident"
      @click="openMark"
    >
      <FlagIcon class="w-5 h-5 text-status-danger" :class="{ 'animate-pulse': marking }" />
      {{ t('components.guider.native.incidents.mark.button') }}
    </button>

    <!-- Mark incident dialog: an optional one-line note -->
    <Modal :show="showMarkDialog" max-width="max-w-sm" @close="showMarkDialog = false">
      <template #header>
        <h2 class="text-lg font-bold">{{ t('components.guider.native.incidents.mark.title') }}</h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4 w-full">
          <p class="text-xs text-content-muted">
            {{ t('components.guider.native.incidents.mark.hint') }}
          </p>
          <label class="flex flex-col gap-1 text-sm text-content">
            {{ t('components.guider.native.incidents.mark.note') }}
            <input
              ref="markInput"
              v-model="markNote"
              type="text"
              maxlength="500"
              enterkeyhint="done"
              class="tns-input"
              :placeholder="t('components.guider.native.incidents.mark.placeholder')"
              @keyup.enter="mark"
            />
          </label>
          <div class="flex gap-2">
            <button type="button" class="tns-btn-secondary" @click="showMarkDialog = false">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="tns-btn-primary" :disabled="marking" @click="mark">
              {{ t('components.guider.native.incidents.mark.submit') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>

    <!-- Calibrate dialog (first calibration or recalibration): optionally slew to a calibration position first -->
    <Modal :show="showCalibrate" max-width="max-w-sm" @close="showCalibrate = false">
      <template #header>
        <h2 class="text-lg font-bold">
          {{
            t(
              recalibrating
                ? 'components.guider.native.controls.confirmCalibrateTitle'
                : 'components.guider.native.controls.calibrateTitle'
            )
          }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4 w-full">
          <p class="text-sm text-content">
            {{
              t(
                recalibrating
                  ? 'components.guider.native.controls.confirmCalibrate'
                  : 'components.guider.native.controls.calibrateMessage'
              )
            }}
          </p>
          <div class="flex flex-col gap-1.5">
            <span
              id="native-guider-calibration-slew-label"
              class="text-sm font-medium text-content"
            >
              {{ t('components.guider.native.controls.calibrationSlew') }}
            </span>
            <!-- The app's segmented control (as in PinsWifiCard): the choice is filled with the accent color -->
            <div
              class="grid grid-cols-2 gap-1 rounded-control bg-surface-1 border border-line p-1"
              role="radiogroup"
              aria-labelledby="native-guider-calibration-slew-label"
            >
              <button
                v-for="choice in SLEW_CHOICES"
                :key="choice"
                type="button"
                role="radio"
                class="min-h-touch rounded-chip px-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                :class="
                  calibrationSlew === choice
                    ? 'bg-accent-action text-white'
                    : 'text-content-muted hover:bg-surface-2'
                "
                :aria-checked="calibrationSlew === choice"
                :disabled="choice !== 'none' && !!mountBlocker"
                :data-testid="`native-guider-calibration-slew-${choice}`"
                @click="calibrationSlew = choice"
              >
                {{ t(`components.guider.native.controls.calibrationSlewChoices.${choice}`) }}
              </button>
            </div>
            <p v-if="mountBlocker" class="text-xs text-status-warn">
              {{ t(`components.guider.native.controls.${mountBlocker}`) }}
            </p>
            <p v-else class="text-xs text-content-muted">
              {{ t('components.guider.native.controls.calibrationSlewHint') }}
            </p>
          </div>
          <div class="flex gap-2">
            <button type="button" class="tns-btn-secondary" @click="showCalibrate = false">
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              class="tns-btn-primary"
              :disabled="busy"
              data-testid="native-guider-calibrate-confirm"
              @click="startCalibration"
            >
              {{ t('components.guider.native.controls.calibrate') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>

    <!-- Dither dialog -->
    <Modal :show="showDither" max-width="max-w-sm" @close="showDither = false">
      <template #header>
        <h2 class="text-lg font-bold">{{ t('components.guider.native.controls.ditherTitle') }}</h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4 w-full">
          <NumberInputPicker
            v-model="ditherPixels"
            :label="t('components.guider.native.controls.ditherPixels')"
            labelKey="components.guider.native.controls.ditherPixels"
            :min="0.1"
            :max="100"
            :step="0.1"
            :decimalPlaces="1"
            inputId="native-guider-dither-pixels"
          />
          <div class="flex items-center justify-between gap-3 text-sm text-content">
            <span>{{ t('components.guider.native.controls.ditherRaOnly') }}</span>
            <toggleButton v-model:statusValue="ditherRaOnly" />
          </div>
          <p class="text-xs text-content-muted">
            {{ t('components.guider.native.controls.ditherHint') }}
          </p>
          <div class="flex gap-2">
            <button type="button" class="tns-btn-secondary" @click="showDither = false">
              {{ t('common.cancel') }}
            </button>
            <button type="button" class="tns-btn-primary" :disabled="busy" @click="dither">
              {{ t('components.guider.native.controls.dither') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ArrowsRightLeftIcon,
  FlagIcon,
  PauseIcon,
  PlayIcon,
  PlayPauseIcon,
  StopIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import { canPerform } from '@/utils/nativeGuider';
import { kindText } from '@/utils/nativeGuiderIncidents';
import { readStored, writeStored } from '@/utils/safeStorage';

const { t, te } = useI18n();
const router = useRouter();
const store = useNativeGuiderStore();
const mainStore = apiStore();
const toastStore = useToastStore();

// States the flight recorder records in (and accepts a manual mark).
const RECORDING_STATES = ['Calibrating', 'Guiding', 'LostLock', 'Reacquiring', 'Paused'];
const showMarkDialog = ref(false);
const markNote = ref('');
const markInput = ref(null);
const marking = ref(false);
const showMark = computed(
  () =>
    store.isAvailable &&
    RECORDING_STATES.includes(store.state) &&
    store.incidentList?.enabled !== false
);

const showDither = ref(false);
const ditherPixels = ref(Number(readStored('nativeGuider.ditherPixels', '3')) || 3);
const ditherRaOnly = ref(readStored('nativeGuider.ditherRaOnly', 'false') === 'true');

// Slew before a recalibration: none, or to the calibration position on the mount's current side
// (stay) or on the east or west side of the sky.
const SLEW_CHOICES = ['none', 'stay', 'east', 'west'];
const showCalibrate = ref(false);
// Whether the open dialog replaces a calibration (fixed when it opens).
const recalibrating = ref(false);
const calibrationSlew = ref('none');
const calibrationSlewRunning = computed(() => store.summary.calibrationSlew === true);
/** Locale key of why the mount cannot slew, or null. */
const mountBlocker = computed(() => {
  if (!mainStore.mountInfo?.Connected) return 'calibrationSlewNoMount';
  if (mainStore.mountInfo.AtPark) return 'calibrationSlewParked';
  return null;
});

const pending = computed(() => store.pendingAction);
const busy = computed(() => !!store.pendingAction);
// While slewing to the calibration position the guider is stopped, but Stop cancels the slew.
const showLoop = computed(
  () =>
    !calibrationSlewRunning.value &&
    ['Stopped', 'Failed', 'Disconnected', 'Unknown'].includes(store.state)
);

function can(action) {
  return canPerform(action, store.state, {
    connected: store.isAvailable,
    isCalibrated: store.isCalibrated,
    calibrationSlew: calibrationSlewRunning.value,
  });
}

function confirm(titleKey, messageKey) {
  return toastStore.showConfirmation(
    t(titleKey),
    t(messageKey),
    t('common.confirm'),
    t('common.cancel')
  );
}

/**
 * Guider commands cancel a running Guiding Coach session (temporary settings are restored);
 * ask first. Resolves true when there is no session or the user agreed.
 */
async function confirmCoachInterrupt() {
  if (!store.coachRunning) return true;
  return confirm(
    'components.guider.native.coach.confirmInterruptTitle',
    'components.guider.native.coach.confirmInterrupt'
  );
}

async function run(action, params = {}) {
  if (!(await confirmCoachInterrupt())) return false;
  return store.runAction(action, params, {
    title: t('components.guider.native.controls.failed', {
      action: t(`components.guider.native.controls.actions.${action}`),
    }),
  });
}

async function stop() {
  const guiding = ['Guiding', 'Calibrating', 'Paused', 'LostLock', 'Reacquiring'].includes(
    store.state
  );
  if (
    !store.coachRunning &&
    guiding &&
    !(await confirm(
      'components.guider.native.controls.confirmStopTitle',
      'components.guider.native.controls.confirmStop'
    ))
  ) {
    return;
  }
  await run('stop');
}

/** Guides; without a calibration it asks first like Calibrate, so a slew can be chosen. */
async function guide() {
  if (!store.isCalibrated) {
    calibrate();
    return;
  }
  await run('start-guiding', { calibrate: false });
}

/** Asks first, also for the first calibration, and offers to slew to a calibration position. */
function calibrate() {
  recalibrating.value = store.isCalibrated;
  // No slew unless chosen each time: a slew moves the mount off the current target.
  calibrationSlew.value = 'none';
  showCalibrate.value = true;
}

async function startCalibration() {
  const slew = mountBlocker.value ? 'none' : calibrationSlew.value;
  showCalibrate.value = false;
  await run('start-guiding', slew === 'none' ? { calibrate: true } : { calibrate: true, slew });
}

async function clearCalibration() {
  if (
    !(await confirm(
      'components.guider.native.controls.confirmClearTitle',
      'components.guider.native.controls.confirmClear'
    ))
  ) {
    return;
  }
  await run('clear-calibration');
}

function openMark() {
  markNote.value = '';
  showMarkDialog.value = true;
  nextTick(() => markInput.value?.focus?.());
}

/** Toast once the marked incident is saved, with a Replay button (works from any page). */
function onMarkSaved(summary) {
  const id = summary?.id;
  const ms = Date.parse(summary?.start);
  toastStore.showToast({
    type: 'success',
    title: t('components.guider.native.incidents.savedTitle'),
    message: t('components.guider.native.incidents.savedMessage', {
      kind: kindText({ t, te }, summary?.kind || 'Manual'),
      time: Number.isFinite(ms) ? new Date(ms).toLocaleTimeString() : '',
    }),
    autoCloseDelay: 15000,
    actionText: t('components.guider.native.incidents.replayButton'),
    onAction: () => {
      store.openReplay(id);
      if (router.currentRoute.value.path !== '/guider') router.push('/guider');
    },
  });
}

async function mark() {
  if (marking.value) return;
  marking.value = true;
  try {
    const result = await store.markIncident(markNote.value.trim(), { onSaved: onMarkSaved });
    if (result.cancelled) return;
    showMarkDialog.value = false;
    toastStore.showToast(
      result.ok
        ? {
            type: 'info',
            title: t('components.guider.native.incidents.mark.title'),
            message: t('components.guider.native.incidents.mark.done'),
          }
        : {
            type: 'error',
            title: t('components.guider.native.incidents.mark.failed'),
            message: result.message,
          }
    );
  } finally {
    marking.value = false;
  }
}

async function dither() {
  // The picker keeps the amount within 0.1..100 pixels.
  const pixels = Number(ditherPixels.value);
  writeStored('nativeGuider.ditherPixels', pixels);
  writeStored('nativeGuider.ditherRaOnly', ditherRaOnly.value);
  showDither.value = false;
  await run('dither', { pixels, raOnly: ditherRaOnly.value });
}
</script>
