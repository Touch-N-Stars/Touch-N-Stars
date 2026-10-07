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
      <button class="tns-btn-secondary" :disabled="!canMove" @click="pendingSetHome = 'SET_HOME'">
        {{ $t('plugins.aapa.manual.setHome') }}
      </button>
      <!-- Per-axis variants, offered by protocol v2 servers. -->
      <template v-if="hasAxisCommands">
        <button class="tns-btn-secondary" :disabled="!canMove" @click="store.command('HOME_AZ')">
          {{ $t('plugins.aapa.manual.homeAz') }}
        </button>
        <button class="tns-btn-secondary" :disabled="!canMove" @click="store.command('HOME_ALT')">
          {{ $t('plugins.aapa.manual.homeAlt') }}
        </button>
        <button class="tns-btn-secondary" :disabled="!canMove" @click="pendingSetHome = 'RESET_X'">
          {{ $t('plugins.aapa.manual.setHomeAz') }}
        </button>
        <button class="tns-btn-secondary" :disabled="!canMove" @click="pendingSetHome = 'RESET_Y'">
          {{ $t('plugins.aapa.manual.setHomeAlt') }}
        </button>
      </template>
    </div>

    <button
      v-if="supportsCommand(store.server, 'STOP')"
      class="tns-btn-danger"
      :disabled="!store.isWsOpen"
      @click="store.emergencyStop()"
    >
      {{ $t('plugins.aapa.manual.stopAll') }}
    </button>

    <AapaConfirmModal
      :show="pendingSetHome !== null"
      :title="confirmTitle"
      :text="confirmText"
      :confirm-label="confirmTitle"
      @cancel="pendingSetHome = null"
      @confirm="setHome"
    />
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAapaStore } from '../store/aapaStore';
import { supportsCommand } from '../utils/aapaProtocol';
import AapaSettingInput from './AapaSettingInput.vue';
import AapaConfirmModal from './AapaConfirmModal.vue';

const store = useAapaStore();
const { t } = useI18n();

// null, or the command waiting for confirmation: SET_HOME (both axes), RESET_X or RESET_Y
const pendingSetHome = ref(null);

const SET_HOME_LABELS = {
  SET_HOME: 'plugins.aapa.manual.setHome',
  RESET_X: 'plugins.aapa.manual.setHomeAz',
  RESET_Y: 'plugins.aapa.manual.setHomeAlt',
};

const hasAxisCommands = computed(() =>
  ['HOME_AZ', 'HOME_ALT', 'RESET_X', 'RESET_Y'].every((cmd) => supportsCommand(store.server, cmd))
);

const confirmTitle = computed(() =>
  pendingSetHome.value ? t(SET_HOME_LABELS[pendingSetHome.value]) : ''
);
const confirmText = computed(() =>
  pendingSetHome.value === 'SET_HOME'
    ? t('plugins.aapa.manual.setHomeConfirm')
    : t('plugins.aapa.manual.setHomeAxisConfirm', {
        axis: pendingSetHome.value === 'RESET_X' ? 'Az' : 'Alt',
      })
);

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
  const command = pendingSetHome.value;
  pendingSetHome.value = null;
  if (command) store.command(command);
}
</script>
