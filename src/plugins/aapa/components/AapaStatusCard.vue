<template>
  <section class="grid grid-cols-2 sm:grid-cols-4 gap-2">
    <div class="tns-stat-tile">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.positionX') }}</span>
      <span class="tns-stat-value">{{ server?.positionX ?? '–' }}</span>
    </div>
    <div class="tns-stat-tile">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.positionY') }}</span>
      <span class="tns-stat-value">{{ server?.positionY ?? '–' }}</span>
    </div>
    <div class="tns-stat-tile" :class="{ 'tns-stat-tile-warn': server?.isBusy }">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.motion') }}</span>
      <span class="tns-stat-value">
        {{ server?.isBusy ? $t('plugins.aapa.status.moving') : $t('plugins.aapa.status.idle') }}
      </span>
    </div>
    <div class="tns-stat-tile">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.homed') }}</span>
      <span class="tns-stat-value">
        {{ server?.isHomed ? $t('general.yes') : $t('general.no') }}
      </span>
    </div>
    <div v-if="run.lastError" class="tns-stat-tile col-span-2">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.lastError') }}</span>
      <span class="tns-stat-value">
        Az {{ formatDeg(run.lastError.azDeg) }} · Alt {{ formatDeg(run.lastError.altDeg) }}
        <template v-if="Number.isFinite(run.lastError.totalArcSec)">
          ·
          {{
            $t('plugins.aapa.status.totalError', { arcsec: run.lastError.totalArcSec.toFixed(1) })
          }}
        </template>
      </span>
    </div>
    <div v-if="run.autoPilotRunning && run.lastCorrection" class="tns-stat-tile col-span-2">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.lastCorrection') }}</span>
      <span class="tns-stat-value">
        {{
          $t('plugins.aapa.status.correctionSteps', {
            az: formatSteps(run.lastCorrection.azSteps),
            alt: formatSteps(run.lastCorrection.altSteps),
          })
        }}
      </span>
    </div>
    <div v-if="run.autoPilotRunning" class="tns-stat-tile col-span-2">
      <span class="tns-stat-label">{{ $t('plugins.aapa.status.autoPilot') }}</span>
      <span class="tns-stat-value">
        {{
          run.autoPilotIteration
            ? $t('plugins.aapa.status.iteration', { n: run.autoPilotIteration })
            : $t('plugins.aapa.status.running')
        }}
      </span>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useAapaStore } from '../store/aapaStore';

const store = useAapaStore();
const server = computed(() => store.server);
const run = computed(() => store.runState);

function formatSteps(value) {
  return Number.isFinite(value) ? `${value > 0 ? '+' : ''}${value}` : '–';
}

function formatDeg(value) {
  if (!Number.isFinite(value)) return '–';
  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}°`;
}
</script>
