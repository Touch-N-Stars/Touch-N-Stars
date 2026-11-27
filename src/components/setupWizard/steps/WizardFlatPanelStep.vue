<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.flatPanel.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.flatPanel.description') }}
      </p>
    </div>

    <!-- 1. Device + connect, as in the focuser step: Alpaca and natively supported panels show
         up without an INDI driver, the driver is behind "not listed?". -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.flatPanel.connectDevice') }}
      </span>
      <selectDevices
        labeledConnect
        apiAction="flatdeviceAction"
        :deviceName="$t('components.connectEquipment.flat.name')"
        :default-device-id="store.profileInfo?.FlatDeviceSettings?.Id"
        :isConnected="store.flatdeviceInfo?.Connected"
        @open-config="openFlatPanelSettings"
      />
    </div>

    <div
      v-if="store.flatdeviceInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{
          t('components.setupWizard.flatPanel.connected', {
            name: store.flatdeviceInfo?.Name || '',
          })
        }}
      </p>
    </div>
    <!-- Most beginners have no panel: the night's flats step works with a tablet or a light
         sheet too, so skipping must read as fine, not as a gap. -->
    <p v-else class="text-sm text-content-muted">
      {{ t('components.setupWizard.flatPanel.noPanelHint') }}
    </p>

    <!-- 2. Panel not listed -> INDI driver or a 3rd party driver. PINS only: the packages come
         from the daemon on port 8000. There is no brand finder for flat panels. -->
    <button v-if="store.isPINS" class="tns-btn-secondary" @click="showNotFound = !showNotFound">
      <ChevronDownIcon
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': showNotFound }"
      />
      {{ t('components.setupWizard.flatPanel.notFound') }}
    </button>

    <div v-if="store.isPINS && showNotFound" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.flatPanel.notFoundDriverHint') }}
      </p>

      <IndiDriverSelect
        ref="driverSelect"
        deviceType="flatpanel"
        listAction="flatdeviceAction"
        profileSection="FlatDeviceSettings"
        :label="t('components.setupWizard.flatPanel.selectDriver')"
        :connected="Boolean(store.flatdeviceInfo?.Connected)"
      />

      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.flatPanel.notFoundHint') }}
      </p>

      <Indi3rdpartyInstallPanel
        search-seed="flat"
        label-prefix="components.setupWizard.flatPanel"
        @installed="driverSelect?.loadDrivers()"
      />
    </div>

    <!-- Flat panel settings modal (same split as connectEquipment.vue).
         zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <Modal
      :show="showFlatPanelSettings"
      zIndex="z-overlay-modal"
      @close="showFlatPanelSettings = false"
    >
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.flat.indi.settings') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedFlatPanelObj)"
          deviceType="flatdevice"
          :selectedDevice="selectedFlatPanelDevice"
          :deviceId="selectedFlatPanelObj?.Id"
        />
        <SettingsSerialConnection
          v-else
          equipmentType="flatdevice"
          :selectedDevice="selectedFlatPanelDevice"
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
const showFlatPanelSettings = ref(false);
const selectedFlatPanelDevice = ref('');
const selectedFlatPanelObj = ref(null);

// Open from the start when the profile already uses an INDI driver, so it stays visible.
const showNotFound = ref(
  !['', 'None', undefined, null].includes(store.profileInfo?.FlatDeviceSettings?.IndiDriver)
);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openFlatPanelSettings(payload) {
  selectedFlatPanelDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFlatPanelObj.value = payload?.selectedDeviceObj || null;
  showFlatPanelSettings.value = true;
}

onMounted(async () => {
  // The wizard can open over any route, so the profile may be stale or unread.
  // Fetch it first, then reload the device list - selectDevices only resolves
  // its preselection once defaultDeviceId is current.
  await store.fetchProfilInfos();
  equipmentStore.triggerReload();
});
</script>
