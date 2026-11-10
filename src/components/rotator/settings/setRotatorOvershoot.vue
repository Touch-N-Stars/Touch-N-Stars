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
import toggleButton from '@/components/helpers/toggleButton.vue';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';

const store = apiStore();

// derived/reactive values from profile (single source of truth)
const isWandererRotator = computed(() => store.rotatorInfo?.Name?.includes('Wanderer') ?? false);
const overshootEnabled = computed({
  get: () => store.profileInfo?.RotatorSettings?.Overshoot ?? false,
  set: async (v) => {
    await apiService.profileChangeValue('RotatorSettings-Overshoot', String(v));
  },
});
const overshootDirection = computed({
  get: () => store.profileInfo?.RotatorSettings?.OvershootDirection ?? false,
  set: async (v) => {
    await apiService.profileChangeValue('RotatorSettings-OvershootDirection', String(v));
  },
});
const angleFromProfile = computed(() => store.profileInfo?.RotatorSettings?.OvershootAngle ?? 0);

// toggle handlers use the computed setters so UI and profile stay in sync
function toggleOvershoot() {
  overshootEnabled.value = !overshootEnabled.value;
}
function toggleOvershootDirection() {
  overshootDirection.value = !overshootDirection.value;
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
