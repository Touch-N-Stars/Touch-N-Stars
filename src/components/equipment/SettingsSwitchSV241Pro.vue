<template>
  <div v-if="isSV241Pro" class="tns-card flex flex-col mt-2">
    <!-- The row glows with the result of the profile write. -->
    <NumberInputPicker
      v-model="preConnectDelay"
      @change="setPreConnectDelay"
      :label="$t('components.switch.sv241pro.preConnectDelay')"
      labelKey="components.switch.sv241pro.preConnectDelay"
      :min="0"
      :max="60000"
      :step="100"
      :decimalPlaces="0"
      :useDefaultSentinel="false"
      inputId="preConnectDelay"
      :wrapperClass="statusClassPre"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  selectedDevice: { type: String, default: '' },
  selectedDeviceObj: { type: Object, default: null },
});

const store = apiStore();

const isSV241Pro = computed(() => {
  const candidates = [
    props.selectedDevice,
    props.selectedDeviceObj?.DisplayName,
    props.selectedDeviceObj?.Name,
    props.selectedDeviceObj?.Id,
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
  return candidates.some((s) => s.includes('svbony') && s.includes('powerbox'));
});

const preConnectDelay = ref(0);
const statusClassPre = ref('');

function initializeSettings() {
  const settings = store.profileInfo?.SwitchSettings;
  if (!settings) return;
  preConnectDelay.value = settings.IndiPreConnectDelay ?? 0;
}

async function setPreConnectDelay() {
  try {
    await apiService.profileChangeValue(
      'SwitchSettings-IndiPreConnectDelay',
      preConnectDelay.value
    );
    statusClassPre.value = 'glow-green';
  } catch {
    statusClassPre.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassPre.value = '';
    }, 2000);
  }
}

onMounted(async () => {
  await store.fetchProfilInfos();
  initializeSettings();
});
</script>
