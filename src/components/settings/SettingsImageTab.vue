<template>
  <div class="space-y-6">
    <!-- Image settings -->
    <div
      v-if="store.isBackendReachable"
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
        <setImgDebayern />
        <setImgDebayernHfr />
        <setImgUnlinkedStrech />
      </div>
    </div>

    <!-- Image File Path -->
    <div
      v-if="store.isBackendReachable && store.isPINS"
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-gray-800/50 rounded-lg border border-gray-700/50"
    >
      <h3 class="font-bold text-base text-cyan-400">{{ $t('components.settings.imageSavePath.title') }}</h3>

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
      <FilePatternBuilder />
      <setImgFileType class="mt-2" />
    </div>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import setImgStrechFactor from '@/components/settings/setImgStrechFactor.vue';
import setImgQuality from '@/components/settings/setImgQuality.vue';
import setImgBlackClipping from '@/components/settings/setImgBlackClipping.vue';
import setImgDebayern from '@/components/settings/setImgDebayern.vue';
import setImgDebayernHfr from '@/components/settings/setImgDebayernHfr.vue';
import setImgUnlinkedStrech from '@/components/settings/setImgUnlinkedStrech.vue';
import setImgMaxDimension from '@/components/settings/setImgMaxDimension.vue';
import setImgFileType from '@/components/settings/setImgFileType.vue';
import setImgFilePath from '@/components/settings/setImgFilePath.vue';
import FilePatternBuilder from '@/components/settings/image/FilePatternBuilder.vue';

const store = apiStore();
</script>
