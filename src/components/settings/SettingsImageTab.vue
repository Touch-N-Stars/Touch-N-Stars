<template>
  <div class="space-y-6">
    <!-- Image settings -->
    <div
      v-if="store.isBackendReachable && !settingsStore.isEasyMode"
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.image.title') }}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <setImgQuality />
        <setImgMaxDimension />
        <setImgStrechFactor />
        <setImgBlackClipping />
      </div>
      <div class="flex flex-col mt-4 gap-2">
        <ProfileToggle
          v-for="toggle in imageToggles"
          :key="toggle.settingKey"
          class="w-full"
          :labelKey="toggle.labelKey"
          :settingKey="toggle.settingKey"
          labelClass="text-gray-200"
          toggleClass="pr-5 pl-5 justify-center"
        />
      </div>
    </div>

    <!-- Image File Path -->
    <div
      v-if="
        store.isBackendReachable &&
        (store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.7.0'))
      "
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.imageSavePath.title') }}
      </h3>

      <setImgFilePath />
    </div>

    <!-- File Name Pattern -->
    <div
      v-if="store.isBackendReachable"
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">
        {{ $t('components.settings.imageFile.title') }}
      </h3>
      <FilePatternBuilder v-if="!settingsStore.isEasyMode" />
      <setImgFileType class="mt-2" />
    </div>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import setImgStrechFactor from '@/components/settings/image/SetImgStrechFactor.vue';
import setImgQuality from '@/components/settings/image/SetImgQuality.vue';
import setImgBlackClipping from '@/components/settings/image/SetImgBlackClipping.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
import setImgMaxDimension from '@/components/settings/image/SetImgMaxDimension.vue';
import setImgFileType from '@/components/settings/image/SetImgFileType.vue';
import setImgFilePath from '@/components/settings/image/SetImgFilePath.vue';
import FilePatternBuilder from '@/components/settings/image/FilePatternBuilder.vue';

const store = apiStore();
const settingsStore = useSettingsStore();

const imageToggles = [
  {
    settingKey: 'ImageSettings-DebayerImage',
    labelKey: 'components.settings.image.debayern',
  },
  {
    settingKey: 'ImageSettings-DebayeredHFR',
    labelKey: 'components.settings.image.DebayeredHFR',
  },
  {
    settingKey: 'ImageSettings-UnlinkedStretch',
    labelKey: 'components.settings.image.UnlinkedStretch',
  },
];
</script>
