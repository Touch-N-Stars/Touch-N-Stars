<template>
  <!-- Not running: preconditions and start -->
  <template v-if="!store.manualActive">
    <ConeChecks mode="manual" />
    <section class="tns-card space-y-3">
      <h2 class="font-semibold text-content">{{ $t('plugins.coneError.manual.title') }}</h2>
      <p class="text-sm text-content-muted">{{ $t('plugins.coneError.manual.intro') }}</p>
      <ul class="list-disc pl-5 text-sm text-content-muted space-y-1">
        <li>{{ $t('plugins.coneError.manual.howCapture') }}</li>
        <li>{{ $t('plugins.coneError.manual.howMove') }}</li>
        <li>{{ $t('plugins.coneError.manual.howRead') }}</li>
      </ul>
      <p
        class="rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-status-warn"
      >
        {{ $t('plugins.coneError.manual.sunNote', { radius: sunRadius }) }}
      </p>
      <div v-if="timeSkew" class="space-y-2">
        <p class="text-sm text-status-warn">{{ timeSkew }}</p>
        <button class="tns-btn-secondary min-h-touch" :disabled="settingTime" @click="setPiTime">
          {{ $t('plugins.coneError.manual.setTime') }}
        </button>
      </div>
      <button
        class="tns-btn-primary min-h-touch"
        :disabled="!store.preconditions?.manualReady || store.pending || store.active"
        @click="begin"
      >
        {{ $t('plugins.coneError.manual.start') }}
      </button>
    </section>
  </template>

  <template v-else>
    <!-- The Sun relative to where the telescope points now -->
    <p
      v-if="status.sun?.critical"
      class="rounded-control border border-status-danger bg-status-danger/15 p-3 text-sm font-semibold text-status-danger"
    >
      {{
        $t('plugins.coneError.manual.sunCritical', { sep: status.sun.separationDegrees.toFixed(0) })
      }}
    </p>
    <p
      v-else-if="status.sun?.warning"
      class="rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-status-warn"
    >
      {{
        $t('plugins.coneError.manual.sunWarning', { sep: status.sun.separationDegrees.toFixed(0) })
      }}
    </p>

    <p
      v-if="status.error"
      class="rounded-control border border-status-danger/50 bg-status-danger/10 p-3 text-sm text-status-danger"
    >
      {{ status.error.message }}
    </p>

    <section class="tns-card space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-content">{{ $t('plugins.coneError.manual.title') }}</h2>
        <span class="text-xs text-content-muted">
          {{ $t('plugins.coneError.manual.side', { side: sideLabel($t, manual.currentSide) }) }}
        </span>
      </div>
      <p class="text-sm text-content">{{ status.message }}</p>

      <ConeStopButton v-if="store.moving" />

      <!-- Not during a move: the stop button is on this page -->
      <div class="grid grid-cols-2 gap-2">
        <button
          class="tns-btn-secondary min-h-touch"
          :disabled="store.moving"
          @click="router.push('/camera')"
        >
          {{ $t('plugins.coneError.manual.liveView') }}
        </button>
        <button
          class="tns-btn-secondary min-h-touch"
          :disabled="store.moving"
          @click="router.push('/mount')"
        >
          {{ $t('plugins.coneError.manual.mountPad') }}
        </button>
      </div>

      <button
        class="tns-btn-primary min-h-touch"
        :disabled="store.pending || store.moving"
        @click="capture"
      >
        {{ $t('plugins.coneError.manual.capture') }}
      </button>

      <template v-if="manual.capturedHourAngle != null">
        <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-content-muted">
          <dt>{{ $t('plugins.coneError.manual.haDec') }}</dt>
          <dd class="text-content">
            {{ hours(manual.capturedHourAngle) }} / {{ manual.capturedDeclination.toFixed(2) }}°
          </dd>
          <dt>{{ $t('plugins.coneError.manual.altAz') }}</dt>
          <dd class="text-content">
            {{ manual.capturedAltitude.toFixed(1) }}° / {{ manual.capturedAzimuth.toFixed(1) }}°
          </dd>
          <dt>{{ $t('plugins.coneError.manual.capturedSide') }}</dt>
          <dd class="text-content">{{ sideLabel($t, manual.capturedSide) }}</dd>
        </dl>
        <label class="flex items-start gap-3 text-sm text-content">
          <input v-model="directionConfirmed" type="checkbox" class="w-5 h-5 mt-0.5" />
          <span>{{ $t('plugins.coneError.manual.confirmDirection') }}</span>
        </label>

        <ul class="space-y-1 text-xs">
          <li
            v-for="check in sideChecks"
            :key="check.side"
            :class="check.ok ? 'text-status-ok' : 'text-status-danger'"
          >
            {{ sideLabel($t, check.side) }}:
            {{ check.ok ? $t('plugins.coneError.manual.reachable') : check.reason }}
          </li>
        </ul>

        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="side in ['East', 'West']"
            :key="side"
            class="tns-btn-secondary min-h-touch"
            :disabled="
              side === manual.currentSide || !directionConfirmed || store.pending || store.moving
            "
            @click="planMove(side)"
          >
            {{ $t(`plugins.coneError.manual.move${side}`) }}
          </button>
        </div>
      </template>
    </section>

    <!-- The planned move: checks, warnings, confirmation -->
    <section v-if="movePlan" class="tns-card space-y-3">
      <h3 class="font-semibold text-content">
        {{ $t('plugins.coneError.manual.planTitle', { side: sideLabel($t, movePlan.toSide) }) }}
      </h3>
      <p
        v-if="!movePlan.ok"
        class="rounded-control border border-status-danger/50 bg-status-danger/10 p-3 text-sm text-status-danger"
      >
        {{ movePlan.refusal || movePlan.check?.violations.map((v) => v.message).join(' ') }}
        <span v-if="movePlan.nextAllowedUtc" class="block mt-1 font-semibold">
          {{
            $t('plugins.coneError.manual.nextAllowed', {
              time: new Date(movePlan.nextAllowedUtc).toLocaleTimeString(),
            })
          }}
        </span>
      </p>
      <!-- Only a refusal for the Sun near the path alone can be overridden, and only for this move -->
      <button
        v-if="!movePlan.ok && movePlan.sunPathOverridable"
        class="tns-btn-danger min-h-touch"
        :disabled="store.pending"
        @click="overrideSunPath"
      >
        {{ $t('plugins.coneError.manual.overrideSun') }}
      </button>
      <p
        v-if="movePlan.ok && movePlan.sunPathOverridden"
        class="rounded-control border border-status-danger bg-status-danger/15 p-3 text-sm font-semibold text-status-danger"
      >
        {{
          $t('plugins.coneError.manual.overridden', {
            sep: movePlan.check.pathSunSeparationDegrees.toFixed(0),
          })
        }}
      </p>
      <dl v-if="movePlan.check" class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-content-muted">
        <dt>{{ $t('plugins.coneError.auto.altitude') }}</dt>
        <dd class="text-content">
          {{ movePlan.check.altitude.toFixed(1) }}° (≥
          {{ movePlan.check.minAltitudeDegrees.toFixed(1) }}°)
        </dd>
        <dt>{{ $t('plugins.coneError.auto.pastMeridian') }}</dt>
        <dd class="text-content">
          {{ movePlan.check.pastMeridianDegrees.toFixed(1) }}° (≤
          {{ movePlan.check.pastMeridianLimitDegrees.toFixed(1) }}°)
        </dd>
        <dt>{{ $t('plugins.coneError.manual.sunEndpoint') }}</dt>
        <dd class="text-content">
          {{
            movePlan.check.sunBelowHorizon
              ? $t('plugins.coneError.auto.sunSet')
              : `${movePlan.check.sunSeparationDegrees.toFixed(0)}°`
          }}
        </dd>
        <dt>{{ $t('plugins.coneError.manual.sunPath') }}</dt>
        <dd class="text-content">
          {{ movePlan.check.pathSunSeparationDegrees?.toFixed(0) ?? '—' }}°
        </dd>
      </dl>
      <ul v-if="movePlan.ok" class="space-y-1 text-sm text-status-warn">
        <li v-for="warning in movePlan.warnings" :key="warning">{{ warning }}</li>
      </ul>
      <label v-if="movePlan.ok" class="flex items-start gap-3 text-sm text-content">
        <input v-model="capsConfirmed" type="checkbox" class="w-5 h-5 mt-0.5" />
        <span>{{ $t('plugins.coneError.manual.caps') }}</span>
      </label>
      <p v-if="movePlan.ok" class="text-xs text-content-faint">
        {{ $t('plugins.coneError.auto.expires', { seconds: moveSecondsLeft }) }}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button class="tns-btn-secondary min-h-touch" @click="store.movePlan = null">
          {{ $t('common.cancel') }}
        </button>
        <button
          class="tns-btn-primary min-h-touch"
          :disabled="!movePlan.ok || !capsConfirmed || moveSecondsLeft <= 0 || store.pending"
          @click="move"
        >
          {{ $t('plugins.coneError.manual.confirmMove') }}
        </button>
      </div>
    </section>

    <!-- The one-time counterweight check (also asked by the night measurement), on the east side -->
    <section
      v-if="manual.capturedHourAngle != null && !manual.pierLabelsVerified"
      class="tns-card space-y-3"
    >
      <h3 class="font-semibold text-content">{{ $t('plugins.coneError.question.title') }}</h3>
      <p
        v-if="manual.pierLabelsInverted"
        class="rounded-control border border-status-danger/50 bg-status-danger/10 p-3 text-sm text-status-danger"
      >
        {{ $t('plugins.coneError.manual.pierLabelsInvertedNote') }}
      </p>
      <template v-else>
        <PierSideSketch />
        <p class="text-sm text-content">
          {{
            canAnswerPierLabels
              ? $t('plugins.coneError.manual.pierLabelsQuestion')
              : $t('plugins.coneError.manual.pierLabelsMoveEast')
          }}
        </p>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="tns-btn-primary min-h-touch"
            :disabled="!canAnswerPierLabels || store.pending || store.moving"
            @click="pierLabels(true)"
          >
            {{ $t('plugins.coneError.question.yes') }}
          </button>
          <button
            class="tns-btn-secondary min-h-touch"
            :disabled="!canAnswerPierLabels || store.pending || store.moving"
            @click="pierLabels(false)"
          >
            {{ $t('plugins.coneError.question.no') }}
          </button>
        </div>
      </template>
    </section>

    <!-- Optional daytime estimate after re-centring the landmark -->
    <section
      v-if="manual.centredHourAngleEast != null || manual.centredHourAngleWest != null"
      class="tns-card space-y-3"
    >
      <h3 class="font-semibold text-content">{{ $t('plugins.coneError.manual.estimateTitle') }}</h3>
      <p class="text-sm text-content-muted">{{ $t('plugins.coneError.manual.estimateIntro') }}</p>
      <NumberInputPicker
        v-model="axisOffsetMm"
        inputId="cone-axis-offset"
        :label="$t('plugins.coneError.manual.axisOffset')"
        labelKey="plugins.coneError.manual.axisOffset"
        :helpMessage="$t('plugins.coneError.manual.axisOffsetHelp')"
        :min="10"
        :max="1500"
        :step="5"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <NumberInputPicker
        v-model="landmarkKm"
        inputId="cone-landmark-distance"
        :label="$t('plugins.coneError.manual.landmarkDistance')"
        labelKey="plugins.coneError.manual.landmarkDistance"
        :min="0.1"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <button
        class="tns-btn-secondary min-h-touch"
        :disabled="store.pending || store.moving"
        @click="recentred"
      >
        {{ $t('plugins.coneError.manual.recentred') }}
      </button>
      <p
        v-if="store.estimate?.refusal"
        class="rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-status-warn"
      >
        {{ store.estimate.refusal }}
      </p>
    </section>
    <ConeResult v-if="status.result" :result="status.result" :previous="status.previous" />

    <button class="tns-btn-secondary min-h-touch" :disabled="store.moving" @click="end">
      {{ $t('plugins.coneError.manual.end') }}
    </button>
  </template>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import apiPinsService from '@/services/apiPinsService';
import { useToastStore } from '@/store/toastStore';
import { sideLabel } from '../format';
import { usePlanClock } from '../planClock';
import { useConeErrorStore } from '../store/coneErrorStore';
import ConeChecks from './ConeChecks.vue';
import ConeStopButton from './ConeStopButton.vue';
import PierSideSketch from './PierSideSketch.vue';
import ConeResult from './ConeResult.vue';

const { t } = useI18n();
const router = useRouter();
const store = useConeErrorStore();
const toast = useToastStore();

const status = computed(() => store.status ?? {});
const manual = computed(() => status.value.manual ?? {});
const movePlan = computed(() => store.movePlan);
const sunRadius = computed(() => store.settings?.sunExclusionDegrees ?? 30);

// "counterweight on the west" only holds on the east side within a few hours of the meridian
const canAnswerPierLabels = computed(
  () =>
    manual.value.currentSide === 'East' &&
    typeof manual.value.currentHourAngle === 'number' &&
    Math.abs(manual.value.currentHourAngle) <= 4
);

const directionConfirmed = ref(false);
const capsConfirmed = ref(false);
const axisOffsetMm = ref(store.settings?.axisOffsetMm ?? 250);
// The settings may arrive after the tab was opened: then take the saved offset over once.
if (!store.settings) {
  const stopWatch = watch(
    () => store.settings,
    (settings) => {
      if (!settings) return;
      if (settings.axisOffsetMm) axisOffsetMm.value = settings.axisOffsetMm;
      stopWatch();
    }
  );
}
const landmarkKm = ref(5);
const settingTime = ref(false);

watch(movePlan, () => (capsConfirmed.value = false));

// A planned move is valid for 60 s on the backend, counted from when it arrived here.
const now = usePlanClock(movePlan);
const moveSecondsLeft = computed(() =>
  movePlan.value?.expiresInSeconds
    ? Math.max(
        0,
        Math.round(movePlan.value.expiresInSeconds - (now.value - movePlan.value.receivedAt) / 1000)
      )
    : 0
);

const timeSkew = computed(() => {
  const time = store.preconditions?.time;
  if (!time) return null;
  if (time.looksUnset) return t('plugins.coneError.manual.timeUnset');
  if (typeof time.skewSeconds === 'number' && Math.abs(time.skewSeconds) > 120) {
    return t('plugins.coneError.manual.timeSkew', {
      minutes: Math.round(Math.abs(time.skewSeconds) / 60),
    });
  }
  return null;
});

const sideChecks = computed(() =>
  [manual.value.eastCheck, manual.value.westCheck].filter(Boolean).map((check) => ({
    side: check.side,
    ok: check.ok,
    reason: check.violations.map((v) => v.message).join(' '),
  }))
);

function hours(value) {
  const sign = value < 0 ? '−' : '+';
  const minutes = Math.abs(value) * 60;
  return `${sign}${Math.floor(minutes / 60)}h${(minutes % 60).toFixed(1)}m`;
}

async function guarded(action) {
  try {
    await action();
  } catch {
    // shown through store.error
  }
}

async function setPiTime() {
  settingTime.value = true;
  try {
    // setSystemTime reports a failure as false instead of throwing
    const ok = await apiPinsService.setSystemTime(Math.floor(Date.now() / 1000));
    if (!ok) {
      toast.showToast({
        type: 'error',
        title: t('plugins.coneError.manual.setTimeFailed'),
        message: '',
      });
    }
    await store.loadPreconditions();
  } finally {
    settingTime.value = false;
  }
}

async function begin() {
  const yes = await toast.showConfirmation(
    t('plugins.coneError.manual.startConfirmTitle'),
    t('plugins.coneError.manual.startConfirmMessage'),
    t('plugins.coneError.manual.start'),
    t('common.cancel')
  );
  if (yes) await guarded(() => store.manualBegin());
}

async function capture() {
  directionConfirmed.value = false;
  await guarded(() => store.manualCapture());
}

async function planMove(side) {
  await guarded(() => store.manualPlanMove(side));
}

// A deliberate, per-move decision: the backend still refuses the endpoint and every limit.
async function overrideSunPath() {
  const plan = movePlan.value;
  const yes = await toast.showConfirmation(
    t('plugins.coneError.manual.overrideConfirmTitle'),
    t('plugins.coneError.manual.overrideConfirmMessage', {
      sep: plan.check.pathSunSeparationDegrees.toFixed(0),
      radius: sunRadius.value,
    }),
    t('plugins.coneError.manual.overrideSun'),
    t('common.cancel')
  );
  if (yes) await guarded(() => store.manualPlanMove(plan.toSide, true));
}

async function move() {
  await guarded(() => store.manualMove());
}

async function pierLabels(counterweightWest) {
  await guarded(() => store.manualPierLabels(counterweightWest));
}

async function recentred() {
  await guarded(() => store.manualRecenterDone(axisOffsetMm.value, landmarkKm.value * 1000));
  await store.loadStatus();
}

async function end() {
  await guarded(() => store.manualEnd());
  directionConfirmed.value = false;
}
</script>
