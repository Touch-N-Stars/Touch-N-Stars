<template>
  <section class="tns-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-content">
        {{ $t('plugins.aapa.calibration.title') }}
      </h2>
      <span v-if="run.calibrationRunning" class="text-sm text-status-warn">
        {{ $t('plugins.aapa.calibration.running') }}
      </span>
    </div>
    <p class="text-xs text-content-faint">{{ $t('plugins.aapa.calibration.hint') }}</p>

    <AapaSettingInput
      setting-key="CalibrationSteps"
      :label="$t('plugins.aapa.calibration.steps')"
      :disabled="!store.isWsOpen"
    />

    <div class="grid grid-cols-2 gap-2">
      <button class="tns-btn-secondary" :disabled="!canCalibrate" @click="store.calibrate('az')">
        {{ $t('plugins.aapa.calibration.azimuth') }}
      </button>
      <button class="tns-btn-secondary" :disabled="!canCalibrate" @click="store.calibrate('alt')">
        {{ $t('plugins.aapa.calibration.altitude') }}
      </button>
    </div>

    <dl class="grid grid-cols-2 gap-2 text-sm">
      <div class="tns-stat-tile">
        <dt class="tns-stat-label">{{ $t('plugins.aapa.settings.fields.AzimuthGearRatio') }}</dt>
        <dd class="tns-stat-value">{{ store.settings.AzimuthGearRatio ?? '–' }}</dd>
      </div>
      <div class="tns-stat-tile">
        <dt class="tns-stat-label">{{ $t('plugins.aapa.settings.fields.AltitudeGearRatio') }}</dt>
        <dd class="tns-stat-value">{{ store.settings.AltitudeGearRatio ?? '–' }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import AapaSettingInput from './AapaSettingInput.vue';

const store = useAapaStore();
const run = computed(() => store.runState);
const canCalibrate = computed(
  () =>
    store.deviceConnected &&
    !store.server?.isBusy &&
    !store.assistActive &&
    !run.value.autoPilotRunning &&
    !run.value.calibrationRunning
);
</script>
