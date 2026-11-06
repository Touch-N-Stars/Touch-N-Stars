<template>
  <div class="space-y-6">
    <!-- Language Selection -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.language') }}
      </h3>
      <select
        v-model="currentLanguage"
        @change="changeLanguage($event.target.value)"
        class="tns-select"
      >
        <option v-for="lang in languages" :key="lang.code" :value="lang.code">
          {{ lang.name }}
        </option>
      </select>
    </div>

    <!-- Keep Screen Awake (mobile only) -->
    <div
      class="tns-card flex flex-col gap-2 sm:gap-3"
      v-if="['android', 'ios'].includes(Capacitor.getPlatform()) && keepAwakeSupported"
    >
      <h3 class="tns-section-title">
        {{ $t('components.settings.keepAwake.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-content text-sm mr-4">
          {{ $t('components.settings.keepAwake.description') }}
        </p>
        <ToggleButton
          :statusValue="settingsStore.keepAwakeEnabled"
          @update:statusValue="onToggleKeepAwake"
        />
      </div>
    </div>

    <!-- Local Wi-Fi Binding (Android only) -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3" v-if="Capacitor.getPlatform() === 'android'">
      <h3 class="tns-section-title">
        {{ $t('components.settings.wifiBinding.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-content text-sm mr-4">
          {{ $t('components.settings.wifiBinding.description') }}
        </p>
        <ToggleButton
          :statusValue="settingsStore.wifiBindingEnabled"
          @update:statusValue="settingsStore.setWifiBindingEnabled($event)"
        />
      </div>
    </div>

    <!-- Touch Input Optimization -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.input.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-content text-sm mr-4">
          {{ $t('components.settings.input.touchOptimized') }}
        </p>
        <ToggleButton
          :statusValue="settingsStore.touchOptimized"
          @update:statusValue="settingsStore.touchOptimized = $event"
        />
      </div>
    </div>

    <!-- Haptic Feedback (mobile only) -->
    <div
      class="tns-card flex flex-col gap-2 sm:gap-3"
      v-if="['android', 'ios'].includes(Capacitor.getPlatform())"
    >
      <h3 class="tns-section-title">
        {{ $t('components.settings.haptics.title') }}
      </h3>
      <div class="flex items-center justify-between">
        <p class="text-content text-sm mr-4">
          {{ $t('components.settings.haptics.description') }}
        </p>
        <ToggleButton
          :statusValue="settingsStore.hapticsEnabled"
          @update:statusValue="settingsStore.hapticsEnabled = $event"
        />
      </div>
    </div>

    <NavbarCustomizationSettings />

    <StatusBarCustomizationSettings />
  </div>
</template>

<script setup>
import { ref, onMounted, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { getAvailableLanguages, getBackendLanguageCode, setLocaleLanguage } from '@/i18n';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import NavbarCustomizationSettings from '@/components/settings/general/NavbarCustomizationSettings.vue';
import StatusBarCustomizationSettings from '@/components/settings/general/StatusBarCustomizationSettings.vue';

const { locale } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();

const currentLanguage = ref(settingsStore.getLanguage());
const languages = getAvailableLanguages();
const keepAwakeSupported = ref(false);

// Keep Awake support check
const checkKeepAwakeSupport = async () => {
  try {
    const res = await KeepAwake.isSupported();
    keepAwakeSupported.value = !!res?.isSupported;
  } catch (error) {
    console.error('Error checking keep-awake support:', error);
    keepAwakeSupported.value = false;
  }
};

onMounted(() => {
  checkKeepAwakeSupport();
});

watchEffect(() => {
  currentLanguage.value = locale.value;
});

// Watch language changes
const changeLanguage = async (newLanguage) => {
  const activeLanguage = await setLocaleLanguage(newLanguage);

  if (store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.8.0')) {
    const backendCode = getBackendLanguageCode(activeLanguage);
    if (backendCode && store.isBackendReachable) {
      await apiService.setLanguage(backendCode);
    }
  }
};

const onToggleKeepAwake = async (value) => {
  settingsStore.setKeepAwakeEnabled(value);
  if (keepAwakeSupported.value && ['android', 'ios'].includes(Capacitor.getPlatform())) {
    try {
      if (value) {
        await KeepAwake.enable();
      } else {
        await KeepAwake.disable();
      }
    } catch (error) {
      console.error('Error toggling keep awake:', error);
    }
  }
};
</script>
