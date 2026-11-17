<template>
  <div class="space-y-3">
    <section v-for="group in groups" :key="group.id" class="tns-card space-y-3">
      <h2 class="text-base font-semibold text-content">
        {{ $t(`plugins.aapa.settings.groups.${group.id}`) }}
      </h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AapaSettingInput
          v-for="field in group.fields"
          :key="field.key"
          :setting-key="field.key"
          :label="$t(`plugins.aapa.settings.fields.${field.key}`)"
          :disabled="!store.isWsOpen"
        />
      </div>
      <template v-if="group.id === 'motor' || group.id === 'limits'">
        <!-- The current server only stores these in NINA; pushing them to the
             device needs the proposed SEND_SPEED_ACCEL command. -->
        <button
          v-if="supportsCommand(store.server, 'SEND_SPEED_ACCEL')"
          class="tns-btn-secondary"
          :disabled="!store.deviceConnected"
          @click="store.command('SEND_SPEED_ACCEL')"
        >
          {{ $t('plugins.aapa.settings.applyToDevice') }}
        </button>
        <p v-else class="text-xs text-content-faint">
          {{ $t('plugins.aapa.settings.applyInNinaHint') }}
        </p>
      </template>
    </section>

    <section class="tns-card space-y-2">
      <p class="text-xs text-content-faint">{{ $t('plugins.aapa.settings.autoSaveHint') }}</p>
      <div class="flex flex-col sm:flex-row gap-2">
        <button
          class="tns-btn-secondary"
          :disabled="!store.isWsOpen"
          @click="store.command('SAVE_SETTINGS')"
        >
          {{ $t('plugins.aapa.settings.saveInNina') }}
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="!store.deviceConnected"
          @click="confirmSend = true"
        >
          {{ $t('plugins.aapa.settings.storeOnDevice') }}
        </button>
      </div>
    </section>

    <AapaConfirmModal
      :show="confirmSend"
      :title="$t('plugins.aapa.settings.storeOnDevice')"
      :text="$t('plugins.aapa.settings.sendConfirm')"
      :confirm-label="$t('plugins.aapa.settings.storeOnDevice')"
      @cancel="confirmSend = false"
      @confirm="send"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import { SETTINGS_GROUPS, supportsCommand } from '../utils/aapaProtocol';
import AapaSettingInput from './AapaSettingInput.vue';
import AapaConfirmModal from './AapaConfirmModal.vue';

const store = useAapaStore();
// The Auto-Pilot group lives in a modal on the polar alignment card.
const groups = SETTINGS_GROUPS.filter((group) => group.id !== 'autopilot');
const confirmSend = ref(false);

function send() {
  confirmSend.value = false;
  store.command('SEND_TO_AAPA');
}
</script>
