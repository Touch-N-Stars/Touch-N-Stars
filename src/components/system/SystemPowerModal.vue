<template>
  <Modal
    :show="true"
    :disableClose="step === 'restarting'"
    zIndex="z-top"
    maxWidth="max-w-sm"
    @close="emit('close')"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">{{ title }}</h2>
    </template>
    <template #body>
      <!-- Step 1: pick the action -->
      <div v-if="step === 'choose'" class="w-full space-y-4">
        <p class="text-content-muted text-sm text-center">
          {{ $t('components.settings.system.info') }}
        </p>
        <div class="flex justify-center gap-3">
          <button @click="requestAction('restart')" class="tns-btn-danger gap-2 max-w-40">
            <ArrowPathIcon class="h-5 w-5 shrink-0" />
            {{ $t('components.settings.system.restart') }}
          </button>
          <button @click="requestAction('shutdown')" class="tns-btn-danger gap-2 max-w-40">
            <PowerIcon class="h-5 w-5 shrink-0" />
            {{ $t('components.settings.system.shutdown') }}
          </button>
        </div>
      </div>

      <!-- Step 2: confirm -->
      <div v-else-if="step === 'confirm'" class="w-full space-y-6">
        <p class="text-content">
          {{
            action === 'shutdown'
              ? $t('components.settings.system.confirmShutdown')
              : $t('components.settings.system.confirmRestart')
          }}
        </p>
        <div class="flex justify-end gap-3">
          <button @click="cancel" class="tns-btn-secondary w-auto!">
            {{ $t('common.cancel') }}
          </button>
          <button @click="execute" class="tns-btn-primary w-auto!">
            {{ $t('common.confirm') }}
          </button>
        </div>
      </div>

      <!-- Step 3a: restart in progress, page reloads after the countdown -->
      <div v-else-if="step === 'restarting'" class="text-center space-y-4">
        <ArrowPathIcon class="h-12 w-12 mx-auto text-status-warn animate-spin" />
        <p class="text-content">{{ $t('components.settings.system.restartInfoMessage') }}</p>
      </div>

      <!-- Step 3b: shutdown sent, the backend is gone -->
      <div v-else class="text-center space-y-4">
        <PowerIcon class="h-12 w-12 mx-auto text-status-danger" />
        <p class="text-content">{{ $t('components.settings.system.shutdownInfoMessage') }}</p>
        <div class="flex justify-center mt-4">
          <button @click="emit('close')" class="tns-btn-secondary w-auto!">
            {{ $t('common.close') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, PowerIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import apiService from '@/services/apiService';

// Restart / shutdown of the backend host. With `initialAction` the picker is
// skipped and the dialog opens directly on the confirmation (settings page);
// without it the user picks the action first (status bar chip).
const props = defineProps({
  initialAction: {
    type: String,
    default: null,
    validator: (v) => v === null || ['restart', 'shutdown'].includes(v),
  },
});

const emit = defineEmits(['close']);
const { t } = useI18n();

const action = ref(props.initialAction);
const step = ref(props.initialAction ? 'confirm' : 'choose');

const RESTART_RELOAD_DELAY_MS = 10000;
let reloadTimer = null;

const title = computed(() => {
  if (step.value === 'restarting') return t('components.settings.system.restartInfoTitle');
  if (step.value === 'shutdown') return t('components.settings.system.shutdownInfoTitle');
  if (step.value === 'confirm') return t('components.settings.system.confirmation');
  return t('components.settings.system.title');
});

function requestAction(next) {
  action.value = next;
  step.value = 'confirm';
}

// Back to the picker when the dialog started there, otherwise the dialog is done.
function cancel() {
  if (props.initialAction) {
    emit('close');
    return;
  }
  action.value = null;
  step.value = 'choose';
}

function execute() {
  if (action.value === 'restart') {
    apiService.restart();
    console.log('[SystemPowerModal] System restarting...');
    step.value = 'restarting';
    reloadTimer = setTimeout(() => location.reload(), RESTART_RELOAD_DELAY_MS);
  } else {
    apiService.shutdown();
    console.log('[SystemPowerModal] System shutting down...');
    step.value = 'shutdown';
  }
}

onBeforeUnmount(() => clearTimeout(reloadTimer));
</script>
