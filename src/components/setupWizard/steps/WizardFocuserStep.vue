<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.focuser.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.focuser.description') }}
      </p>
    </div>

    <!-- 1. INDI driver. PINS only: the driver list comes from the plugin's
         indi/* routes, which a plain NINA backend does not serve. -->
    <IndiDriverSelect
      v-if="store.isPINS"
      ref="driverSelect"
      deviceType="focuser"
      settingPath="FocuserSettings-IndiDriver"
      listAction="focusAction"
      rescanKey="focus"
      profileSection="FocuserSettings"
      :label="t('components.setupWizard.focuser.selectDriver')"
    />

    <!-- 2. Device + connect -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.focuser.connectDevice') }}
      </span>
      <selectDevices
        apiAction="focusAction"
        :deviceName="$t('components.connectEquipment.focuser.name')"
        :default-device-id="store.profileInfo?.FocuserSettings?.Id"
        :isConnected="store.focuserInfo?.Connected"
        @open-config="openFocuserSettings"
      />
    </div>

    <div
      v-if="store.focuserInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{ t('components.setupWizard.focuser.connected', { name: store.focuserInfo?.Name || '' }) }}
      </p>
    </div>

    <!-- 3. Focuser not found -> 3rd party driver. PINS only: the packages come
         from the daemon on port 8000. -->
    <button v-if="store.isPINS" class="tns-btn-secondary" @click="toggleNotFound">
      <ChevronDownIcon
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': showNotFound }"
      />
      {{ t('components.setupWizard.focuser.notFound') }}
    </button>

    <div v-if="store.isPINS && showNotFound" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.focuser.notFoundHint') }}
      </p>

      <Indi3rdpartyInstallPanel
        search-seed="focus"
        label-prefix="components.setupWizard.focuser"
        @installed="driverSelect?.loadDrivers()"
      />
    </div>

    <!-- Focuser settings modal (same split as connectEquipment.vue).
         zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <Modal
      :show="showFocuserSettings"
      zIndex="z-overlay-modal"
      @close="showFocuserSettings = false"
    >
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.focuser.indi.settings') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedFocuserObj)"
          deviceType="focuser"
          :selectedDevice="selectedFocuserDevice"
          :deviceId="selectedFocuserObj?.Id"
        />
        <SettingsSerialConnection
          v-else
          equipmentType="focuser"
          :selectedDevice="selectedFocuserDevice"
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
import IndiDriverSelect from '../IndiDriverSelect.vue';
import Indi3rdpartyInstallPanel from '../Indi3rdpartyInstallPanel.vue';

const { t } = useI18n();
const store = apiStore();
const equipmentStore = useEquipmentStore();

const driverSelect = ref(null);
const showFocuserSettings = ref(false);
const selectedFocuserDevice = ref('');
const selectedFocuserObj = ref(null);

const showNotFound = ref(false);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openFocuserSettings(payload) {
  selectedFocuserDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFocuserObj.value = payload?.selectedDeviceObj || null;
  showFocuserSettings.value = true;
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
