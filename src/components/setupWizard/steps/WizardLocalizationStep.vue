<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.localization.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.localization.description') }}
      </p>
    </div>
    <PinsLocalizationSettings embedded />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import PinsLocalizationSettings from '@/components/pins/system/PinsLocalizationSettings.vue';

const { t } = useI18n();
</script>
