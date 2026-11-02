<template>
  <Modal
    :show="true"
    zIndex="z-50"
    maxWidth="max-w-lg"
    :disableClose="isActive"
    :closeOnBackdropClick="false"
    @close="emit('close')"
  >
    <template #header>
      <h2 class="text-xl font-bold">{{ $t(`${base}.title`) }}</h2>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 w-full self-start">
        <!-- Step 0: prerequisites, exposure length, sequence notice and confirmations -->
        <template v-if="step === 'checks'">
          <p class="text-sm text-content">{{ $t(`${base}.intro`) }}</p>

          <ul v-if="blockers.length" class="flex flex-col gap-2">
            <li
              v-for="blocker in blockers"
              :key="blocker"
              class="flex items-start gap-2 text-sm text-status-danger"
            >
              <span class="tns-dot bg-status-danger mt-1.5"></span>
              {{ $t(`${base}.blockers.${blocker}`) }}
            </li>
          </ul>
          <ButtonUnpark v-if="store.mountIsParked" />

          <NumberInputPicker
            v-model="exposureSeconds"
            inputId="flip-test-exposure"
            labelKey="components.mount.settings.meridian_flip.dayTest.exposure"
            :label="$t(`${base}.exposure`)"
            :helpMessage="$t(`${base}.exposureHelp`)"
            :min="10"
            :max="1800"
            :step="10"
            :useDefaultSentinel="false"
            labelPosition="top"
            wrapperClass="w-full"
          />
          <p class="text-sm text-content-muted">
            {{
              $t(`${base}.plan`, {
                minutes: plan.expectedMinutes,
                flip: formatMinutes(plan.latestFlipMinutes),
              })
            }}
          </p>

          <p class="text-sm text-status-warn">{{ $t(`${base}.sequenceNotice`) }}</p>

          <label class="flex items-start gap-3 min-h-touch cursor-pointer">
            <input v-model="capsConfirmed" type="checkbox" class="mt-1 w-5 h-5 shrink-0" />
            <span class="flex flex-col gap-1">
              <span class="font-semibold text-content">{{ $t(`${base}.caps.label`) }}</span>
              <span class="text-sm text-content-muted">{{ $t(`${base}.caps.reason`) }}</span>
            </span>
          </label>
          <div class="pl-8">
            <button
              type="button"
              class="text-sm text-accent underline min-h-touch"
              data-haptic="none"
              @click="showCapsDetails = !showCapsDetails"
            >
              {{ $t(`${base}.caps.whyTitle`) }}
            </button>
            <p v-if="showCapsDetails" class="text-sm text-content-muted italic">
              {{ $t(`${base}.caps.whyText`) }}
            </p>
          </div>

          <label class="flex items-start gap-3 min-h-touch cursor-pointer">
            <input v-model="presenceConfirmed" type="checkbox" class="mt-1 w-5 h-5 shrink-0" />
            <span class="flex flex-col gap-1">
              <span class="font-semibold text-content">{{ $t(`${base}.presence.label`) }}</span>
              <span class="text-sm text-content-muted">{{ $t(`${base}.presence.reason`) }}</span>
            </span>
          </label>

          <button class="tns-btn-primary" :disabled="!canStart" @click="startPositioning">
            {{ $t(`${base}.toPositioning`) }}
          </button>
        </template>

        <!-- Step 1: the user drives the scope just east of the meridian. No goto: a mount
             with a preferred pier side would take the post-flip side for it. -->
        <template v-else-if="step === 'positioning'">
          <p class="text-sm text-content">{{ $t(`${base}.position.hint`) }}</p>

          <div v-if="startCheck" class="flex flex-col gap-1">
            <p class="text-sm text-content-muted">
              {{
                $t(
                  startCheck.minutesToMeridian >= 0
                    ? `${base}.position.toMeridian`
                    : `${base}.position.pastMeridian`
                )
              }}
            </p>
            <p class="text-3xl font-bold text-content tabular-nums">
              {{ formatClock(Math.abs(startCheck.minutesToMeridian)) }}
            </p>
            <p v-if="startCheck.minutesToFlip >= 0" class="text-sm text-content-muted">
              {{
                $t(`${base}.countdownWindow`, {
                  earliest: formatClock(startCheck.minutesToFlip),
                  latest: formatClock(startCheck.minutesToMeridian + plan.latestFlipMinutes),
                })
              }}
            </p>
          </div>
          <p v-else class="text-sm text-status-warn">{{ $t(`${base}.position.noData`) }}</p>

          <ul v-if="startCheck" class="flex flex-col gap-2">
            <li
              v-for="item in startChecklist"
              :key="item.key"
              class="flex items-start gap-2 text-sm"
              :class="checkClass(item.ok)"
            >
              <span class="tns-dot mt-1.5" :class="checkDotClass(item.ok)"></span>
              {{ item.text }}
            </li>
          </ul>

          <div v-if="startCheck?.pierOk === false" class="flex flex-col gap-2">
            <p class="text-sm text-status-warn">{{ $t(`${base}.position.moves.wrongSide`) }}</p>
            <ButtonHome />
          </div>
          <template v-else>
            <ul v-if="moveHints.length" class="flex flex-col gap-1">
              <li
                v-for="hint in moveHints"
                :key="hint.key"
                class="flex items-start gap-2 text-sm text-status-warn"
              >
                <span class="font-bold w-4 shrink-0 text-center">{{ hint.arrow }}</span>
                {{ hint.text }}
              </li>
            </ul>
            <p v-if="skyMoves.nearPole" class="text-sm text-content-muted">
              {{ $t(`${base}.position.poleHint`) }}
            </p>
          </template>

          <moveAxis compact :highlight="highlightButtons" />

          <button class="tns-btn-primary" :disabled="!positionReady" @click="startTest">
            {{ $t(`${base}.start`) }}
          </button>
          <button class="tns-btn-secondary" @click="step = 'checks'">
            {{ $t(`${base}.back`) }}
          </button>
        </template>

        <!-- Running: NINA drives, the app shows where the mount is and can stop it -->
        <template v-else-if="step === 'starting' || step === 'running'">
          <p class="text-sm text-content flex items-center gap-2">
            <span
              class="w-5 h-5 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
            ></span>
            {{ statusText }}
          </p>
          <p v-if="countdownText" class="text-2xl font-bold text-content tabular-nums">
            {{ countdownText }}
          </p>
          <p class="text-xs text-content-muted">{{ $t(`${base}.runningHint`) }}</p>
          <button class="tns-btn-danger min-h-20! text-lg!" @click="stopTest">
            {{ $t(`${base}.stop`) }}
          </button>
        </template>

        <!-- The person at the mount judges the result -->
        <template v-else-if="step === 'ask'">
          <p class="text-base font-semibold text-content">{{ $t(`${base}.askQuestion`) }}</p>
          <div class="flex gap-2">
            <button class="tns-btn-primary flex-1" @click="answer(true)">
              {{ $t(`${base}.yes`) }}
            </button>
            <button class="tns-btn-secondary flex-1" @click="answer(false)">
              {{ $t(`${base}.no`) }}
            </button>
          </div>
        </template>

        <template v-else-if="step === 'result'">
          <p
            class="text-base font-semibold"
            :class="userSaysOk ? 'text-status-ok' : 'text-status-warn'"
          >
            {{ $t(userSaysOk ? `${base}.resultOk` : `${base}.resultProblem`) }}
          </p>
          <p v-if="!userSaysOk" class="text-sm text-content">{{ $t(`${base}.problemAdvice`) }}</p>
          <p v-if="flipAtMinutes !== null" class="text-sm text-content-muted">
            {{ $t(`${base}.flippedAt`, { minutes: formatMinutes(flipAtMinutes) }) }}
          </p>
          <p v-if="flipReport?.failed" class="text-sm text-status-warn">
            {{
              $t(`${base}.ninaError`, {
                step: $t(`${base}.steps.${flipReport.failedStep}`),
              })
            }}
            <template v-if="flipReport.failedStep === 'recenter'">
              {{ $t(`${base}.ninaErrorRecenterCaps`) }}
            </template>
          </p>
          <p v-else-if="flipReport?.found" class="text-sm text-status-ok">
            {{ $t(`${base}.ninaOk`) }}
          </p>
          <p v-if="pierOutcome === 'changed'" class="text-sm text-content-muted">
            {{
              $t(`${base}.pierChanged`, {
                before: sideLabel(pierBefore),
                after: sideLabel(pierAfter),
              })
            }}
          </p>
          <p class="text-xs text-content-muted">{{ $t(`${base}.notTested`) }}</p>
          <ButtonPark />
          <button class="tns-btn-secondary" @click="emit('close')">
            {{ $t('common.close') }}
          </button>
        </template>

        <template v-else-if="step === 'noFlip' || step === 'stopped' || step === 'failed'">
          <p class="text-sm" :class="step === 'stopped' ? 'text-content' : 'text-status-danger'">
            {{ endText }}
          </p>
          <p v-if="step === 'noFlip'" class="text-sm text-content">
            {{ $t(`${base}.noFlipAdvice`) }}
          </p>
          <ButtonPark v-if="step !== 'failed'" />
          <button class="tns-btn-secondary" @click="emit('close')">
            {{ $t('common.close') }}
          </button>
        </template>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/helpers/Modal.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ButtonHome from '@/components/mount/ButtonHome.vue';
import ButtonPark from '@/components/mount/ButtonPark.vue';
import ButtonUnpark from '@/components/mount/ButtonUnpark.vue';
import moveAxis from '@/components/mount/moveAxis.vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useMeridianFlipTestStore } from '@/store/meridianFlipTestStore';
import { useMountStore } from '@/store/mountStore';
import { useToastStore } from '@/store/toastStore';
import { isBackendRefusal } from '@/utils/backendErrors';
import { getSunEquatorial } from '@/utils/astronomy';
import { createPoller } from '@/utils/poller';
import {
  FLIP_TEST_MIN_ALTITUDE_DEG,
  FLIP_TEST_MIN_SUN_SEPARATION_DEG,
  analyzeFlipLog,
  buttonForSkyMove,
  checkStartPosition,
  comparePierSides,
  flipTriggerStatus,
  hourAngleHours,
  isSequenceRunning,
  observedAxisSense,
  planFlipTest,
  suggestSkyMoves,
} from '@/utils/meridianFlipDayTest';
import { isPierSideKnown } from '@/utils/meridianFlipPresets';
import { buildFlipTestSequence } from '@/utils/meridianFlipTestSequence';

const emit = defineEmits(['close']);

const base = 'components.mount.settings.meridian_flip.dayTest';
const { t } = useI18n();
const store = apiStore();
const mountStore = useMountStore();
const flipTestStore = useMeridianFlipTestStore();
const toastStore = useToastStore();

// checks -> positioning -> starting -> running -> ask -> result
// side exits: noFlip, stopped, failed
const step = ref('checks');
const exposureSeconds = ref(60);
const capsConfirmed = ref(false);
const presenceConfirmed = ref(false);
const showCapsDetails = ref(false);
const sequenceBusy = ref(false);
const pierBefore = ref('');
const pierAfter = ref('');
const flipAtMinutes = ref(null);
const flipReport = ref(null);
const userSaysOk = ref(false);
const endText = ref('');
let startedAt = 0;
// Plan for the actual start point, fixed when the test starts.
let runPlan = null;
// Set once NINA's flip trigger is seen RUNNING (or the pier side has changed).
const flipStarted = ref(false);

const flipSettings = computed(() => store.profileInfo?.MeridianFlipSettings ?? {});
const plan = computed(() => planFlipTest(flipSettings.value, exposureSeconds.value));
const isActive = computed(() => step.value === 'starting' || step.value === 'running');

const blockers = computed(() => {
  const mount = store.mountInfo;
  if (!mount?.Connected) return ['notConnected'];
  const list = [];
  if (mount.AtPark) list.push('parked');
  if (!mount.CanSlew) list.push('cannotSlew');
  if (!mount.SiteLatitude && !mount.SiteLongitude) list.push('noLocation');
  if (sequenceBusy.value) list.push('sequenceRunning');
  return list;
});

const canStart = computed(
  () => blockers.value.length === 0 && capsConfirmed.value && presenceConfirmed.value
);

// Live check of the position the user drives the scope to.
const startCheck = computed(() => {
  const m = store.mountInfo;
  return checkStartPosition({
    lstHours: m?.SiderealTime,
    raHours: m?.RightAscension,
    decDeg: m?.Declination,
    latDeg: m?.SiteLatitude,
    sideOfPier: m?.SideOfPier,
    sun: getSunEquatorial(new Date()),
    plan: plan.value,
  });
});

const startChecklist = computed(() => {
  const check = startCheck.value;
  if (!check) return [];
  const pierKey = check.pierOk === null ? 'pierUnknown' : 'pier';
  return [
    {
      key: 'lead',
      ok: check.leadOk,
      text: t(`${base}.position.checks.lead`, { minutes: formatMinutes(plan.value.leadMinutes) }),
    },
    { key: 'pier', ok: check.pierOk, text: t(`${base}.position.checks.${pierKey}`) },
    {
      key: 'altitude',
      ok: check.altitudeOk,
      text: t(`${base}.position.checks.altitude`, { degrees: FLIP_TEST_MIN_ALTITUDE_DEG }),
    },
    {
      key: 'sun',
      ok: check.sunOk,
      text: t(`${base}.position.checks.sun`, { degrees: FLIP_TEST_MIN_SUN_SEPARATION_DEG }),
    },
  ];
});

// Sky direction each button moves, learned while the user holds it: 1 as labelled, -1
// reversed. Starts from the profile's axis reversal, which NINA applies to manual moves.
const raSense = ref(store.profileInfo?.TelescopeSettings?.PrimaryReversed ? -1 : 1);
const decSense = ref(store.profileInfo?.TelescopeSettings?.SecondaryReversed ? -1 : 1);
// First sample of the current press; compared against later ones until a verdict, so a
// slow rate still adds up to a measurable move across the fast polls.
let lastMoveSample = null;

watch(
  () => store.mountInfo,
  (m) => {
    const button = mountStore.lastDirection;
    if (step.value !== 'positioning' || !button || !m) {
      lastMoveSample = null;
      return;
    }
    if (![m.SiderealTime, m.RightAscension, m.Declination].every(Number.isFinite)) return;
    const sample = {
      button,
      timeMs: Date.now(),
      haHours: hourAngleHours(m.SiderealTime, m.RightAscension),
      decDeg: m.Declination,
    };
    if (lastMoveSample?.button !== button) {
      lastMoveSample = sample;
      return;
    }
    const sense = observedAxisSense(lastMoveSample, sample, button);
    if (sense === null) return;
    const axis = button === 'east' || button === 'west' ? raSense : decSense;
    axis.value = sense;
    lastMoveSample = sample;
  }
);

const skyMoves = computed(() =>
  suggestSkyMoves({
    check: startCheck.value,
    decDeg: store.mountInfo?.Declination,
    latDeg: store.mountInfo?.SiteLatitude,
    sunDecDeg: getSunEquatorial(new Date()).decDeg,
    leadMinutes: plan.value.leadMinutes,
  })
);

const ARROWS = { east: '→', west: '←', north: '↑', south: '↓' };

// Buttons to press, with the reason for each.
const moveHints = computed(() => {
  const { ra, dec, decReason } = skyMoves.value;
  const hints = [];
  if (dec) {
    hints.push({ key: 'dec', button: buttonForSkyMove(dec, decSense.value), reason: decReason });
  }
  if (ra) hints.push({ key: 'ra', button: buttonForSkyMove(ra, raSense.value), reason: ra });
  return hints.map((hint) => ({
    ...hint,
    arrow: ARROWS[hint.button],
    text: t(`${base}.position.moves.${hint.reason}`),
  }));
});

const highlightButtons = computed(() => moveHints.value.map((hint) => hint.button));

// A manual move still running would carry the scope off the checked position.
const positionReady = computed(
  () =>
    canStart.value &&
    startCheck.value?.ready === true &&
    !store.mountInfo?.Slewing &&
    !mountStore.lastDirection
);

function checkClass(ok) {
  if (ok === null) return 'text-content-muted';
  return ok ? 'text-status-ok' : 'text-status-danger';
}

function checkDotClass(ok) {
  if (ok === null) return 'bg-content-muted';
  return ok ? 'bg-status-ok' : 'bg-status-danger';
}

const pierOutcome = computed(() => comparePierSides(pierBefore.value, pierAfter.value));

// Minutes the mount is past the meridian, from its own sidereal time and RA.
const minutesPastMeridian = computed(() => {
  const m = store.mountInfo;
  if (!Number.isFinite(m?.SiderealTime) || !Number.isFinite(m?.RightAscension)) return null;
  return hourAngleHours(m.SiderealTime, m.RightAscension) * 60;
});

// NINA reports the time to the latest flip; the earliest lies (max - min) before it.
const latestFlipInMinutes = computed(() => {
  const hours = store.mountInfo?.TimeToMeridianFlip;
  return Number.isFinite(hours) && hours < 23 ? hours * 60 : null;
});

const statusText = computed(() => {
  if (flipStarted.value) return t(`${base}.flipping`);
  const past = minutesPastMeridian.value;
  if (past === null || past < 0) return t(`${base}.waitingForMeridian`);
  return t(`${base}.pastMeridian`, { minutes: formatMinutes(past) });
});

const countdownText = computed(() => {
  const latest = latestFlipInMinutes.value;
  // After the flip NINA already counts down to the next flip, twelve hours away.
  if (step.value !== 'running' || latest === null || flipStarted.value) return '';
  const window =
    Number(flipSettings.value.MaxMinutesAfterMeridian) -
    Number(flipSettings.value.MinutesAfterMeridian);
  const earliest = latest - (Number.isFinite(window) ? window : 0);
  if (earliest > 0) {
    return t(`${base}.countdownWindow`, {
      earliest: formatClock(earliest),
      latest: formatClock(latest),
    });
  }
  return t(`${base}.countdownLatest`, { latest: formatClock(Math.max(0, latest)) });
});

function formatMinutes(minutes) {
  return String(Math.round(minutes * 10) / 10);
}

function formatClock(minutes) {
  const total = Math.max(0, Math.round(minutes * 60));
  const seconds = String(total % 60).padStart(2, '0');
  if (total < 3600) return `${Math.floor(total / 60)}:${seconds}`;
  const mins = String(Math.floor(total / 60) % 60).padStart(2, '0');
  return `${Math.floor(total / 3600)}:${mins}:${seconds}`;
}

function sideLabel(side) {
  return side === 'pierEast' ? t(`${base}.sideEast`) : t(`${base}.sideWest`);
}

async function refreshSequenceBusy() {
  try {
    const response = await apiService.sequenceAction('state');
    sequenceBusy.value = isSequenceRunning(response?.Response);
  } catch {
    // No sequence information: do not block on it, the start re-checks.
    sequenceBusy.value = false;
  }
}
refreshSequenceBusy();

// Tracking on, so the time to the meridian counts down while the user drives.
// NINA refreshes the mount state itself only every 2 s. Reading it more often while
// positioning picks up each refresh at once instead of up to one global poll later.
const positionPoller = createPoller(async () => {
  try {
    const response = await apiService.mountAction('info');
    if (response?.Success && response.Response) {
      store.setInfoIfChanged('mountInfo', response.Response);
    }
  } catch (error) {
    console.error('Error reading the mount while positioning:', error);
  }
}, 500);

watch(step, (now) => {
  if (now === 'positioning') positionPoller.start();
  else positionPoller.stop();
});

async function startPositioning() {
  await refreshSequenceBusy();
  if (!canStart.value) return;
  step.value = 'positioning';
  if (store.mountInfo?.TrackingEnabled) return;
  try {
    await apiService.setTrackingMode(0);
  } catch (error) {
    console.error('Meridian flip test could not switch tracking on:', error);
  }
}

async function startTest() {
  await refreshSequenceBusy();
  if (!positionReady.value) return;

  const confirmed = await toastStore.showConfirmation(
    t(`${base}.confirmTitle`),
    t(`${base}.confirmMessage`),
    t(`${base}.start`),
    t('common.cancel')
  );
  // The scope may have moved or tracked too close to the meridian during the dialog.
  if (!confirmed || !positionReady.value) return;

  pierBefore.value = store.mountInfo?.SideOfPier || 'pierUnknown';
  runPlan = planFlipTest(
    flipSettings.value,
    exposureSeconds.value,
    startCheck.value.minutesToMeridian
  );
  step.value = 'starting';
  try {
    const sequence = buildFlipTestSequence({
      waitSeconds: exposureSeconds.value,
      waitCount: runPlan.waitCount,
    });
    const loaded = await apiService.sequenceLoadJson(sequence);
    if (!loaded?.Success) throw new Error(loaded?.Error || 'load');
    const started = await apiService.sequenceAction('start');
    // A start canceled on app resume has most likely reached NINA; the run poll follows it.
    if (!started || isBackendRefusal(started)) throw new Error(started?.Error || 'start');
    startedAt = Date.now();
    step.value = 'running';
    flipTestStore.saveRun({
      startedAt,
      runPlan,
      pierBefore: pierBefore.value,
      exposureSeconds: exposureSeconds.value,
    });
    poller.start();
  } catch (error) {
    console.error('Meridian flip test could not start:', error);
    endText.value = t(`${base}.startFailed`, { error: error?.message || '' });
    step.value = 'failed';
  }
}

// Stops everything that can move: the sequence, a slew, and tracking.
async function haltMount() {
  for (const action of [
    () => apiService.sequenceAction('stop'),
    () => apiService.slewStop(),
    () => apiService.setTrackingMode(4),
  ]) {
    try {
      await action();
    } catch (error) {
      console.error('Meridian flip test halt step failed:', error);
    }
  }
}

async function stopTest() {
  poller.stop();
  step.value = 'stopped';
  endText.value = t(`${base}.stopped`);
  await haltMount();
}

function markFlipStarted() {
  if (flipStarted.value) return;
  flipStarted.value = true;
  flipAtMinutes.value = Math.max(0, minutesPastMeridian.value ?? 0);
}

// NINA keeps the flip trigger RUNNING through slew, settling and recentering; the flip is
// over once it leaves RUNNING. Stopping the sequence earlier would cut NINA's routine off.
const poller = createPoller(async () => {
  if (step.value !== 'running') return;
  try {
    const response = await apiService.sequenceAction('state');
    const status = flipTriggerStatus(response?.Response);
    if (status === 'RUNNING') markFlipStarted();
    // FINISHED without RUNNING seen: NINA flipped while the app was closed or reloading,
    // so the flip time is unknown.
    else if (status === 'FINISHED') flipStarted.value = true;
    if (status !== 'RUNNING' && flipStarted.value && !store.mountInfo?.Slewing) {
      await finishRun();
      return;
    }
  } catch (error) {
    console.error('Error reading the flip test sequence state:', error);
  }
  const overdueMs = (runPlan.expectedMinutes + 10) * 60 * 1000;
  if (!flipStarted.value && Date.now() - startedAt > overdueMs) {
    poller.stop();
    step.value = 'noFlip';
    endText.value = t(`${base}.noFlip`);
    await haltMount();
  }
}, 5000);

watch(
  () => [store.mountInfo?.Slewing, store.mountInfo?.SideOfPier, store.mountInfo?.TrackingEnabled],
  ([slewing, side, tracking]) => {
    if (step.value !== 'running' || slewing || !tracking) return;
    // Backup for a trigger RUNNING phase shorter than one sequence poll.
    if (isPierSideKnown(side) && side !== pierBefore.value) markFlipStarted();
  }
);

async function finishRun() {
  poller.stop();
  pierAfter.value = store.mountInfo?.SideOfPier || '';
  step.value = 'ask';
  // The wait loop would run on for nothing; tracking stays on like after a real flip.
  try {
    await apiService.sequenceAction('stop');
  } catch (error) {
    console.error('Error stopping the flip test sequence:', error);
  }
  // NINA still marks a failed flip as FINISHED; only its log tells.
  try {
    flipReport.value = analyzeFlipLog(await apiService.getLastLogs(1500, 'INFO'));
  } catch (error) {
    console.error('Error reading the NINA log after the flip test:', error);
  }
}

function answer(ok) {
  userSaysOk.value = ok;
  step.value = 'result';
}

// A mount that drops out mid-test ends it; there is nothing left to watch.
watch(
  () => store.mountInfo?.Connected,
  (connected) => {
    if (connected || !isActive.value) return;
    poller.stop();
    endText.value = t(`${base}.blockers.notConnected`);
    step.value = 'failed';
  }
);

// Only a running test is worth bringing back after a reload.
watch(step, (now, before) => {
  if (before === 'running' && now !== 'running') flipTestStore.clearRun();
});

// Reopened after a reload while NINA still runs the test sequence.
const resumeRun = flipTestStore.resumeRun;
if (resumeRun) {
  startedAt = resumeRun.startedAt;
  runPlan = resumeRun.runPlan;
  pierBefore.value = resumeRun.pierBefore || 'pierUnknown';
  exposureSeconds.value = resumeRun.exposureSeconds || exposureSeconds.value;
  step.value = 'running';
  poller.start();
}

onBeforeUnmount(() => {
  poller.stop();
  positionPoller.stop();
});
</script>
