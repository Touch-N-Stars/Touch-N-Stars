<template>
  <div
    :class="borderClass"
    class="flex flex-col sm:flex-row border p-2 rounded-control h-full gap-2 sm:items-center transition-all duration-300"
  >
    <label class="text-sm text-content sm:w-36 shrink-0" for="guiderCamSelect"
      >{{ deviceName }}:</label
    >
    <div class="flex gap-2 items-center w-full">
      <select
        id="guiderCamSelect"
        class="w-full tns-select min-w-0"
        v-model="selectedCam"
        @change="setGuiderCam"
        :disabled="store.guiderInfo.Connected"
      >
        <option value="" disabled>{{ selectedCam || $t('common.select') }}</option>
        <option :value="MANUAL_VNC">
          {{ $t('components.connectEquipment.guiderCam.manualVnc') }}
        </option>
        <option
          v-for="cam in cameras"
          :key="cam.driver + ':' + cam.id"
          :value="cam.driver + ':' + cam.id"
        >
          {{ cam.driver }} - {{ cam.name }}
        </option>
      </select>
      <div class="flex shrink-0 gap-1">
        <button
          @click="loadCameras(true)"
          :disabled="isLoading || store.cameraInfo?.Connected"
          class="tns-btn-secondary flex justify-center items-center w-10 h-10 p-0"
        >
          <ArrowPathIcon
            class="w-6 h-6"
            :class="{ 'text-status-ok spin': isLoading, 'text-content': !isLoading }"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import apiService from '@/services/apiService';
import apiPinsService from '@/services/apiPinsService';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';

defineProps({
  deviceName: { type: String, default: 'Guide Camera' },
});

const store = apiStore();
const guiderStore = useGuiderStore();

const MANUAL_VNC = '__manual_vnc__';

const cameras = ref([]);
const selectedCam = ref('');
const isLoading = ref(false);
const borderClass = ref('border-line-strong');

// auto: the initial load on mount. It only probes PHD2 quietly - a stopped PHD2 service is
// normal at startup and must not raise toasts; errors are reported on user actions only.
async function loadCameras(withRescan = false, { auto = false } = {}) {
  if (store.profileInfo.GuiderSettings.GuiderName !== 'PHD2_Single') {
    withRescan = false;
  }
  isLoading.value = true;
  try {
    const connectResponse = await apiService.connectPHD2({ quiet: auto });
    if (auto && connectResponse?.Success !== true) {
      borderClass.value = 'border-line-strong';
      return;
    }
    if (withRescan && !store.cameraInfo?.Connected) {
      await apiService.cameraAction('rescan');
    }
    const response = await apiPinsService.getGuideCam();
    if (response.Success && response.Response) {
      cameras.value = Object.entries(response.Response).flatMap(([driver, cams]) =>
        cams.map((cam) => ({
          driver,
          id: cam.Id,
          name: cam.Name,
        }))
      );
      if (cameras.value.length === 0 && store.guiderInfo.Connected) {
        selectedCam.value = MANUAL_VNC;
        guiderStore.guidecamManualVnc = true;
      }
      validateSelection();
    }
  } catch (error) {
    console.error('Error loading guide cameras:', error);
    borderClass.value = 'border-status-danger error-glow';
  } finally {
    isLoading.value = false;
  }
}

function validateSelection() {
  if (selectedCam.value === MANUAL_VNC) {
    guiderStore.guidecamOk = true;
    borderClass.value = store.guiderInfo.Connected
      ? 'border-status-ok connected-glow'
      : 'border-line-strong';
    return;
  }
  if (
    !selectedCam.value ||
    !cameras.value.some((c) => c.driver + ':' + c.id === selectedCam.value)
  ) {
    borderClass.value = 'border-status-danger error-glow';
    guiderStore.guidecamOk = false;
  } else {
    guiderStore.guidecamOk = true;
    borderClass.value = store.guiderInfo.Connected
      ? 'border-status-ok connected-glow'
      : 'border-line-strong';
  }
}

async function setGuiderCam() {
  if (selectedCam.value === MANUAL_VNC) {
    guiderStore.guidecamManualVnc = true;
    guiderStore.guidecamOk = true;
    try {
      // NINA's PHD2Guider.Connect() refuses to connect when GuiderSettings-PHD2Camera
      // is empty/"None", even though PHD2 manages its own camera in manual VNC mode.
      await apiService.profileChangeValue('GuiderSettings-PHD2Camera', 'Manual');
    } catch (error) {
      console.error('Error setting guide camera to manual VNC:', error);
    }
    borderClass.value = 'border-status-ok connected-glow';
    return;
  }
  guiderStore.guidecamManualVnc = false;
  const cam = cameras.value.find((c) => c.driver + ':' + c.id === selectedCam.value);
  if (!cam) return;

  try {
    await apiService.profileChangeValue('GuiderSettings-PHD2Camera', cam.driver);
    await apiService.profileChangeValue('GuiderSettings-PHD2CameraId', cam.id);
    borderClass.value = 'border-status-ok connected-glow';
    setTimeout(() => validateSelection(), 2000);
  } catch (error) {
    console.error('Error setting guide camera:', error);
    borderClass.value = 'border-status-danger error-glow';
  }
}

watch(
  () => store.guiderInfo.Connected,
  () => validateSelection()
);

watch(
  () => [
    store.profileInfo?.GuiderSettings?.GuiderName,
    store.profileInfo?.GuiderSettings?.PHD2Camera,
    store.profileInfo?.GuiderSettings?.PHD2CameraId,
  ],
  async ([guiderName, phd2Camera, phd2CameraId], oldValues) => {
    if (!store.isPINS) return;
    if (guiderName !== 'PHD2_Single') return;
    if (guiderStore.guidecamManualVnc) {
      selectedCam.value = MANUAL_VNC;
    } else if (phd2Camera && phd2CameraId) {
      selectedCam.value = phd2Camera + ':' + phd2CameraId;
    }
    const isFirstRun = !oldValues;
    if (isFirstRun) {
      await loadCameras(false, { auto: true });
    } else {
      validateSelection();
    }
  },
  { immediate: true }
);
</script>

<style scoped>
@keyframes error-glow {
  0% {
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(255, 0, 0, 0.8);
  }
  100% {
    box-shadow: 0 0 10px rgba(255, 0, 0, 0.5);
  }
}

.error-glow {
  animation: error-glow 1.5s infinite alternate;
}

.connected-glow {
  box-shadow: 0 0 6px rgba(34, 197, 94, 0.6);
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
