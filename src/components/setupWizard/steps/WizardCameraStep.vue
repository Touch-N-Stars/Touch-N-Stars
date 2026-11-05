<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.camera.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.camera.description') }}
      </p>
    </div>

    <!-- 1. Device + connect. Natively supported cameras show up here without any
         INDI driver, so this comes first - the reverse of the mount step. -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.camera.connectDevice') }}
      </span>
      <selectDevices
        apiAction="cameraAction"
        :deviceName="$t('components.connectEquipment.camera.name')"
        :default-device-id="store.profileInfo?.CameraSettings?.Id"
        :isConnected="store.cameraInfo?.Connected"
        @open-config="openCameraSettings"
      />
    </div>

    <div
      v-if="store.cameraInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{ t('components.setupWizard.camera.connected', { name: store.cameraInfo?.Name || '' }) }}
      </p>
    </div>

    <!-- 2. Only if the camera is not natively detected: pick an INDI driver.
         PINS only - both the driver list (plugin indi/* routes) and the package
         install (daemon on port 8000) are unavailable on a plain NINA backend. -->
    <button v-if="store.isPINS" class="tns-btn-secondary" @click="toggleNotFound">
      <ChevronDownIcon
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': showNotFound }"
      />
      {{ t('components.setupWizard.camera.notFound') }}
    </button>

    <div v-if="store.isPINS && showNotFound" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.camera.notFoundHint') }}
      </p>

      <IndiDriverSelect
        ref="driverSelect"
        deviceType="camera"
        settingPath="CameraSettings-IndiDriver"
        listAction="cameraAction"
        rescanKey="camera"
        profileSection="CameraSettings"
        :label="t('components.setupWizard.camera.selectDriver')"
      />

      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.camera.thirdPartyHint') }}
      </p>

      <Indi3rdpartyInstallPanel
        search-seed="camera"
        label-prefix="components.setupWizard.camera"
        @installed="driverSelect?.loadDrivers()"
      />
    </div>

    <!-- 3. Sensor geometry -->
    <CameraSensorSettings />

    <!-- Camera settings modal: unlike the mount there is no serial/INDI form here.
         zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <Modal :show="showCameraSettings" zIndex="z-overlay-modal" @close="showCameraSettings = false">
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.alpacaDirect.title') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedCameraObj)"
          deviceType="camera"
          :selectedDevice="selectedCameraDevice"
          :deviceId="selectedCameraObj?.Id"
        />
        <p v-else class="text-sm text-gray-300">
          {{ $t('components.alpacaDirect.cameraNoSettings') }}
        </p>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useEquipmentStore } from '@/store/equipmentStore';
import Modal from '@/components/helpers/Modal.vue';
import selectDevices from '@/components/equipment/selectDevices.vue';
import SettingsAlpacaDirect from '@/components/equipment/SettingsAlpacaDirect.vue';
import IndiDriverSelect from '../IndiDriverSelect.vue';
import Indi3rdpartyInstallPanel from '../Indi3rdpartyInstallPanel.vue';
import CameraSensorSettings from '../CameraSensorSettings.vue';

const { t } = useI18n();
const store = apiStore();
const equipmentStore = useEquipmentStore();

const driverSelect = ref(null);
const showNotFound = ref(false);
const showCameraSettings = ref(false);
const selectedCameraDevice = ref('');
const selectedCameraObj = ref(null);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openCameraSettings(payload) {
  selectedCameraDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedCameraObj.value = payload?.selectedDeviceObj || null;
  showCameraSettings.value = true;
}

function toggleNotFound() {
  showNotFound.value = !showNotFound.value;
}

onMounted(async () => {
  // The wizard can open over any route, so the profile may be stale or unread.
  // Fetch it first, then reload the device list - selectDevices only resolves
  // its preselection once defaultDeviceId is current.
  await store.fetchProfilInfos();
  equipmentStore.triggerReload();
});
</script>
