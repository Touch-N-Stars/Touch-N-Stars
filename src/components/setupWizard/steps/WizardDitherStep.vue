<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.guider.ditherTitle') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.guider.ditherDescription') }}
      </p>
    </div>

    <GuiderDitherCalculator />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import GuiderDitherCalculator from '../GuiderDitherCalculator.vue';

const { t } = useI18n();
const store = apiStore();

// The camera step may have just written PixelSize - read the profile again so
// the imaging scale is current.
onMounted(() => store.fetchProfilInfos());
</script>
