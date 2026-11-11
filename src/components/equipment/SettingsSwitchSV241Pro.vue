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
import { computed, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
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

const {
  value: preConnectDelay,
  save: setPreConnectDelay,
  glowClass: statusClassPre,
} = useProfileSetting('SwitchSettings-IndiPreConnectDelay', { fallback: 0 });

// Opened right after a driver change: fetch the profile now instead of waiting for the poller.
onMounted(() => store.fetchProfilInfos());
</script>
