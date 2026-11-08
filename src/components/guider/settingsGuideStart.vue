<template>
  <div class="flex flex-col w-full border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- Guiding Start Retry -->
    <ProfileToggle
      labelKey="components.guider.guidingStartRetry"
      settingKey="GuiderSettings-AutoRetryStartGuiding"
      labelClass="text-xs md:text-sm text-content"
      toggleClass="pr-5 pl-5 justify-center h-7 md:h-8"
    />

    <!-- Guiding Start Timeout -->
    <div class="flex flex-row items-center justify-between">
      <NumberInputPicker
        v-model="guidingStartTimeout"
        :label="$t('components.guider.guidingStartTimeout')"
        labelKey="components.guider.guidingStartTimeout"
        :min="0"
        :max="300"
        :step="1"
        :decimalPlaces="0"
        placeholder="60"
        inputId="guidingStartTimeout"
        wrapperClass="w-24"
        @change="setGuidingStartTimeout"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';

const store = apiStore();

const guidingStartTimeout = ref(60);

const statusClassGuidingStartTimeout = ref('');

const initializeSettings = () => {
  if (!store.profileInfo?.GuiderSettings) {
    console.warn('GuiderSettings not loaded');
    return;
  }

  guidingStartTimeout.value =
    store.profileInfo.GuiderSettings.AutoRetryStartGuidingTimeoutSeconds ?? 60;
};

async function setGuidingStartTimeout() {
  try {
    await apiService.profileChangeValue(
      'GuiderSettings-AutoRetryStartGuidingTimeoutSeconds',
      guidingStartTimeout.value
    );
    statusClassGuidingStartTimeout.value = 'glow-green';
  } catch (error) {
    console.error('Error setting guiding start timeout:', error);
    statusClassGuidingStartTimeout.value = 'glow-red';
  } finally {
    setTimeout(() => {
      statusClassGuidingStartTimeout.value = '';
    }, 2000);
  }
}

onMounted(() => {
  initializeSettings();
});
</script>
