<template>
  <div v-if="isWandererRotator" class="flex flex-col gap-2">
    <div class="flex items-center justify-between border border-line-strong p-2 rounded-lg">
      <div class="text-sm font-medium text-content">
        {{ $t('components.rotator.settings.Overshoot') }}
      </div>
      <toggleButton :status-value="overshootEnabled" @click="toggleOvershoot" />
    </div>

    <div
      v-if="overshootEnabled"
      class="flex items-center justify-between border border-line-strong p-2 rounded-lg"
    >
      <div class="text-sm font-medium text-content">
        {{ $t('components.rotator.settings.OvershootDirection') }}
      </div>
      <toggleButton :status-value="overshootDirection" @click="toggleOvershootDirection" />
    </div>

    <div v-if="overshootEnabled" class="border border-line-strong p-2 rounded-lg bg-surface-2/40">
      <SettingInput
        labelKey="components.rotator.settings.OvershootAngle"
        settingKey="RotatorSettings-OvershootAngle"
        :modelValue="angleFromProfile"
        :min="0"
        :max="360"
        step="0.1"
        placeholder="0"
      />
    </div>

    <button v-if="store.rotatorInfo?.Connected" class="tns-btn-danger w-auto!" @click="resetZero">
      {{ $t('components.rotator.settings.ResetPosition') }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { useProfileSetting } from '@/composables/useProfileSetting';
import toggleButton from '@/components/helpers/toggleButton.vue';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';

const store = apiStore();

const isWandererRotator = computed(() => store.rotatorInfo?.Name?.includes('Wanderer') ?? false);

// NINA stores these as booleans but takes them as 'true' / 'false' strings.
const { value: overshootEnabled, save: saveOvershoot } = useProfileSetting(
  'RotatorSettings-Overshoot',
  { fallback: false, toProfile: String }
);
const { value: overshootDirection, save: saveOvershootDirection } = useProfileSetting(
  'RotatorSettings-OvershootDirection',
  { fallback: false, toProfile: String }
);
const angleFromProfile = computed(() => store.profileInfo?.RotatorSettings?.OvershootAngle ?? 0);

function toggleOvershoot() {
  saveOvershoot(!overshootEnabled.value);
}
function toggleOvershootDirection() {
  saveOvershootDirection(!overshootDirection.value);
}

async function resetZero() {
  try {
    await apiService.rotatorAction('reset-position');
    console.log('ResetPosition requested');
  } catch (err) {
    console.error('ResetPosition failed', err);
  }
}
</script>
