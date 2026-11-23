<template>
  <div class="flex flex-col gap-4">
    <h2 class="text-xl font-semibold text-content">
      {{ t('components.setupWizard.steps.info') }}
    </h2>

    <!-- What the next steps are about, in plain words. -->
    <ul class="flex flex-col gap-2 text-sm text-content">
      <li v-for="key in POINTS" :key="key" class="flex gap-2">
        <span class="text-accent">•</span>
        <span>{{ t(`components.setupWizard.info.${key}`) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const POINTS = ['pointDevices', 'pointPowered', 'pointLater'];
</script>
