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
      <!-- The filter wheel page is hidden in the simple mode, so its filter list lives here too -->
      <div v-if="hasFilterWheel" class="mt-2">
        <div class="tns-card flex flex-col gap-2 sm:gap-3">
          <h3 class="tns-section-title">
            {{ $t('components.filterwheel.settings.title') }}
          </h3>
          <FilterSettings />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import settingsSensor from '@/components/settings/camera/settingsSensor.vue';
import settingsTelescope from '@/components/settings/telescope/settingsTelescope.vue';
import settingsMount from '@/components/settings/mount/settingsMount.vue';
import FilterSettings from '@/components/filterwheel/settings/FilterSettings.vue';
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useFilterStore } from '@/store/filterStore';
import { usePolling } from '@/composables/usePolling';

const store = apiStore();
const filterStore = useFilterStore();

// A wheel in the profile is enough: names and focus offsets can be edited while it is off
const hasFilterWheel = computed(() => {
  const id = store.profileInfo?.FilterWheelSettings?.Id;
  return Boolean(store.filterInfo?.Connected || (id && id !== 'No_Device'));
});

// The PINS device options of the wheel, as on the filter wheel page (no-op while disconnected)
usePolling(() => filterStore.readSettings(), 2000);
</script>
