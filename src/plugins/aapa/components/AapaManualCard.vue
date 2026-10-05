<template>
  <section class="tns-card space-y-3">
    <h2 class="text-base font-semibold text-content">{{ $t('plugins.aapa.manual.title') }}</h2>

    <AapaSettingInput
      setting-key="NudgeDegrees"
      :label="$t('plugins.aapa.manual.stepSize')"
      :disabled="!store.isWsOpen"
    />

    <div class="grid grid-cols-2 gap-2">
      <button class="tns-btn-secondary" :disabled="!canMove" @click="store.nudge('az', -1)">
        {{ $t('plugins.aapa.manual.azMinus') }}
      </button>
      <button class="tns-btn-secondary" :disabled="!canMove" @click="store.nudge('az', 1)">
        {{ $t('plugins.aapa.manual.azPlus') }}
      </button>
      <button class="tns-btn-secondary" :disabled="!canMove" @click="store.nudge('alt', -1)">
        {{ $t('plugins.aapa.manual.altMinus') }}
      </button>
      <button class="tns-btn-secondary" :disabled="!canMove" @click="store.nudge('alt', 1)">
        {{ $t('plugins.aapa.manual.altPlus') }}
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <button class="tns-btn-secondary" :disabled="!canMove" @click="store.command('HOME')">
        {{ $t('plugins.aapa.manual.home') }}
      </button>
      <button class="tns-btn-secondary" :disabled="!canMove" @click="confirmSetHome = true">
        {{ $t('plugins.aapa.manual.setHome') }}
      </button>
    </div>

    <!-- Only offered by servers that implement the proposed STOP command. -->
    <button
      v-if="supportsCommand(store.server, 'STOP')"
      class="tns-btn-danger"
      :disabled="!store.deviceConnected"
      @click="store.command('STOP')"
    >
      {{ $t('plugins.aapa.manual.stop') }}
    </button>

    <AapaConfirmModal
      :show="confirmSetHome"
      :title="$t('plugins.aapa.manual.setHome')"
      :text="$t('plugins.aapa.manual.setHomeConfirm')"
      :confirm-label="$t('plugins.aapa.manual.setHome')"
      @cancel="confirmSetHome = false"
      @confirm="setHome"
    />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import { supportsCommand } from '../utils/aapaProtocol';
import AapaSettingInput from './AapaSettingInput.vue';
import AapaConfirmModal from './AapaConfirmModal.vue';

const store = useAapaStore();
const confirmSetHome = ref(false);

// The server silently drops a nudge while the device is busy, so the buttons say so up front.
const canMove = computed(
  () =>
    store.deviceConnected &&
    !store.server?.isBusy &&
    !store.assistActive &&
    !store.runState.autoPilotRunning &&
    !store.runState.calibrationRunning
);

function setHome() {
  confirmSetHome.value = false;
  store.command('SET_HOME');
}
</script>
