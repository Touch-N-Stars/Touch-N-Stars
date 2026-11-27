<template>
  <!-- The serial port of PINS' native OnStepX driver, shown right under the device instead of
       behind the gear: without it the connect fails with a backend message. Each device is
       listed once, and a single plugged-in device is taken without asking. The baud rate
       stays in the gear dialog (SettingsOnStepXConnection.vue). -->
  <div class="tns-card flex flex-col gap-2">
    <label for="wizardOnstepxPort" class="tns-label">
      {{ t('components.setupWizard.mount.port.label') }}
    </label>

    <p v-if="loading" class="flex items-center gap-2 text-sm text-content-muted">
      <Spinner size="sm" />{{ t('components.setupWizard.mount.port.searching') }}
    </p>
    <p v-else-if="options.length === 0" class="text-sm text-status-warn">
      {{ t('components.setupWizard.mount.port.none') }}
    </p>
    <template v-else>
      <select
        id="wizardOnstepxPort"
        v-model="port"
        @change="savePort"
        class="tns-select"
        :class="glowClass"
      >
        <option value="" disabled>{{ t('components.setupWizard.mount.port.choose') }}</option>
        <option v-for="entry in options" :key="entry.Port" :value="entry.Port">
          {{ serialPortLabel(entry) }}
        </option>
      </select>
      <p v-if="autoPicked" class="text-sm text-status-ok">
        {{ t('components.setupWizard.mount.port.autoPicked', { port: autoPicked }) }}
      </p>
      <p v-else-if="ports.length > 1" class="text-sm text-content-muted">
        {{ t('components.setupWizard.mount.port.several') }}
      </p>
    </template>

    <button class="tns-btn-secondary" :disabled="loading" @click="refresh">
      <ArrowPathIcon class="w-5 h-5" />
      {{ t('components.setupWizard.mount.port.searchAgain') }}
    </button>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import apiService from '@/services/apiService';
import Spinner from '@/components/helpers/Spinner.vue';
import { useProfileSetting } from '@/composables/useProfileSetting';
import { autoSerialPort, physicalSerialPorts, serialPortLabel } from '@/utils/serialPorts';

const { t } = useI18n();

const {
  value: port,
  save: savePort,
  glowClass,
} = useProfileSetting('TelescopeSettings-SerialPort', { fallback: '' });

const ports = ref([]);
const loading = ref(false);
// The port taken without asking, so the step can say so; '' otherwise.
const autoPicked = ref('');

// A saved port that is not among the detected devices (a udev symlink, a by-id path set in
// the gear dialog, or a device unplugged right now) stays selectable instead of vanishing.
const options = computed(() =>
  port.value && !ports.value.some((entry) => entry.Port === port.value)
    ? [...ports.value, { Port: port.value, Description: '' }]
    : ports.value
);

async function refresh() {
  loading.value = true;
  try {
    ports.value = physicalSerialPorts(await apiService.availableSerialPorts());
  } finally {
    loading.value = false;
  }
  const auto = autoSerialPort(ports.value, port.value);
  if (auto && (await savePort(auto))) autoPicked.value = auto;
}

onMounted(refresh);
</script>
