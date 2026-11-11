<template>
  <div class="space-y-6">
    <!-- Equipment Section -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.equipment.title') }}
      </h3>
      <p class="text-content text-sm">
        {{ $t('components.settings.equipment.description') }}
      </p>
      <div class="mt-2">
        <settings-sensor />
      </div>
      <div class="mt-2">
        <settingsTelescope />
      </div>
      <div v-if="store.isPINS" class="mt-2">
        <settingsMount />
      </div>
    </div>
  </div>
</template>

<script setup>
import settingsSensor from '@/components/settings/camera/settingsSensor.vue';
import settingsTelescope from '@/components/settings/telescope/settingsTelescope.vue';
import settingsMount from '@/components/settings/mount/settingsMount.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
</script>
