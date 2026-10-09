<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.guider.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.guider.description') }}
      </p>
    </div>

    <!-- 1. Guide camera. The PINS native guider uses PINS' guide camera slot, with
         device and INDI driver picked like the imaging camera's. The slot has no setup
         dialog of its own, so no cog. -->
    <div v-if="guideCameraSlot" class="flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.guider.guideCamera') }}
        </span>
        <selectDevices
          apiAction="guideCameraAction"
          :deviceName="$t('components.connectEquipment.guideCamera.name')"
          :default-device-id="store.profileInfo?.GuideCameraSettings?.Id"
          :isConnected="store.guideCameraInfo?.Connected"
          hideConfig
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
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import selectDevices from '@/components/equipment/selectDevices.vue';
import selectGuiderCam from '@/components/guider/PHD2/selectGuiderCam.vue';
import Phd2FocalLength from '@/components/guider/PHD2/pins/Phd2FocalLength.vue';
import IndiDriverSelect from '../IndiDriverSelect.vue';
import { DEVICE_MAP, phd2ConnectBlockers } from '@/utils/equipmentDevices';
import {
  NATIVE_WIZARD_SETTINGS,
  isNativeGuiderInUse,
  usesGuideCameraSlot,
} from '@/utils/nativeGuider';

// Native guider only: PHD2 users never load the native settings sheet.
const NativeSettingsSheet = defineAsyncComponent(
  () => import('@/components/guider/native/NativeSettingsSheet.vue')
);
const GUIDE_CAMERA = DEVICE_MAP.guideCameraAction;

const { t } = useI18n();
const store = apiStore();
const guiderStore = useGuiderStore();
const equipmentStore = useEquipmentStore();

const selectedGuiderDevice = ref('');

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

onMounted(async () => {
  // The wizard can open over any route, so the profile may be stale or unread.
  // Fetch it first, then reload the device list - selectDevices only resolves
  // its preselection once defaultDeviceId is current.
  await store.fetchProfilInfos();
  equipmentStore.triggerReload();
});
</script>
