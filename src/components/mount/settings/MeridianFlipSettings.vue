<template>
  <div class="flex flex-col gap-2 sm:gap-4">
    <!-- What a flip is, the one question, and what the stored values mean -->
    <div class="tns-card flex flex-col gap-4">
      <p class="text-sm text-content-muted">
        {{ $t('components.mount.settings.meridian_flip.intro') }}
      </p>
      <MeridianFlipPresetPicker @custom="showAdvanced = true" />
      <MeridianFlipTimeline
        :pause="Number(flipSettings.PauseTimeBeforeMeridian) || 0"
        :min="Number(flipSettings.MinutesAfterMeridian) || 0"
        :max="Number(flipSettings.MaxMinutesAfterMeridian) || 0"
      />
    </div>

    <!-- Daylight test of the flip mechanics -->
    <div class="tns-card flex flex-col gap-3">
      <h3 class="font-bold text-base text-content">
        {{ $t('components.mount.settings.meridian_flip.dayTest.title') }}
      </h3>
      <p class="text-sm text-content-muted">
        {{ $t('components.mount.settings.meridian_flip.dayTest.teaser') }}
      </p>
      <button class="tns-btn-secondary" @click="flipTestStore.open()">
        {{ $t('components.mount.settings.meridian_flip.dayTest.open') }}
      </button>
    </div>

    <!-- Advanced: the raw minute values -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <button
        type="button"
        class="flex items-center justify-between min-h-touch font-bold text-base text-accent"
        :aria-expanded="showAdvanced"
        data-haptic="none"
        @click="showAdvanced = !showAdvanced"
      >
        {{ $t('components.mount.settings.meridian_flip.advanced') }}
        <ChevronDownIcon
          class="w-5 h-5 transition-transform"
          :class="{ 'rotate-180': showAdvanced }"
        />
      </button>
      <template v-if="showAdvanced">
        <SettingInput
          labelKey="components.mount.settings.meridian_flip.MinutesAfterMeridian"
          helpKey="components.mount.settings.meridian_flip.help.MinutesAfterMeridian"
          settingKey="MeridianFlipSettings-MinutesAfterMeridian"
          :modelValue="store.profileInfo.MeridianFlipSettings.MinutesAfterMeridian"
          :max="600"
        />
        <SettingInput
          labelKey="components.mount.settings.meridian_flip.MaxMinutesAfterMeridian"
          helpKey="components.mount.settings.meridian_flip.help.MaxMinutesAfterMeridian"
          settingKey="MeridianFlipSettings-MaxMinutesAfterMeridian"
          :modelValue="store.profileInfo.MeridianFlipSettings.MaxMinutesAfterMeridian"
          :min="Number(flipSettings.MinutesAfterMeridian) || 0"
          :max="600"
        />
        <SettingInput
          labelKey="components.mount.settings.meridian_flip.PauseTimeBeforeMeridian"
          helpKey="components.mount.settings.meridian_flip.help.PauseTimeBeforeMeridian"
          settingKey="MeridianFlipSettings-PauseTimeBeforeMeridian"
          :modelValue="store.profileInfo.MeridianFlipSettings.PauseTimeBeforeMeridian"
          :max="600"
        />
      </template>
    </div>

    <!-- Behavior Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <h3 class="font-bold text-base text-accent">
        {{ $t('components.mount.settings.meridian_flip.behavior') }}
      </h3>
      <SettingInput
        labelKey="components.mount.settings.meridian_flip.SettleTime"
        helpKey="components.mount.settings.meridian_flip.help.SettleTime"
        settingKey="MeridianFlipSettings-SettleTime"
        :modelValue="store.profileInfo.MeridianFlipSettings.SettleTime"
        :max="600"
      />
      <ProfileToggle
        labelKey="components.mount.settings.meridian_flip.Recenter"
        helpKey="components.mount.settings.meridian_flip.help.Recenter"
        settingKey="MeridianFlipSettings-Recenter"
      />
      <ProfileToggle
        labelKey="components.mount.settings.meridian_flip.UseSideOfPier"
        helpKey="components.mount.settings.meridian_flip.help.UseSideOfPier"
        settingKey="MeridianFlipSettings-UseSideOfPier"
      />
    </div>

    <!-- Post-Flip Actions Container -->
    <div
      class="p-2 sm:p-4 flex flex-col gap-2 sm:gap-3 bg-surface-2/50 rounded-lg border border-line/50"
    >
      <h3 class="font-bold text-base text-accent">
        {{ $t('components.mount.settings.meridian_flip.post_flip_actions') }}
      </h3>
      <ProfileToggle
        labelKey="components.mount.settings.meridian_flip.AutoFocusAfterFlip"
        helpKey="components.mount.settings.meridian_flip.help.AutoFocusAfterFlip"
        settingKey="MeridianFlipSettings-AutoFocusAfterFlip"
      />
      <ProfileToggle
        labelKey="components.mount.settings.meridian_flip.RotateImageAfterFlip"
        helpKey="components.mount.settings.meridian_flip.help.RotateImageAfterFlip"
        settingKey="MeridianFlipSettings-RotateImageAfterFlip"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
import MeridianFlipPresetPicker from '@/components/mount/settings/MeridianFlipPresetPicker.vue';
import MeridianFlipTimeline from '@/components/mount/settings/MeridianFlipTimeline.vue';
import { useMeridianFlipTestStore } from '@/store/meridianFlipTestStore';

const store = apiStore();

const showAdvanced = ref(false);
const flipTestStore = useMeridianFlipTestStore();

const flipSettings = computed(() => store.profileInfo?.MeridianFlipSettings ?? {});

// Max below min is undocumented territory in NINA: raising min drags max along instead.
watch(
  () => Number(flipSettings.value.MinutesAfterMeridian),
  async (min) => {
    const max = Number(flipSettings.value.MaxMinutesAfterMeridian);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max >= min) return;
    try {
      await apiService.profileChangeValue('MeridianFlipSettings-MaxMinutesAfterMeridian', min);
    } catch (error) {
      console.error('Error raising max minutes after meridian:', error);
    }
  }
);
</script>
