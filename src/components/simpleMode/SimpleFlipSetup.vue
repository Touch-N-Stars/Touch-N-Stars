<template>
  <!-- One-time choice of the meridian flip timing, part of "Before your first night" -->
  <div class="flex flex-col gap-2">
    <p class="text-sm font-semibold text-content">{{ $t(`${base}.flipTitle`) }}</p>
    <p class="text-xs text-content-muted">{{ $t(`${base}.flipText`) }}</p>
    <MeridianFlipPresetPicker :showCustom="false" @applied="emit('chosen')" />
    <!-- A field-test user could not answer the question ("never tried it"): give him the
         default to go with and the daylight test to check it. -->
    <p class="text-xs text-content-muted">{{ $t(`${base}.flipNotSureTest`) }}</p>
    <button type="button" class="tns-btn-secondary" @click="flipTestStore.open()">
      {{ $t('components.mount.settings.meridian_flip.dayTest.open') }}
    </button>

    <!-- Values set earlier (by hand or in NINA) that match no preset: keep them with one tap -->
    <div class="flex flex-col gap-2 rounded-control border border-line p-3">
      <p class="text-sm text-content">
        {{ $t(`${base}.flipCurrentValues`, { values: currentTiming }) }}
      </p>
      <button type="button" class="tns-btn-secondary" @click="emit('chosen')">
        {{ $t(`${base}.flipKeepValues`) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useMeridianFlipTestStore } from '@/store/meridianFlipTestStore';
import MeridianFlipPresetPicker from '@/components/mount/settings/MeridianFlipPresetPicker.vue';

const emit = defineEmits(['chosen']);

const base = 'components.simpleMode.setupChecks';
const { t } = useI18n();
const store = apiStore();
const flipTestStore = useMeridianFlipTestStore();

// The stored timing in one line. Only shown while it matches no preset (else the check is done).
const currentTiming = computed(() => {
  const settings = store.profileInfo?.MeridianFlipSettings ?? {};
  const pause = Number(settings.PauseTimeBeforeMeridian) || 0;
  const min = Number(settings.MinutesAfterMeridian) || 0;
  const max = Math.max(min, Number(settings.MaxMinutesAfterMeridian) || 0);
  if (pause > 0) return t(`${base}.flipTimingPause`, { pause, min });
  if (min === max) return t(`${base}.flipTimingFixed`, { min });
  return t(`${base}.flipTimingWindow`, { min, max });
});
</script>
