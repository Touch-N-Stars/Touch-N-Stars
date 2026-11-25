<template>
  <section class="tns-card flex flex-col gap-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="tns-section-title">{{ $t('components.simpleMode.rig.title') }}</h2>
      <router-link to="/equipment" class="text-xs text-accent underline shrink-0">
        {{ $t('components.simpleMode.rig.changeDevices') }}
      </router-link>
    </div>

    <!-- No device in the profile: nothing to connect, the setup assistant is the way in -->
    <div v-if="devices.length === 0" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">{{ $t('components.simpleMode.rig.empty') }}</p>
      <button type="button" class="tns-btn-primary" @click="settingsStore.resetSetupWizard()">
        {{ $t('components.simpleMode.rig.openWizard') }}
      </button>
    </div>

    <template v-else>
      <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <li
          v-for="device in devices"
          :key="device.apiName"
          class="flex items-center gap-3 rounded-chip bg-surface-2 px-3 py-2 min-h-14"
        >
          <span
            class="tns-dot w-2.5! h-2.5!"
            :class="device.connected ? 'bg-status-ok' : 'bg-status-danger'"
          ></span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold text-content truncate">{{
              device.label
            }}</span>
            <span class="block text-xs text-content-muted truncate">{{ device.detail }}</span>
          </span>
        </li>
      </ul>

      <button
        type="button"
        class="tns-btn-primary"
        :disabled="isConnecting || allConnected"
        @click="connectAll"
      >
        <Spinner v-if="isConnecting" size="sm" />
        <CheckCircleIcon v-else-if="allConnected" class="w-5 h-5" />
        <span>{{
          isConnecting
            ? $t('components.simpleMode.rig.connecting')
            : allConnected
              ? $t('components.simpleMode.rig.allConnected')
              : $t('components.simpleMode.rig.connectAll')
        }}</span>
      </button>

      <!-- The usual reason a mount is missing or will not connect on PINS is the wrong (or a
           missing) INDI driver - offer the finder right where that shows. The other devices
           are optional, so only a failed connect brings it up for them. -->
      <div v-if="offerMountDriver" class="flex flex-col gap-2">
        <p class="text-xs text-content-muted">
          {{
            mountInProfile
              ? $t('components.simpleMode.rig.mountFailedHint')
              : $t('components.simpleMode.rig.noMountHint')
          }}
        </p>
        <button type="button" class="tns-btn-secondary" @click="openFinder('mount')">
          {{ $t('components.mountDriverFinder.openButton') }}
        </button>
      </div>
      <div v-if="brandOffers.length" class="flex flex-col gap-2">
        <p class="text-xs text-content-muted">
          {{
            $t('components.simpleMode.rig.devicesFailedHint', {
              devices: brandOffers.map(deviceLabel).join(', '),
            })
          }}
        </p>
        <button
          v-for="apiName in brandOffers"
          :key="apiName"
          type="button"
          class="tns-btn-secondary"
          @click="openFinder(apiName)"
        >
          {{ $t('components.deviceDriverFinder.openButton', { device: deviceLabel(apiName) }) }}
        </button>
      </div>
    </template>

    <Modal
      :show="showFinder"
      :disableClose="finderBusy"
      :closeOnBackdropClick="!finderBusy"
      @close="showFinder = false"
    >
      <template #header>
        <h2 class="text-xl font-semibold">
          {{
            finderFor === 'mount'
              ? $t('components.mountDriverFinder.title')
              : $t('components.deviceDriverFinder.openButton', { device: deviceLabel(finderFor) })
          }}
        </h2>
      </template>
      <template #body>
        <MountDriverFinder
          v-if="finderFor === 'mount'"
          @busy="finderBusy = $event"
          @applied="clearFailed('mount')"
        />
        <div v-else-if="BRAND_FINDERS[finderFor]" :key="finderFor" class="flex flex-col gap-3">
          <BrandDriverFinder
            :deviceType="BRAND_FINDERS[finderFor].deviceType"
            :apiAction="apiActionForApiName(finderFor)"
            :connected="Boolean(isDeviceConnected(finderFor))"
            @busy="finderBusy = $event"
            @applied="onBrandApplied"
          />
          <IndiDriverSelect
            ref="driverSelect"
            :deviceType="BRAND_FINDERS[finderFor].deviceType"
            :listAction="apiActionForApiName(finderFor)"
            :profileSection="DEVICE_MAP[apiActionForApiName(finderFor)].section"
            :label="$t(BRAND_FINDERS[finderFor].selectLabelKey)"
            :connected="Boolean(isDeviceConnected(finderFor))"
            @driver-applied="clearFailed(finderFor)"
          />
        </div>
      </template>
    </Modal>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircleIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import Spinner from '@/components/helpers/Spinner.vue';
import Modal from '@/components/helpers/Modal.vue';
import MountDriverFinder from '@/components/equipment/MountDriverFinder.vue';
import BrandDriverFinder from '@/components/equipment/BrandDriverFinder.vue';
import IndiDriverSelect from '@/components/setupWizard/IndiDriverSelect.vue';
import { useEquipmentConnection } from '@/composables/useEquipmentConnection';
import { DEVICE_MAP, apiActionForApiName } from '@/utils/equipmentDevices';
import { localDecimal } from '@/utils/localeNumber';

const { t } = useI18n();
const store = apiStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const {
  isConnecting,
  allConnected,
  failedConnects,
  equipmentToConnect,
  isDeviceConnected,
  connectAll,
} = useEquipmentConnection();

// Label key per apiName under components.connectEquipment.<key>.name
const LABEL_KEYS = {
  camera: 'camera',
  guidecamera: 'guideCamera',
  mount: 'mount',
  focuser: 'focuser',
  filter: 'filter',
  rotator: 'rotator',
  guider: 'guider',
  safety: 'safety',
  flatdevice: 'flat',
  dome: 'dome',
  switch: 'switch',
  weather: 'weather',
};

function deviceLabel(apiName) {
  const labelKey = LABEL_KEYS[apiName];
  return labelKey ? t(`components.connectEquipment.${labelKey}.name`) : apiName;
}

function formatTemp(value) {
  return Number.isFinite(value) ? `${localDecimal(value, 1)} °C` : '';
}

function connectedDetail(apiName) {
  switch (apiName) {
    case 'camera': {
      const info = store.cameraInfo;
      const parts = [formatTemp(info.Temperature)];
      if (info.IsExposing) parts.push(t('components.simpleMode.rig.exposing'));
      else if (cameraStore.coolingState === 'cooling')
        parts.push(t('components.simpleMode.rig.coolingTo', { temp: formatTemp(info.TargetTemp) }));
      return parts.filter(Boolean).join(' · ');
    }
    case 'mount': {
      const info = store.mountInfo;
      if (store.mountIsParked) return t('components.simpleMode.rig.parked');
      if (store.mountIsSlewing) return t('components.simpleMode.rig.slewing');
      return info.TrackingEnabled
        ? t('components.simpleMode.rig.tracking')
        : t('components.simpleMode.rig.notTracking');
    }
    case 'focuser':
      return store.focuserAfInfo?.autofocus_running
        ? t('components.simpleMode.rig.autofocusRunning')
        : t('components.simpleMode.rig.position', { position: store.focuserInfo.Position ?? '–' });
    case 'filter':
      return store.filterInfo.SelectedFilter?.Name ?? '';
    case 'guider':
      return store.guiderInfo.State
        ? t(`components.simpleMode.guiderState.${guiderStateKey(store.guiderInfo.State)}`)
        : '';
    default:
      return '';
  }
}

const GUIDER_STATE_KEYS = [
  'Guiding',
  'Calibrating',
  'Looping',
  'LostLock',
  'Paused',
  'Reacquiring',
];

function guiderStateKey(state) {
  return GUIDER_STATE_KEYS.includes(state) ? state : 'Idle';
}

// Devices whose driver depends on the brand only, by apiName.
const BRAND_FINDERS = {
  camera: {
    deviceType: 'camera',
    selectLabelKey: 'components.setupWizard.camera.selectDriver',
  },
  guidecamera: {
    deviceType: 'camera',
    selectLabelKey: 'components.setupWizard.camera.selectDriver',
  },
  focuser: {
    deviceType: 'focuser',
    selectLabelKey: 'components.setupWizard.focuser.selectDriver',
  },
  filter: {
    deviceType: 'filterwheel',
    selectLabelKey: 'components.setupWizard.filterWheel.selectDriver',
  },
};

const showFinder = ref(false);
const finderFor = ref('');
const finderBusy = ref(false);
const driverSelect = ref(null);

function openFinder(apiName) {
  finderFor.value = apiName;
  showFinder.value = true;
}

// Devices the last "connect all" failed on, until they connect or get another driver.
const failedDevices = ref([]);

function clearFailed(apiName) {
  failedDevices.value = failedDevices.value.filter((name) => name !== apiName);
}

function onBrandApplied() {
  clearFailed(finderFor.value);
  driverSelect.value?.loadDrivers();
}

watch(isConnecting, (connecting) => {
  failedDevices.value = connecting ? [] : [...failedConnects.value];
});
watch(
  () => failedDevices.value.filter((name) => isDeviceConnected(name)),
  (connected) => connected.forEach(clearFailed)
);

const mountInProfile = computed(() =>
  equipmentToConnect.value.some((device) => device.apiName === 'mount')
);
// PINS only: INDI drivers do not exist on NINA/Windows.
const offersPossible = computed(() => store.isPINS && !isConnecting.value);
const offerMountDriver = computed(
  () => offersPossible.value && (!mountInProfile.value || failedDevices.value.includes('mount'))
);
const brandOffers = computed(() =>
  offersPossible.value ? failedDevices.value.filter((apiName) => BRAND_FINDERS[apiName]) : []
);

const devices = computed(() =>
  equipmentToConnect.value.map((device) => {
    const connected = isDeviceConnected(device.apiName);
    const detail = connected ? connectedDetail(device.apiName) : '';
    return {
      apiName: device.apiName,
      connected,
      label: deviceLabel(device.apiName),
      detail: connected
        ? detail || t('components.simpleMode.rig.connected')
        : t('components.simpleMode.rig.notConnected'),
    };
  })
);
</script>
