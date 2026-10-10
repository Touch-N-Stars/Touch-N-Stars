<template>
  <div class="flex flex-col gap-3">
    <AsyncLoadState v-if="!settings" :failed="loadFailed" :message="loadError" />

    <template v-else>
      <!-- Altitude limits -->
      <section class="tns-card p-3! flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.altitude.title') }}
        </h3>
        <div class="grid grid-cols-2 gap-2">
          <NumberInputPicker
            v-model="altMin"
            :label="t('components.mount.onstepx.altitude.min')"
            labelKey="components.mount.onstepx.altitude.min"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="onstepx-alt-min"
            :min="ALT_MIN_RANGE[0]"
            :max="ALT_MIN_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
          <NumberInputPicker
            v-model="altMax"
            :label="t('components.mount.onstepx.altitude.max')"
            labelKey="components.mount.onstepx.altitude.max"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="onstepx-alt-max"
            :min="ALT_MAX_RANGE[0]"
            :max="ALT_MAX_RANGE[1]"
            :step="1"
            :useDefaultSentinel="false"
          />
        </div>
        <p class="text-xs text-content-faint">
          {{ t('components.mount.onstepx.altitude.hint') }}
        </p>
        <button
          class="tns-btn-primary"
          :disabled="busy || !altMinValid || !altMaxValid || !altChanged"
          @click="applyAltitudeLimits"
        >
          {{ t('components.mount.onstepx.apply') }}
        </button>
      </section>

      <!-- Meridian limits -->
      <section class="tns-card p-3! flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.meridian.title') }}
        </h3>
        <div class="grid grid-cols-2 gap-2">
          <NumberInputPicker
            v-model="merEast"
            :label="t('components.mount.onstepx.meridian.east')"
            labelKey="components.mount.onstepx.meridian.east"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="onstepx-mer-east"
            :min="-MERIDIAN_RANGE"
            :max="MERIDIAN_RANGE"
            :step="0.25"
            :useDefaultSentinel="false"
          />
          <NumberInputPicker
            v-model="merWest"
            :label="t('components.mount.onstepx.meridian.west')"
            labelKey="components.mount.onstepx.meridian.west"
            labelPosition="top"
            wrapperClass="w-full"
            inputId="onstepx-mer-west"
            :min="-MERIDIAN_RANGE"
            :max="MERIDIAN_RANGE"
            :step="0.25"
            :useDefaultSentinel="false"
          />
        </div>
        <p class="text-xs text-content-faint">
          {{ t('components.mount.onstepx.meridian.hint') }}
        </p>
        <button
          class="tns-btn-primary"
          :disabled="busy || !merEastValid || !merWestValid || !merChanged"
          @click="applyMeridianLimits"
        >
          {{ t('components.mount.onstepx.apply') }}
        </button>
      </section>

      <!-- Preferred pier side -->
      <section class="tns-card p-3! flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.pierSide.title') }}
        </h3>
        <select v-model="pierSide" class="tns-select" :disabled="busy" @change="applyPierSide">
          <option value="">{{ t('components.mount.onstepx.pierSide.mount') }}</option>
          <option v-for="side in PIER_SIDES" :key="side" :value="side">
            {{ pierSideLabel(side) }}
          </option>
        </select>
        <p class="text-xs text-content-faint">
          {{
            t('components.mount.onstepx.pierSide.current', {
              side: pierSideLabel(settings.PreferredPierSide),
            })
          }}
        </p>
      </section>

      <!-- Set home -->
      <section class="tns-card p-3! flex flex-col gap-3">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.home.title') }}
        </h3>
        <p class="text-xs text-content-faint">{{ t('components.mount.onstepx.home.hint') }}</p>
        <button class="tns-btn-danger" :disabled="busy || store.mountInfo.Slewing" @click="setHome">
          {{ t('components.mount.onstepx.home.button') }}
        </button>
      </section>

      <!-- Controller info -->
      <section class="tns-card p-3! flex flex-col gap-2">
        <h3 class="text-sm font-semibold uppercase tracking-wide text-content-muted">
          {{ t('components.mount.onstepx.info.title') }}
        </h3>
        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <template v-for="row in infoRows" :key="row.label">
            <dt class="text-content-muted">{{ row.label }}</dt>
            <dd class="text-right text-content break-all select-text">{{ row.value }}</dd>
          </template>
        </dl>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import AsyncLoadState from '@/components/helpers/AsyncLoadState.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

// Ranges the OnStepXController accepts (it answers 400 outside them)
const ALT_MIN_RANGE = [-30, 30];
const ALT_MAX_RANGE = [60, 90];
const MERIDIAN_RANGE = 360;
const PIER_SIDES = ['East', 'West', 'Best'];

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();

const settings = ref(null);
const loadFailed = ref(false);
const loadError = ref('');
const busy = ref(false);

const altMin = ref(null);
const altMax = ref(null);
const merEast = ref(null);
const merWest = ref(null);
const pierSide = ref('');

const isInt = (v) => Number.isInteger(v);
const inRange = (v, [lo, hi]) => typeof v === 'number' && v >= lo && v <= hi;

const altMinValid = computed(() => isInt(altMin.value) && inRange(altMin.value, ALT_MIN_RANGE));
const altMaxValid = computed(() => isInt(altMax.value) && inRange(altMax.value, ALT_MAX_RANGE));
const merEastValid = computed(() => inRange(merEast.value, [-MERIDIAN_RANGE, MERIDIAN_RANGE]));
const merWestValid = computed(() => inRange(merWest.value, [-MERIDIAN_RANGE, MERIDIAN_RANGE]));

const altChanged = computed(
  () =>
    altMin.value !== settings.value?.HorizonLimit || altMax.value !== settings.value?.OverheadLimit
);
const merChanged = computed(
  () =>
    merEast.value !== settings.value?.MeridianLimitEast ||
    merWest.value !== settings.value?.MeridianLimitWest
);

const infoRows = computed(() => {
  const s = settings.value;
  if (!s) return [];
  const firmware = [s.FirmwareName, s.FirmwareVersion].filter(Boolean).join(' ');
  return [
    { label: t('components.mount.onstepx.info.model'), value: s.Model },
    { label: t('components.mount.onstepx.info.firmware'), value: firmware },
    { label: t('components.mount.onstepx.info.firmwareDate'), value: s.FirmwareDate },
    { label: t('components.mount.onstepx.info.vendorFirmware'), value: s.VendorFirmware },
    { label: t('components.mount.onstepx.info.serialPort'), value: s.SerialPort },
    {
      label: t('components.mount.onstepx.info.guideRate'),
      value: s.PulseGuideRate != null ? `${s.PulseGuideRate}×` : null,
    },
  ].filter((row) => row.value != null && row.value !== '');
});

function pierSideLabel(side) {
  if (PIER_SIDES.includes(side)) {
    return t(`components.mount.onstepx.pierSide.${side.toLowerCase()}`);
  }
  return side || '–';
}

// The controller's own reason for a 400 (e.g. a refused limit), otherwise a generic message
function errorMessage(error) {
  return error?.response?.data?.Error || t('components.mount.onstepx.failed');
}

function applyForm(s) {
  settings.value = s;
  altMin.value = s.HorizonLimit;
  altMax.value = s.OverheadLimit;
  merEast.value = s.MeridianLimitEast;
  merWest.value = s.MeridianLimitWest;
  pierSide.value = s.ProfilePreferredPierSide ?? '';
}

async function load() {
  try {
    const data = await apiService.getOnStepXSettings();
    if (!data?.Success || !data.Response) throw new Error(data?.Error);
    loadFailed.value = false;
    applyForm(data.Response);
  } catch (error) {
    loadFailed.value = true;
    loadError.value = errorMessage(error);
  }
}

// Runs one write, reports the result and re-reads the controller, so the form shows what the
// controller actually stored (meridian limits are rounded to 0.25°, for example).
async function write(action) {
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
    await load();
    busy.value = false;
  }
}

function applyAltitudeLimits() {
  return write(() => apiService.setOnStepXAltitudeLimits(altMin.value, altMax.value));
}

function applyMeridianLimits() {
  return write(() => apiService.setOnStepXMeridianLimits(merEast.value, merWest.value));
}

function applyPierSide() {
  return write(() => apiService.setOnStepXPreferredPierSide(pierSide.value));
}

async function setHome() {
  const ok = await toastStore.showConfirmation(
    t('components.mount.onstepx.home.confirmTitle'),
    t('components.mount.onstepx.home.confirm'),
    t('common.confirm'),
    t('common.cancel')
  );
  if (ok) await write(() => apiService.setOnStepXHome());
}

onMounted(load);
</script>
