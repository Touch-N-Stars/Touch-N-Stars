<template>
  <section class="tns-card space-y-3">
    <h2 class="text-base font-semibold text-content">{{ $t('plugins.aapa.autoPilot.title') }}</h2>
    <p class="text-xs text-content-faint">{{ $t('plugins.aapa.autoPilot.hint') }}</p>
    <div class="flex gap-2">
      <button
        class="tns-btn-primary"
        :disabled="!store.deviceConnected || run.autoPilotRunning || run.calibrationRunning"
        @click="store.command('StartAutoPilot')"
      >
        {{ $t('plugins.aapa.autoPilot.start') }}
      </button>
      <!-- Stop stays enabled whenever the socket is open: the running state is only
           derived from log lines and may be unknown after a reconnect. -->
      <button
        class="tns-btn-danger"
        :disabled="!store.isWsOpen"
        @click="store.command('StopAutoPilot')"
      >
        {{ $t('plugins.aapa.autoPilot.stop') }}
      </button>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useAapaStore } from '../store/aapaStore';

const store = useAapaStore();
const run = computed(() => store.runState);
</script>
