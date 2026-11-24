<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="connected"
      class="rounded-control border border-status-warn/40 bg-status-warn/10 p-3 text-sm text-content"
    >
      {{ t('components.deviceDriverFinder.disconnectFirst') }}
    </p>

    <template v-if="!selected">
      <span class="tns-label">{{ t('components.deviceDriverFinder.brandLabel') }}</span>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="entry in brands"
          :key="entry.brand"
          type="button"
          class="tns-btn-secondary w-auto! px-3! text-xs!"
          @click="select(entry)"
        >
          {{ entry.brand }}
        </button>
      </div>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-2">
        <span class="font-semibold text-content">{{ selected.brand }}</span>
        <button
          type="button"
          class="tns-btn-ghost px-2! text-xs! shrink-0"
          :disabled="busy"
          @click="select(null)"
        >
          {{ t('components.deviceDriverFinder.otherBrand') }}
        </button>
      </div>

      <div v-if="loadingDrivers" class="flex items-center gap-2 text-sm text-content-muted">
        <Spinner size="sm" />{{ t('components.mountDriverFinder.checking') }}
      </div>
      <template v-else-if="driverListFailed">
        <p class="text-sm text-status-danger">
          {{ t('components.mountDriverFinder.driverListFailed') }}
        </p>
        <button type="button" class="tns-btn-secondary" @click="loadInstalledDrivers">
          {{ t('components.mountDriverFinder.retry') }}
        </button>
      </template>

      <template v-else-if="!resultText">
        <p v-if="isCurrentDriver" class="text-sm text-content-muted">
          {{ t('components.mountDriverFinder.alreadySet') }}
        </p>
        <button
          v-if="availability === 'installed'"
          type="button"
          :class="isCurrentDriver ? 'tns-btn-secondary' : 'tns-btn-primary'"
          :disabled="busy || connected"
          @click="run(false)"
        >
          <Spinner v-if="busy" size="sm" />
          {{ t('components.mountDriverFinder.useDriver') }}
        </button>
        <template v-else-if="availability === 'installable'">
          <p class="text-sm text-content-muted">
            {{
              t(
                confirmInstall
                  ? 'components.mountDriverFinder.installConfirm'
                  : 'components.mountDriverFinder.needsInstall',
                { name: selected.driver }
              )
            }}
          </p>
          <button
            type="button"
            class="tns-btn-primary"
            :disabled="busy || connected"
            @click="confirmInstall ? run(true) : (confirmInstall = true)"
          >
            <Spinner v-if="busy" size="sm" />
            {{
              t(
                confirmInstall
                  ? 'components.mountDriverFinder.installConfirmYes'
                  : 'components.mountDriverFinder.installAndUse'
              )
            }}
          </button>
        </template>
        <p v-else class="text-sm text-content-muted">
          {{ t('components.mountDriverFinder.unavailable', { name: selected.driver }) }}
        </p>
      </template>

      <p v-if="progressText" class="text-sm text-content-muted">{{ progressText }}</p>
      <div
        v-if="resultText"
        class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
      >
        <span class="tns-dot bg-status-ok mt-1.5"></span>
        <p class="text-sm text-content">{{ resultText }}</p>
      </div>
      <p v-if="errorText" class="text-sm text-status-danger break-words">{{ errorText }}</p>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import Spinner from '@/components/helpers/Spinner.vue';
import { installIndiDriver } from '@/components/pins/composables/installIndiDriver';
import { extractIndiInstallErrorDetail } from '@/components/pins/composables/indiInstallUtils';
import { DEVICE_MAP, applyIndiDriver } from '@/utils/equipmentDevices';
import { DEVICE_BRANDS, brandAvailability } from '@/utils/deviceDriverCatalog';

/**
 * "Which driver does my camera / filter wheel need?" for PINS: the user taps the brand and the
 * matching INDI driver is set, installed first if it is missing, and its device selected.
 * Connecting stays a tap of its own.
 */
const props = defineProps({
  // INDI device type and key of DEVICE_BRANDS: 'camera' | 'filterwheel'
  deviceType: { type: String, required: true },
  // e.g. 'cameraAction'
  apiAction: { type: String, required: true },
  // Changing the driver restarts it, which would cut a live connection
  connected: { type: Boolean, default: false },
});
const emit = defineEmits(['applied']);

const { t } = useI18n();
const store = apiStore();

const brands = DEVICE_BRANDS[props.deviceType] ?? [];
const selected = ref(null);
const installedDrivers = ref([]);
const loadingDrivers = ref(false);
const driverListFailed = ref(false);
const busy = ref(false);
const confirmInstall = ref(false);
const progressText = ref('');
const resultText = ref('');
const errorText = ref('');

const availability = computed(() => brandAvailability(selected.value, installedDrivers.value));
const isCurrentDriver = computed(
  () =>
    Boolean(selected.value) &&
    store.profileInfo?.[DEVICE_MAP[props.apiAction].section]?.IndiDriver === selected.value.driver
);

function select(entry) {
  selected.value = entry;
  confirmInstall.value = false;
  resultText.value = '';
  errorText.value = '';
}

async function loadInstalledDrivers() {
  loadingDrivers.value = true;
  driverListFailed.value = false;
  try {
    const response = await apiPinsService.getINDIDeviceList(props.deviceType);
    if (!Array.isArray(response?.Response)) throw new Error(response?.Error || 'no list');
    installedDrivers.value = response.Response.map((driver) => driver.Name);
  } catch (error) {
    console.error('[BrandDriverFinder] INDI driver list failed:', error);
    driverListFailed.value = true;
  } finally {
    loadingDrivers.value = false;
  }
}

async function install(entry) {
  progressText.value = t('components.mountDriverFinder.installing', { name: entry.brand });
  let result;
  try {
    result = await installIndiDriver({
      packageName: entry.package,
      type: props.deviceType,
      label: entry.brand,
    });
  } catch (error) {
    throw new Error(
      t('components.mountDriverFinder.installFailed', {
        message: extractIndiInstallErrorDetail(error),
      })
    );
  }
  if (result === 'noInternet') throw new Error(t('components.mountDriverFinder.noInternet'));
  if (result === 'packageMissing') {
    throw new Error(t('components.mountDriverFinder.packageMissing', { name: entry.package }));
  }
  await loadInstalledDrivers();
  if (!installedDrivers.value.includes(entry.driver)) {
    throw new Error(t('components.mountDriverFinder.installedButMissing', { name: entry.brand }));
  }
}

async function apply(entry) {
  progressText.value = t('components.mountDriverFinder.applying', { name: entry.brand });
  try {
    const { deviceId } = await applyIndiDriver(props.apiAction, entry.driver);
    resultText.value = deviceId
      ? t('components.deviceDriverFinder.applied', { device: deviceId })
      : t('components.deviceDriverFinder.appliedPickDevice');
    emit('applied', { driver: entry.driver, deviceId });
  } catch (error) {
    throw new Error(
      t('components.mountDriverFinder.applyFailed', { message: error?.message || '' })
    );
  }
}

async function run(withInstall) {
  const entry = selected.value;
  if (busy.value || props.connected || !entry) return;
  busy.value = true;
  errorText.value = '';
  try {
    if (withInstall) await install(entry);
    await apply(entry);
  } catch (error) {
    console.error('[BrandDriverFinder]', error);
    errorText.value = error.message;
  } finally {
    progressText.value = '';
    confirmInstall.value = false;
    busy.value = false;
  }
}

onMounted(loadInstalledDrivers);
</script>
