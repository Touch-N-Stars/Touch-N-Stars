<template>
  <label class="flex flex-col gap-1">
    <span class="text-xs font-semibold uppercase text-content-muted">{{ label }}</span>
    <select
      v-model="selectedDriver"
      class="tns-select"
      :disabled="loading || saving || connected"
      @change="applyDriver"
    >
      <option value="None">{{ t('components.setupWizard.driver.none') }}</option>
      <option v-for="driver in drivers" :key="driver.Name" :value="driver.Name">
        {{ driverLabel(driver) }}
      </option>
    </select>
    <span v-if="loading" class="text-xs text-content-faint">
      {{ t('components.setupWizard.driver.loading') }}
    </span>
    <span v-else-if="saving" class="text-xs text-content-faint">
      {{ t('components.setupWizard.driver.applying') }}
    </span>
    <span v-else-if="connected" class="text-xs text-content-faint">
      {{ t('components.deviceDriverFinder.disconnectFirst') }}
    </span>
    <span v-else-if="resultText" class="text-xs text-status-ok break-words">{{ resultText }}</span>
    <span v-if="errorMessage" class="text-xs text-status-danger break-words">{{
      errorMessage
    }}</span>
  </label>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { applyIndiDriver, isHiddenIndiDriver } from '@/utils/equipmentDevices';

/**
 * Single-device INDI driver picker. Mirrors the per-device blocks of
 * components/equipment/selectIndi.vue, but parameterized so the wizard can reuse
 * it for camera/focuser/filterwheel in later steps.
 */
const props = defineProps({
  // INDI device type for getINDIDeviceList (e.g. 'telescope', 'filterwheel')
  deviceType: { type: String, required: true },
  // Key of DEVICE_MAP, e.g. 'mountAction'
  listAction: { type: String, required: true },
  // Profile section holding the current driver, e.g. 'TelescopeSettings'
  profileSection: { type: String, required: true },
  label: { type: String, required: true },
  // Changing the driver restarts it, which would cut a live connection
  connected: { type: Boolean, default: false },
});

const emit = defineEmits(['driver-applied']);

const { t } = useI18n();
const store = apiStore();

const drivers = ref([]);
const selectedDriver = ref('None');
const loading = ref(false);
const saving = ref(false);
const errorMessage = ref('');
const resultText = ref('');

// selectIndi.vue renames this one driver because its INDI label is unhelpful.
function driverLabel(driver) {
  return driver.Name === 'indi_myfocuserpro2_focus' ? 'Gemini / MyFocuserPro2' : driver.Label;
}

async function loadDrivers() {
  loading.value = true;
  errorMessage.value = '';
  // A driver set elsewhere (brand or mount finder) makes the last result outdated
  resultText.value = '';
  try {
    const response = await apiPinsService.getINDIDeviceList(props.deviceType);
    const list = Array.isArray(response?.Response) ? response.Response : [];
    drivers.value = list
      .filter((driver) => !isHiddenIndiDriver(props.deviceType, driver.Name))
      .sort((a, b) => driverLabel(a).localeCompare(driverLabel(b)));
    selectedDriver.value = store.profileInfo?.[props.profileSection]?.IndiDriver || 'None';
  } catch (error) {
    console.error('[PinsWizard] INDI driver list failed:', error);
    errorMessage.value = t('components.setupWizard.driver.listFailed', {
      message: error.message,
    });
  } finally {
    loading.value = false;
  }
}

async function applyDriver() {
  saving.value = true;
  errorMessage.value = '';
  resultText.value = '';
  try {
    // Also selects the driver's device in the list above: before, it only showed up there and
    // a beginner had to notice and pick it.
    const { deviceId } = await applyIndiDriver(props.listAction, selectedDriver.value);
    if (deviceId && selectedDriver.value !== 'None') {
      resultText.value = t('components.deviceDriverFinder.applied', { device: deviceId });
    }
    emit('driver-applied', selectedDriver.value);
  } catch (error) {
    console.error('[PinsWizard] INDI driver change failed:', error);
    errorMessage.value = t('components.setupWizard.driver.changeFailed', {
      message: error.message,
    });
  } finally {
    saving.value = false;
  }
}

onMounted(loadDrivers);

defineExpose({ loadDrivers });
</script>
