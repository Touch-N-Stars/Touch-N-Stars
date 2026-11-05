<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.filterWheel.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.filterWheel.description') }}
      </p>
    </div>

    <!-- 1. INDI driver. PINS only: the driver list comes from the plugin's
         indi/* routes, which a plain NINA backend does not serve. -->
    <IndiDriverSelect
      v-if="store.isPINS"
      ref="driverSelect"
      deviceType="filterwheel"
      settingPath="FilterWheelSettings-IndiDriver"
      listAction="filterAction"
      rescanKey="filter"
      profileSection="FilterWheelSettings"
      :label="t('components.setupWizard.filterWheel.selectDriver')"
    />

    <!-- 2. Device + connect -->
    <div class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.filterWheel.connectDevice') }}
      </span>
      <selectDevices
        apiAction="filterAction"
        :deviceName="$t('components.connectEquipment.filter.name')"
        :default-device-id="store.profileInfo?.FilterWheelSettings?.Id"
        :isConnected="store.filterInfo?.Connected"
        @device-selected="selectedFilterDevice = $event"
        @open-config="openFilterSettings"
      />
    </div>

    <div
      v-if="store.filterInfo?.Connected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{
          t('components.setupWizard.filterWheel.connected', { name: store.filterInfo?.Name || '' })
        }}
      </p>
    </div>

    <!-- 3. Slot count. Hides itself for INDI and Alpaca wheels, which report
         their slots themselves. -->
    <SettingsFilterWheelSlotNum
      v-if="store.filterInfo?.Connected"
      :selectedDevice="slotNumDevice"
      :selectedDeviceObj="slotNumDeviceObj"
    />

    <!-- 4. Filter names. PINS only: on a plain NINA backend the wheel connects
         but its filters are managed in NINA itself, not from here. -->
    <div
      v-if="store.isPINS && store.filterInfo?.Connected && filters.length"
      class="flex flex-col gap-2"
    >
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.setupWizard.filterWheel.filterNames') }}
      </span>
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.filterWheel.filterNamesHint') }}
      </p>
      <!-- SetFilterName seeds its input in onMounted only, so re-key it when the
           profile delivers a different name for a slot. -->
      <SetFilterName
        v-for="(filter, index) in filters"
        :key="`${index}-${filter.Name}`"
        :modelValue="filter.Name || ''"
        :settingKey="`FilterWheelSettings-FilterWheelFilters-${index}-Name`"
      />
    </div>

    <!-- 5. Filter wheel not found -> 3rd party driver. PINS only: the packages
         come from the daemon on port 8000. -->
    <button v-if="store.isPINS" class="tns-btn-secondary" @click="toggleNotFound">
      <ChevronDownIcon
        class="w-5 h-5 transition-transform"
        :class="{ 'rotate-180': showNotFound }"
      />
      {{ t('components.setupWizard.filterWheel.notFound') }}
    </button>

    <div v-if="store.isPINS && showNotFound" class="flex flex-col gap-3">
      <p class="text-sm text-content-muted">
        {{ t('components.setupWizard.filterWheel.notFoundHint') }}
      </p>

      <Indi3rdpartyInstallPanel
        search-seed="filter"
        label-prefix="components.setupWizard.filterWheel"
        @installed="driverSelect?.loadDrivers()"
      />
    </div>

    <!-- Filter wheel settings modal (same split as connectEquipment.vue).
         zIndex must clear the wizard overlay (z-overlay) but stay under the PINS
         upgrade overlay (z-dialog) - all of these teleport to body. -->
    <Modal :show="showFilterSettings" zIndex="z-overlay-modal" @close="showFilterSettings = false">
      <template #header>
        <h2 class="text-2xl font-semibold">{{ $t('components.filterwheel.indi.settings') }}</h2>
      </template>
      <template #body>
        <SettingsAlpacaDirect
          v-if="isAlpacaDirect(selectedFilterObj)"
          deviceType="filterwheel"
          :selectedDevice="selectedFilterDevice"
          :deviceId="selectedFilterObj?.Id"
        />
        <SettingsSerialConnection
          v-else
          equipmentType="filterwheel"
          :selectedDevice="selectedFilterDevice"
        />
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useEquipmentStore } from '@/store/equipmentStore';
import Modal from '@/components/helpers/Modal.vue';
import selectDevices from '@/components/equipment/selectDevices.vue';
import SettingsAlpacaDirect from '@/components/equipment/SettingsAlpacaDirect.vue';
import SettingsSerialConnection from '@/components/equipment/SettingsSerialConnection.vue';
import SettingsFilterWheelSlotNum from '@/components/equipment/SettingsFilterWheelSlotNum.vue';
import SetFilterName from '@/components/filterwheel/settings/SetFilterName.vue';
import IndiDriverSelect from '../IndiDriverSelect.vue';
import Indi3rdpartyInstallPanel from '../Indi3rdpartyInstallPanel.vue';

const { t } = useI18n();
const store = apiStore();
const equipmentStore = useEquipmentStore();

const driverSelect = ref(null);
const showFilterSettings = ref(false);
const selectedFilterDevice = ref('');
const selectedFilterObj = ref(null);

const showNotFound = ref(false);

const filters = computed(() => store.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? []);

// SettingsFilterWheelSlotNum normally lives inside the config modal, where the
// device object comes from selectDevices' open-config payload. Standing on its
// own here it has to fall back to the connected wheel, otherwise its INDI/Alpaca
// check runs on an empty device and shows the selector where it should not.
const slotNumDevice = computed(() => selectedFilterDevice.value || store.filterInfo?.Name || '');
const slotNumDeviceObj = computed(
  () => selectedFilterObj.value || { Category: store.filterInfo?.Category }
);

const isAlpacaDirect = (device) => device?.Category === 'ASCOM Alpaca';

function openFilterSettings(payload) {
  selectedFilterDevice.value = payload?.selectedDeviceDisplayName || '';
  selectedFilterObj.value = payload?.selectedDeviceObj || null;
  showFilterSettings.value = true;
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
