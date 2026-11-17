<template>
  <div class="flex flex-col gap-3">
    <AsyncLoadState v-if="!s" :failed="loadFailed" :message="loadError" />

    <template v-else>
      <!-- On/off settings -->
      <section v-if="generalSwitches.length" class="tns-card p-3! flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.proxisky.title') }}
        </h3>
        <div
          v-for="row in generalSwitches"
          :key="row.key"
          class="flex items-center justify-between gap-3"
        >
          <div class="flex flex-col">
            <div class="flex items-center gap-1">
              <span class="text-sm text-content">{{ switchLabel(row.key) }}</span>
              <InfoModal
                :title="switchLabel(row.key)"
                :message="t(`components.mount.onstepx.proxisky.info.${row.key}`)"
                size="w-4 h-4"
              />
            </div>
            <span v-if="row.note" class="text-xs text-content-faint">{{ row.note }}</span>
          </div>
          <toggleButton
            :statusValue="s[row.key]"
            :disabled="busy || !row.writable"
            @update:statusValue="(value) => setSwitch(row.key, value)"
          />
        </div>
      </section>

      <!-- RA travel limits -->
      <section v-if="s.RaLimitLeft != null" class="tns-card p-3! flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
            {{ t('components.mount.onstepx.proxisky.raLimits.title') }}
          </h3>
          <InfoModal
            :title="t('components.mount.onstepx.proxisky.raLimits.title')"
            :message="t('components.mount.onstepx.proxisky.info.raLimits')"
            size="w-4 h-4"
          />
        </div>
        <div v-if="s.RaLimits != null" class="flex items-center justify-between gap-3">
          <span class="text-sm text-content">{{ switchLabel('RaLimits') }}</span>
          <toggleButton
            :statusValue="s.RaLimits"
            :disabled="busy"
            @update:statusValue="(value) => setSwitch('RaLimits', value)"
          />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <NumberInputPicker
            v-model="raLeft"
            :label="t('components.mount.onstepx.proxisky.raLimits.left')"
            labelKey="components.mount.onstepx.proxisky.raLimits.left"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="proxisky-ra-left"
            :min="RA_LIMIT_RANGE[0]"
            :max="RA_LIMIT_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
          <NumberInputPicker
            v-model="raRight"
            :label="t('components.mount.onstepx.proxisky.raLimits.right')"
            labelKey="components.mount.onstepx.proxisky.raLimits.right"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="proxisky-ra-right"
            :min="RA_LIMIT_RANGE[0]"
            :max="RA_LIMIT_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
        </div>
        <p class="text-xs text-content-faint">
          {{ t('components.mount.onstepx.proxisky.raLimits.hint') }}
        </p>
        <button
          class="tns-btn-primary"
          :disabled="busy || !raValid || !raChanged"
          @click="write(() => apiService.setProxiskyRaLimits(raLeft, raRight), 'ra')"
        >
          {{ t('components.mount.onstepx.apply') }}
        </button>
      </section>

      <!-- Dec travel limits (changeable on a UMi17X only) -->
      <section v-if="s.DecLimitCcw != null" class="tns-card p-3! flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
            {{ t('components.mount.onstepx.proxisky.decLimits.title') }}
          </h3>
          <InfoModal
            :title="t('components.mount.onstepx.proxisky.decLimits.title')"
            :message="t('components.mount.onstepx.proxisky.info.decLimits')"
            size="w-4 h-4"
          />
        </div>
        <div v-if="s.DecLimits != null" class="flex items-center justify-between gap-3">
          <span class="text-sm text-content">{{ switchLabel('DecLimits') }}</span>
          <toggleButton
            :statusValue="s.DecLimits"
            :disabled="busy || !s.CanSetDecLimits"
            @update:statusValue="(value) => setSwitch('DecLimits', value)"
          />
        </div>
        <div v-if="s.CanSetDecLimits" class="grid grid-cols-2 gap-2">
          <NumberInputPicker
            v-model="decCcw"
            :label="t('components.mount.onstepx.proxisky.decLimits.ccw')"
            labelKey="components.mount.onstepx.proxisky.decLimits.ccw"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="proxisky-dec-ccw"
            :min="DEC_LIMIT_RANGE[0]"
            :max="DEC_LIMIT_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
          <NumberInputPicker
            v-model="decCw"
            :label="t('components.mount.onstepx.proxisky.decLimits.cw')"
            labelKey="components.mount.onstepx.proxisky.decLimits.cw"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="proxisky-dec-cw"
            :min="DEC_LIMIT_RANGE[0]"
            :max="DEC_LIMIT_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
        </div>
        <dl v-else class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt class="text-content-muted">
            {{ t('components.mount.onstepx.proxisky.decLimits.ccw') }}
          </dt>
          <dd class="text-right text-content">{{ s.DecLimitCcw }}</dd>
          <dt class="text-content-muted">
            {{ t('components.mount.onstepx.proxisky.decLimits.cw') }}
          </dt>
          <dd class="text-right text-content">{{ s.DecLimitCw }}</dd>
        </dl>
        <p class="text-xs text-content-faint">
          {{
            s.CanSetDecLimits
              ? t('components.mount.onstepx.proxisky.decLimits.hint')
              : t('components.mount.onstepx.proxisky.umi17xOnly')
          }}
        </p>
        <button
          v-if="s.CanSetDecLimits"
          class="tns-btn-primary"
          :disabled="busy || !decValid || !decChanged"
          @click="write(() => apiService.setProxiskyDecLimits(decCcw, decCw), 'dec')"
        >
          {{ t('components.mount.onstepx.apply') }}
        </button>
      </section>

      <!-- Anti-collision system -->
      <section
        v-if="s.AntiCollision != null || s.AcsThresholdRa != null"
        class="tns-card p-3! flex flex-col gap-3"
      >
        <div class="flex items-center gap-1">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
            {{ t('components.mount.onstepx.proxisky.acs.title') }}
          </h3>
          <InfoModal
            :title="t('components.mount.onstepx.proxisky.acs.title')"
            :message="t('components.mount.onstepx.proxisky.info.acs')"
            size="w-4 h-4"
          />
        </div>
        <div v-if="s.AntiCollision != null" class="flex items-center justify-between gap-3">
          <span class="text-sm text-content">{{ switchLabel('AntiCollision') }}</span>
          <toggleButton
            :statusValue="s.AntiCollision"
            :disabled="busy"
            @update:statusValue="(value) => setSwitch('AntiCollision', value)"
          />
        </div>
        <template v-if="s.AcsThresholdRa != null">
          <div class="grid grid-cols-2 gap-2">
            <NumberInputPicker
              v-model="acsRa"
              :label="t('components.mount.onstepx.proxisky.acs.thresholdRa')"
              labelKey="components.mount.onstepx.proxisky.acs.thresholdRa"
              labelPosition="top"
              wrapperClass="w-full"
              inputId="proxisky-acs-ra"
              :min="ACS_RA_RANGE[0]"
              :max="ACS_RA_RANGE[1]"
              :step="10"
              :useDefaultSentinel="false"
            />
            <NumberInputPicker
              v-model="acsDec"
              :label="t('components.mount.onstepx.proxisky.acs.thresholdDec')"
              labelKey="components.mount.onstepx.proxisky.acs.thresholdDec"
              labelPosition="top"
              wrapperClass="w-full"
              inputId="proxisky-acs-dec"
              :min="ACS_DEC_RANGE[0]"
              :max="ACS_DEC_RANGE[1]"
              :step="10"
              :useDefaultSentinel="false"
            />
          </div>
          <p class="text-xs text-content-faint">
            {{ t('components.mount.onstepx.proxisky.acs.hint') }}
          </p>
          <button
            class="tns-btn-primary"
            :disabled="busy || !acsValid || !acsChanged"
            @click="write(() => apiService.setProxiskyAcsThresholds(acsRa, acsDec), 'acs')"
          >
            {{ t('components.mount.onstepx.apply') }}
          </button>
        </template>
        <div
          v-if="s.AcsCollisionsRa != null"
          class="flex items-center justify-between gap-3 text-sm"
        >
          <span class="text-content-muted">
            {{ t('components.mount.onstepx.proxisky.acs.collisions') }}
          </span>
          <span class="text-content">{{ s.AcsCollisionsRa }} / {{ s.AcsCollisionsDec }}</span>
        </div>
        <div v-if="s.AcsCollisionsRa != null" class="grid grid-cols-2 gap-2">
          <button class="tns-btn-secondary" :disabled="busy" @click="load()">
            {{ t('components.mount.onstepx.proxisky.refresh') }}
          </button>
          <button class="tns-btn-secondary" :disabled="busy" @click="clearCollisions">
            {{ t('components.mount.onstepx.proxisky.acs.clear') }}
          </button>
        </div>
      </section>

      <!-- Supervised goto -->
      <section v-if="s.SupervisedGoto != null" class="tns-card p-3! flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
            {{ t('components.mount.onstepx.proxisky.supervisedGoto.title') }}
          </h3>
          <InfoModal
            :title="t('components.mount.onstepx.proxisky.supervisedGoto.title')"
            :message="t('components.mount.onstepx.proxisky.info.supervisedGoto')"
            size="w-4 h-4"
          />
        </div>
        <div class="flex items-center justify-between gap-3">
          <span class="text-sm text-content">{{ switchLabel('SupervisedGoto') }}</span>
          <toggleButton
            :statusValue="s.SupervisedGoto"
            :disabled="busy"
            @update:statusValue="(value) => setSwitch('SupervisedGoto', value)"
          />
        </div>
        <template v-if="s.SupervisedGotoTolerance != null">
          <NumberInputPicker
            v-model="tolerance"
            :label="t('components.mount.onstepx.proxisky.supervisedGoto.tolerance')"
            labelKey="components.mount.onstepx.proxisky.supervisedGoto.tolerance"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="proxisky-goto-tolerance"
            :min="TOLERANCE_RANGE[0]"
            :max="TOLERANCE_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
          <p class="text-xs text-content-faint">
            {{ t('components.mount.onstepx.proxisky.supervisedGoto.hint') }}
          </p>
          <button
            class="tns-btn-primary"
            :disabled="busy || !toleranceValid || tolerance === s.SupervisedGotoTolerance"
            @click="
              write(() => apiService.setProxiskySupervisedGotoTolerance(tolerance), 'tolerance')
            "
          >
            {{ t('components.mount.onstepx.apply') }}
          </button>
        </template>
      </section>

      <!-- Servo PID gains (changeable on a UMi20S and UMi17X) -->
      <section v-if="pidAxes.length" class="tns-card p-3! flex flex-col gap-3">
        <div class="flex items-center gap-1">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
            {{ t('components.mount.onstepx.proxisky.pid.title') }}
          </h3>
          <InfoModal
            :title="t('components.mount.onstepx.proxisky.pid.title')"
            :message="t('components.mount.onstepx.proxisky.info.pid')"
            size="w-4 h-4"
          />
        </div>
        <div v-for="axis in pidAxes" :key="axis" class="flex flex-col gap-2">
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm text-content">{{ axisLabel(axis) }}</span>
            <span v-if="pidPending(axis)" class="text-xs text-content-faint">
              {{ t('components.mount.onstepx.proxisky.restartPending') }}
            </span>
          </div>
          <div v-if="s.CanSetPid" class="grid grid-cols-2 gap-2">
            <NumberInputPicker
              v-for="gain in PID_GAINS"
              :key="gain"
              v-model="pid[axis][gain]"
              :label="t(`components.mount.onstepx.proxisky.pid.${gain}`)"
              :labelKey="`components.mount.onstepx.proxisky.pid.${gain}`"
              labelPosition="top"
              wrapperClass="w-full"
              :inputId="`proxisky-pid-${axis}-${gain}`"
              :min="PID_RANGE[0]"
              :max="gain === 'speedKi' ? SPEED_KI_MAX : PID_RANGE[1]"
              :step="1"
              :useDefaultSentinel="false"
            />
          </div>
          <dl v-else class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <template v-for="gain in PID_GAINS" :key="gain">
              <dt class="text-content-muted">
                {{ t(`components.mount.onstepx.proxisky.pid.${gain}`) }}
              </dt>
              <dd class="text-right text-content">{{ pid[axis][gain] }}</dd>
            </template>
          </dl>
          <button
            v-if="s.CanSetPid"
            class="tns-btn-primary"
            :disabled="
              busy ||
              store.mountInfo.Slewing ||
              store.mountInfo.TrackingEnabled ||
              !pidValid(axis) ||
              !pidChanged(axis)
            "
            @click="writePid(axis)"
          >
            {{ t('components.mount.onstepx.apply') }}
          </button>
        </div>
        <p class="text-xs text-content-faint">
          {{
            s.CanSetPid
              ? t('components.mount.onstepx.proxisky.pid.hint')
              : t('components.mount.onstepx.proxisky.pid.readOnly')
          }}
        </p>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import AsyncLoadState from '@/components/helpers/AsyncLoadState.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';

// Ranges the OnStepXController accepts (it answers 400 outside them)
const RA_LIMIT_RANGE = [1, 180];
const DEC_LIMIT_RANGE = [90, 200];
const ACS_RA_RANGE = [10, 59999];
const ACS_DEC_RANGE = [100, 59999];
const TOLERANCE_RANGE = [5, 30];
const PID_RANGE = [11, 1999];
const SPEED_KI_MAX = 80;
const PID_GAINS = ['angleKp', 'angleKi', 'speedKp', 'speedKi'];

// Settings the mount runs only after a power cycle
const RESTART_BOUND = ['StatusLed', 'AutoTracking'];

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();

const s = ref(null);
const loadFailed = ref(false);
const loadError = ref('');
const busy = ref(false);

const raLeft = ref(null);
const raRight = ref(null);
const decCcw = ref(null);
const decCw = ref(null);
const acsRa = ref(null);
const acsDec = ref(null);
const tolerance = ref(null);
const pid = reactive({ Ra: {}, Dec: {} });

const isInt = (v) => Number.isInteger(v);
const inRange = (v, [lo, hi]) => isInt(v) && v >= lo && v <= hi;

const raValid = computed(
  () => inRange(raLeft.value, RA_LIMIT_RANGE) && inRange(raRight.value, RA_LIMIT_RANGE)
);
const raChanged = computed(
  () => raLeft.value !== s.value?.RaLimitLeft || raRight.value !== s.value?.RaLimitRight
);
const decValid = computed(
  () => inRange(decCcw.value, DEC_LIMIT_RANGE) && inRange(decCw.value, DEC_LIMIT_RANGE)
);
const decChanged = computed(
  () => decCcw.value !== s.value?.DecLimitCcw || decCw.value !== s.value?.DecLimitCw
);
const acsValid = computed(
  () => inRange(acsRa.value, ACS_RA_RANGE) && inRange(acsDec.value, ACS_DEC_RANGE)
);
const acsChanged = computed(
  () => acsRa.value !== s.value?.AcsThresholdRa || acsDec.value !== s.value?.AcsThresholdDec
);
const toleranceValid = computed(() => inRange(tolerance.value, TOLERANCE_RANGE));

// The switches without a section of their own; Dec second home is read-only except on a UMi17X
const generalSwitches = computed(() => {
  const v = s.value;
  if (!v) return [];
  return [
    'StatusLed',
    'PowerLossMemory',
    'AsiairHoming',
    'SupervisedHome',
    'DecSecondHome',
    'AutoTracking',
  ]
    .filter((key) => v[key] != null)
    .map((key) => ({
      key,
      writable: key !== 'DecSecondHome' || v.CanSetDecSecondHome,
      note: switchNote(key, v),
    }));
});

const pidAxes = computed(() => ['Ra', 'Dec'].filter((axis) => s.value?.[`${axis}Pid`]));

function switchNote(key, v) {
  if (v.RestartPending?.includes(key)) {
    return t('components.mount.onstepx.proxisky.restartPending');
  }
  if (RESTART_BOUND.includes(key)) {
    return t('components.mount.onstepx.proxisky.restartNote');
  }
  if (key === 'DecSecondHome' && !v.CanSetDecSecondHome) {
    return t('components.mount.onstepx.proxisky.umi17xOnly');
  }
  return null;
}

function switchLabel(key) {
  return t(`components.mount.onstepx.proxisky.switches.${key}`);
}

function axisLabel(axis) {
  return t(`components.mount.onstepx.proxisky.pid.${axis === 'Ra' ? 'ra' : 'dec'}`);
}

// The backend's gains use PascalCase (AngleKp); the form and the request use camelCase (angleKp)
function gainsFromSettings(gains) {
  return Object.fromEntries(
    PID_GAINS.map((gain) => [gain, gains?.[gain[0].toUpperCase() + gain.slice(1)] ?? null])
  );
}

function pidValid(axis) {
  return PID_GAINS.every((gain) =>
    inRange(pid[axis][gain], [PID_RANGE[0], gain === 'speedKi' ? SPEED_KI_MAX : PID_RANGE[1]])
  );
}

function pidChanged(axis) {
  const stored = gainsFromSettings(s.value?.[`${axis}Pid`]);
  return PID_GAINS.some((gain) => pid[axis][gain] !== stored[gain]);
}

function pidPending(axis) {
  return s.value?.RestartPending?.includes(`${axis}Pid`);
}

// The controller's own reason for a 400 (e.g. a refused value), otherwise a generic message
function errorMessage(error) {
  return error?.response?.data?.Error || t('components.mount.onstepx.failed');
}

// The form fields of each section and the settings they edit
const FORM_SECTIONS = {
  ra: [
    [raLeft, 'RaLimitLeft'],
    [raRight, 'RaLimitRight'],
  ],
  dec: [
    [decCcw, 'DecLimitCcw'],
    [decCw, 'DecLimitCw'],
  ],
  acs: [
    [acsRa, 'AcsThresholdRa'],
    [acsDec, 'AcsThresholdDec'],
  ],
  tolerance: [[tolerance, 'SupervisedGotoTolerance']],
};

// Takes the mount's values, but keeps a section the user edited and has not applied yet; the
// section just written ('ra', 'dec', 'acs', 'tolerance', 'Ra' or 'Dec') always shows the mount's
function applyForm(v, written) {
  const previous = s.value;
  for (const [section, fields] of Object.entries(FORM_SECTIONS)) {
    const edited =
      previous &&
      section !== written &&
      fields.some(([field, key]) => field.value !== previous[key]);
    if (!edited) {
      fields.forEach(([field, key]) => (field.value = v[key]));
    }
  }
  for (const axis of ['Ra', 'Dec']) {
    if (!previous || axis === written || !pidChanged(axis)) {
      pid[axis] = gainsFromSettings(v[`${axis}Pid`]);
    }
  }
  s.value = v;
}

async function load(written) {
  try {
    const data = await apiService.getProxiskySettings();
    if (!data?.Success || !data.Response) throw new Error(data?.Error);
    loadFailed.value = false;
    applyForm(data.Response, written);
  } catch (error) {
    loadFailed.value = true;
    loadError.value = error?.response?.data?.Error || error?.message || '';
    // with settings on screen AsyncLoadState is hidden, so say it here (e.g. the mount was disconnected)
    if (s.value) {
      toastStore.showToast({
        type: 'error',
        title: t('components.mount.onstepx.proxisky.loadFailed'),
        message: loadError.value,
      });
    }
  }
}

// Runs one write, reports the result and re-reads the mount, so the form shows what it stored
async function write(action, written) {
  busy.value = true;
  try {
    await action();
    toastStore.showToast({ type: 'success', message: t('components.mount.onstepx.saved') });
  } catch (error) {
    toastStore.showToast({
      type: 'error',
      title: t('components.mount.onstepx.failed'),
      message: errorMessage(error),
    });
  } finally {
    await load(written);
    busy.value = false;
  }
}

function setSwitch(key, enabled) {
  return write(() => apiService.setProxiskySwitch(key, enabled));
}

async function clearCollisions() {
  const ok = await toastStore.showConfirmation(
    t('components.mount.onstepx.proxisky.acs.clearConfirmTitle'),
    t('components.mount.onstepx.proxisky.acs.clearConfirm'),
    t('common.confirm'),
    t('common.cancel')
  );
  if (ok) await write(() => apiService.clearProxiskyCollisionCounters());
}

async function writePid(axis) {
  const ok = await toastStore.showConfirmation(
    t('components.mount.onstepx.proxisky.pid.confirmTitle'),
    t('components.mount.onstepx.proxisky.pid.confirm', { axis: axisLabel(axis) }),
    t('common.confirm'),
    t('common.cancel')
  );
  if (ok) await write(() => apiService.setProxiskyPid(axis, { ...pid[axis] }), axis);
}

onMounted(load);
</script>
