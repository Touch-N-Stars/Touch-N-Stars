<template>
  <div v-if="store.isPINS" class="flex items-center justify-between w-full">
    <div class="flex items-center gap-1">
      <span class="text-sm font-medium text-content">
        {{ $t('components.guider.phd2.restoreCalibration') }}
      </span>
      <InfoModal
        :title="$t('components.guider.phd2.restoreCalibration')"
        :message="$t('components.guider.phd2.help.restoreCalibration')"
        size="w-4 h-4"
      />
    </div>
    <toggleButton
      @click="toggleRestoreCalibration"
      :status-value="guiderStore.phd2RestoreCalibration"
      :disabled="guiderStore.phd2RestoreCalibrationLoading || reconnecting"
    />

    <!-- Reconnect confirmation modal -->
    <Modal :show="showReconnectConfirm" @close="showReconnectConfirm = false" maxWidth="max-w-md">
      <template #header>
        <h2
          class="text-lg font-bold text-content"
          data-testid="restore-calibration-reconnect-title"
        >
          {{ $t('components.guider.phd2.restoreCalibrationReconnect.title') }}
        </h2>
      </template>
      <template #body>
        <div class="flex flex-col gap-4" data-testid="restore-calibration-reconnect-modal">
          <p class="text-content">
            {{ $t('components.guider.phd2.restoreCalibrationReconnect.message') }}
          </p>
          <div class="flex gap-3 justify-end">
            <button
              @click="showReconnectConfirm = false"
              class="tns-btn-secondary"
              :disabled="reconnecting"
              data-testid="restore-calibration-reconnect-no"
            >
              {{ $t('general.no') }}
            </button>
            <button
              @click="confirmReconnect"
              class="tns-btn-primary"
              :disabled="reconnecting"
              data-testid="restore-calibration-reconnect-yes"
            >
              {{ $t('general.yes') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import Modal from '@/components/helpers/Modal.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
const guiderStore = useGuiderStore();

const showReconnectConfirm = ref(false);
const reconnecting = ref(false);

onMounted(async () => {
  await guiderStore.fetchPHD2RestoreCalibration();
});

const toggleRestoreCalibration = async () => {
  const previousValue = guiderStore.phd2RestoreCalibration;
  const newValue = !previousValue;
  try {
    guiderStore.phd2RestoreCalibration = newValue;
    await guiderStore.setPHD2RestoreCalibration(newValue);
    // Setting is saved, but only takes effect after a guider reconnect.
    showReconnectConfirm.value = true;
  } catch (error) {
    console.error('Error changing PHD2 restore calibration:', error);
    guiderStore.phd2RestoreCalibration = previousValue;
  }
};

const confirmReconnect = async () => {
  reconnecting.value = true;
  try {
    await guiderStore.reconnectGuider();
  } catch (error) {
    console.error('Error reconnecting guider:', error);
  } finally {
    reconnecting.value = false;
    showReconnectConfirm.value = false;
  }
};
</script>
