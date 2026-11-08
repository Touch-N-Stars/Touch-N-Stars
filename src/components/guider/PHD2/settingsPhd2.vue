<template>
  <div v-if="isPHD2Selected" class="flex flex-col border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- PHD2 Path -->
    <div class="flex flex-row items-center justify-between w-full">
      <label for="phd2Path" class="text-xs md:text-sm text-content">
        {{ $t('components.guider.phd2Path') }}
      </label>
      <input
        id="phd2Path"
        v-model="phd2Path"
        @change="setPhd2Path"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="statusClassPhd2Path"
        placeholder="/path/to/phd2"
      />
    </div>

    <!-- PHD2 Server Hostname -->
    <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
      <label for="phd2ServerHost" class="text-xs md:text-sm text-content mr-2">
        {{ $t('components.guider.phd2ServerHost') }}
      </label>
      <input
        id="phd2ServerHost"
        v-model="phd2ServerHost"
        @change="setPhd2ServerHost"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="statusClassPhd2ServerHost"
        placeholder="localhost"
      />
    </div>

    <!-- PHD2 Server Port -->
    <div class="mt-2 md:mt-3">
      <NumberInputPicker
        v-model="phd2ServerPort"
        :label="$t('components.guider.phd2ServerPort')"
        labelKey="components.guider.phd2ServerPort"
        :min="1"
        :max="65535"
        :step="1"
        :decimalPlaces="0"
        placeholder="4400"
        inputId="phd2ServerPort"
        wrapperClass="w-full"
        @change="setPhd2ServerPort"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  selectedGuiderDevice: { type: String, default: '' },
});

const store = apiStore();

const isPHD2Selected = computed(() => {
  return props.selectedGuiderDevice === 'PHD2' || props.selectedGuiderDevice === 'PHD2_Single';
});

const phd2Path = ref('');
const phd2ServerHost = ref('localhost');
const phd2ServerPort = ref(4400);

const statusClassPhd2Path = ref('');
const statusClassPhd2ServerHost = ref('');
const statusClassPhd2ServerPort = ref('');

const initializeSettings = () => {
  if (!store.profileInfo?.GuiderSettings) {
    console.warn('GuiderSettings not loaded');
    return;
  }

  phd2Path.value = store.profileInfo.GuiderSettings.PHD2Path ?? '';
  phd2ServerHost.value = store.profileInfo.GuiderSettings.PHD2ServerUrl ?? 'localhost';
  phd2ServerPort.value = store.profileInfo.GuiderSettings.PHD2ServerPort ?? 4400;
};

async function setPhd2Path() {
  try {
    const data = await apiService.profileChangeValue('GuiderSettings-PHD2Path', phd2Path.value);
    console.log(data);
    statusClassPhd2Path.value = 'glow-green';
  } catch (error) {
    console.error('Error setting PHD2 path:', error);
    statusClassPhd2Path.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassPhd2Path.value = '';
    }, 2000);
  }
}

async function setPhd2ServerHost() {
  try {
    const data = await apiService.profileChangeValue(
      'GuiderSettings-PHD2ServerUrl',
      phd2ServerHost.value
    );
    console.log(data);
    statusClassPhd2ServerHost.value = 'glow-green';
  } catch (error) {
    console.error('Error setting PHD2 server host:', error);
    statusClassPhd2ServerHost.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassPhd2ServerHost.value = '';
    }, 2000);
  }
}

async function setPhd2ServerPort() {
  try {
    const data = await apiService.profileChangeValue(
      'GuiderSettings-PHD2ServerPort',
      phd2ServerPort.value
    );
    console.log(data);
    statusClassPhd2ServerPort.value = 'glow-green';
  } catch (error) {
    console.error('Error setting PHD2 server port:', error);
    statusClassPhd2ServerPort.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassPhd2ServerPort.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
