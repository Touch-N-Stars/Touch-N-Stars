<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.mount.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.mount.description') }}
      </p>
    </div>

    <!-- 1. INDI driver. PINS only: the driver list comes from the plugin's
         indi/* routes, which a plain NINA backend does not serve. -->
    <IndiDriverSelect
      v-if="store.isPINS"
      ref="driverSelect"
      deviceType="telescope"
      settingPath="TelescopeSettings-IndiDriver"
      listAction="mountAction"
      rescanKey="mount"
      profileSection="TelescopeSettings"
      :label="t('components.setupWizard.mount.selectDriver')"
    />

    <!-- 2. Device + connect -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.mount.connectDevice') }}
      </span>
      <selectDevices
        apiAction="mountAction"
        :deviceName="$t('components.connectEquipment.mount.name')"
        :default-device-id="store.profileInfo?.TelescopeSettings?.Id"
        :isConnected="store.mountInfo?.Connected"
        :configDeviceIds="['OnStepX']"
        @open-config="openMountSettings"
      />
    </div>

    <div
      v-if="store.mountInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{ t('components.setupWizard.mount.connected', { name: store.mountInfo?.Name || '' }) }}
      </p>
    </div>

    <!-- 3. Mount not found -> 3rd party driver. Collapsed by default so the step
         stays focused, but everything inside opens at once. PINS only: the
         packages come from the daemon on port 8000. -->
    <button v-if="store.isPINS" class="tns-btn-secondary" @click="toggleNotFound">
      <ChevronDownIcon
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': showNotFound }"
      />
      {{ t('components.setupWizard.mount.notFound') }}
    </button>

    <div v-if="store.isPINS && showNotFound" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.mount.notFoundHint') }}
      </p>

      <Indi3rdpartyInstallPanel
        search-seed="mount"
        label-prefix="components.setupWizard.mount"
        @installed="driverSelect?.loadDrivers()"
      />
    </div>

    <!-- Mount settings modal (same split as connectEquipment.vue).
         zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <Modal :show="showMountSettings" zIndex="z-overlay-modal" @close="showMountSettings = false">
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.mount.indi.settings') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedMountObj)"
          deviceType="telescope"
          :selectedDevice="selectedMountDevice"
          :deviceId="selectedMountObj?.Id"
        />
        <SettingsOnStepXConnection v-else-if="selectedMountObj?.Id === 'OnStepX'" />
        <SettingsSerialConnection
          v-else
          equipmentType="mount"
          :selectedDevice="selectedMountDevice"
        />
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
import SettingsSerialConnection from '@/components/equipment/SettingsSerialConnection.vue';
import SettingsOnStepXConnection from '@/components/equipment/SettingsOnStepXConnection.vue';
import IndiDriverSelect from '../IndiDriverSelect.vue';
import Indi3rdpartyInstallPanel from '../Indi3rdpartyInstallPanel.vue';

const { t } = useI18n();
const store = apiStore();
const equipmentStore = useEquipmentStore();

const driverSelect = ref(null);
const showMountSettings = ref(false);
const selectedMountDevice = ref('');
const selectedMountObj = ref(null);

const showNotFound = ref(false);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openMountSettings(payload) {
  selectedMountDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedMountObj.value = payload?.selectedDeviceObj || null;
  showMountSettings.value = true;
}

onMounted(async () => {
  // The wizard can open over any route, so the profile may be stale or unread.
  // Fetch it first, then reload the device list - selectDevices only resolves
  // its preselection once defaultDeviceId is current.
  await store.fetchProfilInfos();
  equipmentStore.triggerReload();
});

function toggleNotFound() {
  showNotFound.value = !showNotFound.value;
}
</script>
