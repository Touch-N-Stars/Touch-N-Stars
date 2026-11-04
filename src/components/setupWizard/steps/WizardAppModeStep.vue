<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.appMode.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.appMode.description') }}
      </p>
    </div>

    <AppModeSelector />
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import AppModeSelector from '@/components/settings/general/AppModeSelector.vue';

const { t } = useI18n();
</script>
