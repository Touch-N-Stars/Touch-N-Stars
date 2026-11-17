<template>
  <!-- One tap, no confirmation, like ButtonSlewStop: stopping the mount must never wait. -->
  <div class="flex flex-col gap-1">
    <button type="button" class="tns-btn-danger" :disabled="stopping" @click="stop">
      <StopIcon class="h-5 w-5" />
      {{ $t('plugins.coneError.abort.button') }}
    </button>
    <p v-if="failed" class="text-xs text-status-danger">
      {{ $t('plugins.coneError.abort.failed') }}
    </p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { StopIcon } from '@heroicons/vue/24/outline';
import { useConeErrorStore } from '../store/coneErrorStore';

const store = useConeErrorStore();
const stopping = ref(false);
const failed = ref(false);

// The measurement is ended; a daytime move is stopped and the daytime check stays open.
async function stop() {
  stopping.value = true;
  failed.value = false;
  try {
    if (store.manualActive) {
      await store.manualStop();
    } else {
      await store.abort();
    }
  } catch {
    failed.value = true;
  } finally {
    stopping.value = false;
  }
}
</script>
