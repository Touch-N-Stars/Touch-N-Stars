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
           missing) INDI driver - offer the finder right where that shows. -->
      <div v-if="offerMountDriver" class="flex flex-col gap-2">
        <p class="text-xs text-content-muted">
          {{
            mountInProfile
              ? $t('components.simpleMode.rig.mountFailedHint')
              : $t('components.simpleMode.rig.noMountHint')
          }}
        </p>
        <button type="button" class="tns-btn-secondary" @click="showMountFinder = true">
          {{ $t('components.mountDriverFinder.openButton') }}
        </button>
      </div>
    </template>

    <Modal
      :show="showMountFinder"
      :disableClose="finderBusy"
      :closeOnBackdropClick="!finderBusy"
      @close="showMountFinder = false"
    >
      <template #header>
        <h2 class="text-xl font-semibold">{{ $t('components.mountDriverFinder.title') }}</h2>
      </template>
      <template #body>
        <MountDriverFinder @busy="finderBusy = $event" @applied="mountAttemptFailed = false" />
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
import { useEquipmentConnection } from '@/composables/useEquipmentConnection';

const { t } = useI18n();
const store = apiStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const { isConnecting, allConnected, equipmentToConnect, isDeviceConnected, connectAll } =
  useEquipmentConnection();

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

function formatTemp(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} °C` : '';
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

const showMountFinder = ref(false);
const finderBusy = ref(false);
// Set when "connect all" finished without the mount: connectAll waits for the mount to report
// connected before it moves on, so at that point a missing connection is a real failure.
const mountAttemptFailed = ref(false);
const mountInProfile = computed(() =>
  equipmentToConnect.value.some((device) => device.apiName === 'mount')
);
watch(isConnecting, (connecting, wasConnecting) => {
  if (wasConnecting && !connecting) {
    mountAttemptFailed.value = mountInProfile.value && !isDeviceConnected('mount');
  }
});
watch(
  () => isDeviceConnected('mount'),
  (connected) => {
    if (connected) mountAttemptFailed.value = false;
  }
);
// PINS only: INDI drivers do not exist on NINA/Windows.
const offerMountDriver = computed(
  () =>
    store.isPINS &&
    !isConnecting.value &&
    (!mountInProfile.value || (mountAttemptFailed.value && !isDeviceConnected('mount')))
);

const devices = computed(() =>
  equipmentToConnect.value.map((device) => {
    const connected = isDeviceConnected(device.apiName);
    const labelKey = LABEL_KEYS[device.apiName];
    const detail = connected ? connectedDetail(device.apiName) : '';
    return {
      apiName: device.apiName,
      connected,
      label: labelKey ? t(`components.connectEquipment.${labelKey}.name`) : device.apiName,
      detail: connected
        ? detail || t('components.simpleMode.rig.connected')
        : t('components.simpleMode.rig.notConnected'),
    };
  })
);
</script>
