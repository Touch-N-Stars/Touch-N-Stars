<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.guider.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{
          isNativeGuider
            ? t('components.setupWizard.guider.descriptionNative')
            : t('components.setupWizard.guider.description')
        }}
      </p>
    </div>

    <!-- 1. Guide camera. The PINS native guider uses PINS' guide camera slot, with
         device and INDI driver picked like the imaging camera's. Its cog sets the slot's
         own Alpaca static IP. -->
    <div v-if="guideCameraSlot" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.guider.guideCamera') }}
        </span>
        <selectDevices
          labeledConnect
          apiAction="guideCameraAction"
          :deviceName="$t('components.connectEquipment.guideCamera.name')"
          :default-device-id="store.profileInfo?.GuideCameraSettings?.Id"
          :isConnected="store.guideCameraInfo?.Connected"
          @open-config="openGuideCameraSettings"
        />
      </div>
      <IndiDriverSelect
        deviceType="camera"
        :settingPath="`${GUIDE_CAMERA.section}-IndiDriver`"
        listAction="guideCameraAction"
        :rescanKey="GUIDE_CAMERA.rescanKey"
        :profileSection="GUIDE_CAMERA.section"
        :label="t('components.setupWizard.camera.selectDriver')"
      />
    </div>

    <!-- PHD2 enumerates its own drivers, so unlike every other device step there
         is no INDI driver to pick here. -->
    <div v-else-if="!isNativeGuider" class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.guider.guideCamera') }}
      </span>
      <selectGuiderCam :deviceName="$t('components.connectEquipment.guiderCam.name')" />
      <p class="text-xs text-content-faint">
        {{ t('components.setupWizard.guider.guideCameraHint') }}
      </p>
    </div>

    <!-- 2. Guider device. PHD2 stays locked until the mount is connected and a
         guide camera is picked - same gating as connectEquipment.vue. -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.guider.connectDevice') }}
      </span>
      <selectDevices
        labeledConnect
        apiAction="guiderAction"
        :deviceName="$t('components.connectEquipment.guider.name')"
        :default-device-id="store.profileInfo?.GuiderSettings?.GuiderName"
        :isConnected="store.guiderInfo?.Connected"
        :disableConnect="isGuiderConnectDisabled"
        :disableConnectMessage="guiderDisabledMessage"
        :alwaysEnableConfig="true"
        @device-selected="selectedGuiderDevice = $event"
      />
    </div>

    <div
      v-if="store.guiderInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{ t('components.setupWizard.guider.connected', { name: store.guiderInfo?.Name || '' }) }}
      </p>
    </div>

    <!-- Native guider: guide source and optics from its own settings. -->
    <div v-if="isNativeGuider" class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.guider.nativeCamera') }}
      </span>
      <NativeSettingsSheet :names="NATIVE_WIZARD_SETTINGS" compact />
      <p class="text-xs text-content-faint">
        {{ t('components.setupWizard.guider.nativeCameraHint') }}
      </p>
      <!-- Guiding runs without it, which is why it stayed at 0 in the lay-user test -->
      <p v-if="nativeFocalLengthMissing" class="text-xs text-status-warn">
        {{ t('components.setupWizard.guider.nativeFocalLengthMissing') }}
      </p>
    </div>

    <!-- 3. Guide scope focal length. This lives in the PHD2 profile, not in
         NINA's - there is no GuiderSettings-FocalLength. -->
    <div v-else class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.guider.focalLength') }}
      </span>
      <Phd2FocalLength />
      <p class="text-xs text-content-faint">
        {{ t('components.setupWizard.guider.focalLengthHint') }}
      </p>
    </div>

    <!-- zIndex must clear the wizard overlay (z-overlay), as in WizardCameraStep. -->
    <Modal
      :show="showGuideCameraSettings"
      zIndex="z-overlay-modal"
      @close="showGuideCameraSettings = false"
    >
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.alpacaDirect.title') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedGuideCameraObj)"
          deviceType="guidecamera"
          :selectedDevice="selectedGuideCameraDevice"
          :deviceId="selectedGuideCameraObj?.Id"
        />
        <p v-else class="text-sm text-content">
          {{ $t('components.alpacaDirect.cameraNoSettings') }}
        </p>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useSettingsStore } from '@/store/settingsStore';
import apiService from '@/services/apiService';
import selectDevices from '@/components/equipment/selectDevices.vue';
import Modal from '@/components/helpers/Modal.vue';
import SettingsAlpacaDirect from '@/components/equipment/SettingsAlpacaDirect.vue';
import selectGuiderCam from '@/components/guider/PHD2/selectGuiderCam.vue';
import Phd2FocalLength from '@/components/guider/PHD2/pins/Phd2FocalLength.vue';
import IndiDriverSelect from '../IndiDriverSelect.vue';
import { DEVICE_MAP, phd2ConnectBlockers, setProfileDevice } from '@/utils/equipmentDevices';
import {
  NATIVE_WIZARD_SETTINGS,
  NATIVE_GUIDER_ID,
  isNativeGuiderInUse,
  usesGuideCameraSlot,
} from '@/utils/nativeGuider';

// Native guider only: PHD2 users never load the native settings sheet.
const NativeSettingsSheet = defineAsyncComponent(
  () => import('@/components/guider/native/NativeSettingsSheet.vue')
);
const GUIDE_CAMERA = DEVICE_MAP.guideCameraAction;
const nativeGuiderStore = useNativeGuiderStore();
const settingsStore = useSettingsStore();
// The wizard store flag flips at the end, so read it before: true only on the first run.
const isFirstRun = !settingsStore.setupWizard.completed;

const { t } = useI18n();
const store = apiStore();
const guiderStore = useGuiderStore();
const equipmentStore = useEquipmentStore();

const selectedGuiderDevice = ref('');
const showGuideCameraSettings = ref(false);
const selectedGuideCameraDevice = ref('');
const selectedGuideCameraObj = ref(null);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openGuideCameraSettings(payload) {
  selectedGuideCameraDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedGuideCameraObj.value = payload?.selectedDeviceObj || null;
  showGuideCameraSettings.value = true;
}

// The PINS native guider needs neither the PHD2 guide camera nor the PHD2 profile.
const isNativeGuider = computed(() => isNativeGuiderInUse(store, selectedGuiderDevice.value));
const guideCameraSlot = computed(() => usesGuideCameraSlot(store, selectedGuiderDevice.value));

// Same gating as the equipment page: PHD2 in PINS needs a connected mount and a validated
// guide camera before it can be connected at all.
const phd2Blockers = computed(() =>
  phd2ConnectBlockers({
    selectedGuider: selectedGuiderDevice.value,
    isPINS: store.isPINS,
    mountConnected: store.mountInfo.Connected,
    guidecamOk: guiderStore.guidecamOk,
  })
);
const isGuiderConnectDisabled = computed(() => phd2Blockers.value.length > 0);
const guiderDisabledMessage = computed(() => phd2Blockers.value.map((key) => t(key)).join(' '));

const nativeFocalLengthMissing = computed(() => {
  if (!isNativeGuider.value || !nativeGuiderStore.settings.length) return false;
  const focal = nativeGuiderStore.settings.find((s) => s.name === 'FocalLengthMm');
  return focal !== undefined && !(Number(focal.value) > 0);
});

// PINS ships its own guider, and with Alpaca cameras PHD2 does not even find the guide camera
// (its list only offers "manual via VNC"). On a first run without a deliberate guider choice
// the built-in one starts selected. A profile that already uses PHD2 on purpose is left alone:
// a fresh NINA profile has no guider, or the PHD2 default nobody picked yet. A fresh PINS
// profile stores "PHD2", which PINS then lists as "PHD2 (OFFLINE)" - not a device anyone chose.
const UNCHOSEN_GUIDERS = ['', 'No_Guider', 'PHD2', 'PHD2_Single'];
async function preselectNativeGuider() {
  if (!store.isPINS || !isFirstRun || store.guiderInfo?.Connected) return;
  const current = store.profileInfo?.GuiderSettings?.GuiderName ?? '';
  if (!UNCHOSEN_GUIDERS.includes(current)) return;
  try {
    const response = await apiService.guiderAction('list-devices');
    const list = Array.isArray(response?.Response) ? response.Response : [];
    if (!list.some((d) => d?.Id === NATIVE_GUIDER_ID)) return;
    await setProfileDevice('guiderAction', NATIVE_GUIDER_ID);
    await apiService.guiderAction('rescan');
  } catch (error) {
    console.warn('[PinsWizard] Preselecting the native guider failed:', error);
  }
}

onMounted(async () => {
  // The wizard can open over any route, so the profile may be stale or unread.
  // Fetch it first, then reload the device list - selectDevices only resolves
  // its preselection once defaultDeviceId is current.
  await store.fetchProfilInfos();
  await preselectNativeGuider();
  equipmentStore.triggerReload();
});
</script>
