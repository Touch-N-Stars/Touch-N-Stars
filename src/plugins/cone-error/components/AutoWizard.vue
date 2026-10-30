<template>
  <!-- Running: progress and the one-time pier side question -->
  <section v-if="store.autoRunning" class="tns-card space-y-3">
    <h2 class="font-semibold text-content">{{ $t('plugins.coneError.progress.title') }}</h2>
    <p class="text-sm text-content">{{ status.message }}</p>
    <div class="h-2 rounded-full bg-surface-3 overflow-hidden">
      <div class="h-full bg-accent-action" :style="{ width: `${progressPercent}%` }"></div>
    </div>
    <p class="text-xs text-content-muted">
      {{
        $t('plugins.coneError.progress.pair', {
          pair: status.pairIndex + 1,
          total: status.repetitions,
          side: sideLabel($t, status.currentSide),
        })
      }}
    </p>
    <PairTable :pairs="status.pairs" />

    <div
      v-if="status.question"
      class="rounded-control border border-status-warn/50 bg-status-warn/10 p-3 space-y-3"
    >
      <h3 class="font-semibold text-status-warn">{{ $t('plugins.coneError.question.title') }}</h3>
      <PierSideSketch />
      <p class="text-sm text-content">{{ status.question.text }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button class="tns-btn-primary min-h-touch" :disabled="store.pending" @click="answer(true)">
          {{ $t('plugins.coneError.question.yes') }}
        </button>
        <button
          class="tns-btn-secondary min-h-touch"
          :disabled="store.pending"
          @click="answer(false)"
        >
          {{ $t('plugins.coneError.question.no') }}
        </button>
      </div>
    </div>

    <ConeStopButton />
  </section>

  <!-- Finished -->
  <template v-else-if="showResult">
    <ConeResult :result="status.result" :previous="status.previous" />
    <button class="tns-btn-secondary" @click="newMeasurement">
      {{ $t('plugins.coneError.auto.newMeasurement') }}
    </button>
  </template>

  <template v-else>
    <section
      v-if="outcome"
      class="rounded-control border p-3 text-sm space-y-1"
      :class="
        outcome.phase === 'Aborted'
          ? 'border-status-warn/50 bg-status-warn/10 text-status-warn'
          : 'border-status-danger/50 bg-status-danger/10 text-status-danger'
      "
    >
      <p class="font-semibold">{{ $t(`plugins.coneError.progress.phase.${outcome.phase}`) }}</p>
      <p>{{ outcome.message }}</p>
      <PairTable v-if="outcome.pairs?.length" :pairs="outcome.pairs" />
    </section>

    <ConeChecks mode="auto" />

    <!-- Step 2: inputs -->
    <section v-if="!plan" class="tns-card space-y-3">
      <h2 class="font-semibold text-content">{{ $t('plugins.coneError.auto.setupTitle') }}</h2>
      <p class="text-sm text-content-muted">{{ $t('plugins.coneError.auto.intro') }}</p>
      <NumberInputPicker
        v-model="dovetailMm"
        inputId="cone-dovetail"
        :label="$t('plugins.coneError.auto.dovetail')"
        labelKey="plugins.coneError.auto.dovetail"
        :helpMessage="$t('plugins.coneError.auto.dovetailHelp')"
        :min="20"
        :max="1500"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <NumberInputPicker
        v-model="repetitions"
        inputId="cone-repetitions"
        :label="$t('plugins.coneError.auto.repetitions')"
        labelKey="plugins.coneError.auto.repetitions"
        :min="1"
        :max="10"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <NumberInputPicker
        v-model="exposure"
        inputId="cone-exposure"
        :label="$t('plugins.coneError.auto.exposure')"
        labelKey="plugins.coneError.auto.exposure"
        :min="0.5"
        :max="60"
        :step="0.5"
        :decimalPlaces="1"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <label class="flex items-center gap-3 min-h-touch text-sm text-content">
        <input v-model="customDeclination" type="checkbox" class="w-5 h-5" />
        {{ $t('plugins.coneError.auto.customDeclination') }}
      </label>
      <NumberInputPicker
        v-if="customDeclination"
        v-model="declination"
        inputId="cone-declination"
        :label="$t('plugins.coneError.auto.declination')"
        labelKey="plugins.coneError.auto.declination"
        :helpMessage="$t('plugins.coneError.auto.declinationHelp')"
        :min="-30"
        :max="30"
        :step="1"
        :decimalPlaces="0"
        :useDefaultSentinel="false"
        labelPosition="top"
        wrapperClass="w-full"
      />
      <button
        class="tns-btn-primary min-h-touch"
        :disabled="!canPlan || store.pending"
        @click="makePlan"
      >
        {{
          store.pending ? $t('plugins.coneError.auto.planning') : $t('plugins.coneError.auto.plan')
        }}
      </button>
    </section>

    <!-- Step 3: the planned slews, confirmed before the mount moves -->
    <section v-else class="tns-card space-y-3">
      <h2 class="font-semibold text-content">{{ $t('plugins.coneError.auto.planTitle') }}</h2>
      <p class="text-sm text-content">
        {{
          $t('plugins.coneError.auto.planSummary', {
            dec: plan.plan.declinationDegrees.toFixed(0),
            pairs: plan.repetitions,
            minutes: Math.ceil(plan.plan.estimatedSeconds / 60),
          })
        }}
      </p>
      <p
        v-if="plan.plan.refusal || plan.plan.violations.length"
        class="rounded-control border border-status-danger/50 bg-status-danger/10 p-3 text-sm text-status-danger"
      >
        {{ plan.plan.refusal || plan.plan.violations.map((v) => v.message).join(' ') }}
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-content">
          <thead class="text-content-muted">
            <tr>
              <th class="text-left py-1">#</th>
              <th class="text-left">{{ $t('plugins.coneError.auto.move') }}</th>
              <th class="text-left">{{ $t('plugins.coneError.auto.side') }}</th>
              <th class="text-right">{{ $t('plugins.coneError.auto.altitude') }}</th>
              <th class="text-right">{{ $t('plugins.coneError.auto.pastMeridian') }}</th>
              <th class="text-right">{{ $t('plugins.coneError.auto.sun') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(step, i) in plan.plan.steps" :key="i" class="border-t border-line">
              <td class="py-1">{{ step.pair + 1 }}</td>
              <td>{{ $t(`plugins.coneError.auto.kind.${step.kind}`) }}</td>
              <td>{{ sideLabel($t, step.side) }}</td>
              <td class="text-right">{{ step.check.altitude.toFixed(0) }}°</td>
              <td class="text-right">{{ step.check.pastMeridianDegrees.toFixed(1) }}°</td>
              <td class="text-right">
                {{
                  step.check.sunBelowHorizon
                    ? $t('plugins.coneError.auto.sunSet')
                    : `${step.check.sunSeparationDegrees.toFixed(0)}°`
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="plan.askPierLabels" class="text-sm text-content-muted">
        {{ $t('plugins.coneError.auto.pierLabelHint') }}
      </p>
      <label
        v-if="modelWarning"
        class="flex items-start gap-3 rounded-control border border-status-warn/50 bg-status-warn/10 p-3 text-sm text-status-warn"
      >
        <input v-model="acknowledgeModel" type="checkbox" class="w-5 h-5 mt-0.5" />
        <span>{{ $t('plugins.coneError.auto.acknowledgeModel') }}</span>
      </label>
      <p class="text-xs text-content-faint">
        {{ $t('plugins.coneError.auto.expires', { seconds: secondsLeft }) }}
      </p>
      <div class="grid grid-cols-2 gap-2">
        <button class="tns-btn-secondary min-h-touch" @click="store.autoPlan = null">
          {{ $t('common.cancel') }}
        </button>
        <button
          class="tns-btn-primary min-h-touch"
          :disabled="
            !plan.plan.ok ||
            secondsLeft <= 0 ||
            (modelWarning && !acknowledgeModel) ||
            store.pending
          "
          @click="start"
        >
          {{ $t('plugins.coneError.auto.start') }}
        </button>
      </div>
    </section>
  </template>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useToastStore } from '@/store/toastStore';
import { sideLabel } from '../format';
import { usePlanClock } from '../planClock';
import { useConeErrorStore } from '../store/coneErrorStore';
import ConeChecks from './ConeChecks.vue';
import ConeResult from './ConeResult.vue';
import ConeStopButton from './ConeStopButton.vue';
import PairTable from './PairTable.vue';
import PierSideSketch from './PierSideSketch.vue';

const { t } = useI18n();
const store = useConeErrorStore();
const toast = useToastStore();

const status = computed(() => store.status ?? {});
const plan = computed(() => store.autoPlan);

const dovetailMm = ref(store.settings?.dovetailMm ?? 200);
const repetitions = ref(store.settings?.repetitions ?? 1);
const exposure = ref(
  store.settings?.exposureSeconds ?? store.preconditions?.profile?.plateSolveExposureSeconds ?? 5
);
const customDeclination = ref(false);
const declination = ref(0);
const acknowledgeModel = ref(false);

// Settings and the profile arrive after the component is set up; take them over until the user
// edits a field.
const exposureEdited = ref(false);
watch(exposure, (value, old) => {
  if (old !== undefined && value !== defaultExposure()) exposureEdited.value = true;
});
function defaultExposure() {
  return (
    store.settings?.exposureSeconds ?? store.preconditions?.profile?.plateSolveExposureSeconds ?? 5
  );
}
watch(
  () => [store.settings, store.preconditions?.profile?.plateSolveExposureSeconds],
  () => {
    const settings = store.settings;
    if (settings?.dovetailMm) dovetailMm.value = settings.dovetailMm;
    if (settings?.repetitions) repetitions.value = settings.repetitions;
    if (!exposureEdited.value) exposure.value = defaultExposure();
  },
  { immediate: true }
);

const canPlan = computed(
  () => store.preconditions?.autoReady === true && dovetailMm.value > 0 && !store.active
);
const modelWarning = computed(() => store.preconditions?.pointingModel?.state !== 'None');

const progressPercent = computed(() => {
  const total = status.value.repetitions || 1;
  const done = (status.value.pairs ?? []).filter((p) => p.coneArcmin != null || p.problem).length;
  return Math.min(100, Math.round((done / total) * 100));
});

const showResult = computed(
  () =>
    status.value.mode === 'auto' &&
    status.value.phase === 'Complete' &&
    status.value.result &&
    store.dismissedResultId !== status.value.result.id
);

const outcome = computed(() =>
  status.value.mode === 'auto' && ['Failed', 'Aborted'].includes(status.value.phase)
    ? { phase: status.value.phase, message: status.value.message, pairs: status.value.pairs }
    : null
);

// The plan expires on the backend after 60 s: the sky moves on. Counted from when it arrived, so
// that a phone clock off the Pi's does not matter.
const now = usePlanClock(plan);
const secondsLeft = computed(() =>
  plan.value
    ? Math.max(
        0,
        Math.round(plan.value.expiresInSeconds - (now.value - plan.value.receivedAt) / 1000)
      )
    : 0
);

async function makePlan() {
  try {
    await store.saveSettings({
      dovetailMm: dovetailMm.value,
      repetitions: repetitions.value,
      exposureSeconds: exposure.value,
    });
    acknowledgeModel.value = false;
    await store.planAuto({
      dovetailMm: dovetailMm.value,
      repetitions: repetitions.value,
      declination: customDeclination.value ? declination.value : null,
      exposureSeconds: exposure.value,
    });
  } catch {
    // shown through store.error
  }
}

async function start() {
  const yes = await toast.showConfirmation(
    t('plugins.coneError.auto.startConfirmTitle'),
    t('plugins.coneError.auto.startConfirmMessage'),
    t('plugins.coneError.auto.start'),
    t('common.cancel')
  );
  if (!yes) return;
  try {
    await store.startAuto(acknowledgeModel.value);
  } catch {
    // shown through store.error
  }
}

async function answer(yes) {
  try {
    await store.answer(status.value.question.id, yes);
  } catch {
    // shown through store.error
  }
}

function newMeasurement() {
  store.dismissedResultId = status.value.result?.id ?? null;
  store.loadPreconditions();
}
</script>
