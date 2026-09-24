<template>
  <Modal :show="show" maxWidth="max-w-3xl" :closeOnBackdropClick="false" @close="onDismiss">
    <template #header>
      <h2 class="text-xl font-bold text-white">{{ L('title') }}</h2>
    </template>
    <template #body>
      <div class="flex w-full flex-col gap-4">
        <!-- Request errors, the wizard's own validation message, and command failures -->
        <p
          v-if="errorText"
          class="rounded-lg border border-red-700/50 bg-red-900/40 p-3 text-sm text-red-200"
        >
          {{ errorText }}
        </p>

        <p
          v-if="notice"
          class="rounded-lg border border-amber-600/50 bg-amber-900/25 p-3 text-sm text-amber-200"
        >
          {{ notice }}
        </p>

        <p v-if="!state" class="py-6 text-center text-gray-400">{{ L('starting') }}</p>

        <template v-else-if="state.Active">
          <OptimizerSourceStep
            v-if="step === 'SelectSource'"
            :state="state"
            :saved-runs="savedRuns"
            :loading-runs="loadingRuns"
            @set="setProperty"
            @source="setSource"
          />
          <OptimizerProgressStep
            v-else-if="step === 'Acquire' || step === 'Optimize'"
            :state="state"
          />
          <OptimizerSummaryStep
            v-else-if="step === 'Summary'"
            :state="state"
            @set="setProperty"
            @command="runCommand"
          />
          <p v-else class="text-sm text-gray-400">{{ L('reviewDesktopOnly') }}</p>

          <!-- Actions for the current step -->
          <div
            class="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-gray-700/60 bg-gray-800 pt-3"
          >
            <template v-if="step === 'SelectSource'">
              <button class="tns-btn-secondary w-auto px-4" @click="endSession">
                {{ L('close') }}
              </button>
              <button
                class="tns-btn-primary w-auto px-4"
                :disabled="
                  !canRun('StartCommand') || (state.Values?.IsLive && state.SequenceRunning)
                "
                @click="runCommand('StartCommand')"
              >
                {{ L('start') }}
              </button>
            </template>
            <template v-else-if="step === 'Acquire' || step === 'Optimize'">
              <button class="tns-btn-secondary w-auto px-4" @click="emit('close')">
                {{ L('hide') }}
              </button>
              <button
                class="tns-btn-danger w-auto px-4"
                :disabled="!canRun('CancelCommand')"
                @click="runCommand('CancelCommand')"
              >
                {{ L('cancel') }}
              </button>
            </template>
            <template v-else-if="step === 'Summary'">
              <button
                class="tns-btn-secondary w-auto px-4"
                :disabled="!canRun('BackCommand')"
                @click="runCommand('BackCommand')"
              >
                {{ L('back') }}
              </button>
              <button
                v-if="state.Values?.CanContinueOptimization"
                class="tns-btn-secondary w-auto px-4"
                :disabled="!canRun('ContinueOptimizationCommand')"
                :title="H('continue')"
                @click="runCommand('ContinueOptimizationCommand')"
              >
                {{ L('continueOptimizing') }}
              </button>
              <button class="tns-btn-secondary w-auto px-4" @click="runCommand('CloseCommand')">
                {{ L('close') }}
              </button>
              <button
                class="tns-btn-primary w-auto px-4"
                :disabled="!canRun('AcceptCommand')"
                @click="runCommand('AcceptCommand')"
              >
                {{ L('accept') }}
              </button>
            </template>
            <button v-else class="tns-btn-secondary w-auto px-4" @click="endSession">
              {{ L('close') }}
            </button>
          </div>
        </template>
      </div>
    </template>
  </Modal>

  <!-- One of the wizard's confirmations, relayed from the backend; it waits there until answered -->
  <Modal
    :show="!!pending"
    maxWidth="max-w-md"
    zIndex="z-50"
    :disableClose="true"
    :closeOnBackdropClick="false"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">{{ pending?.Title }}</h2>
    </template>
    <template #body>
      <div class="flex w-full flex-col gap-6">
        <p class="whitespace-pre-line text-sm text-gray-300">{{ pending?.Message }}</p>
        <div class="flex justify-end gap-3">
          <button
            class="tns-btn-secondary w-auto px-4"
            :disabled="answering"
            @click="answer(false)"
          >
            {{ L('no') }}
          </button>
          <button class="tns-btn-primary w-auto px-4" :disabled="answering" @click="answer(true)">
            {{ L('yes') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiService from '@/services/apiService';
import Modal from '@/components/helpers/Modal.vue';
import OptimizerSourceStep from './OptimizerSourceStep.vue';
import OptimizerProgressStep from './OptimizerProgressStep.vue';
import OptimizerSummaryStep from './OptimizerSummaryStep.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'accepted']);

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.optimizer.${key}`);
const H = (key) => t(`plugins.hocusfocus.optimizer.help.${key}`);
const api = apiService.hocusfocus.optimizer;

const state = ref(null);
const requestError = ref('');
const notice = ref('');
const savedRuns = ref([]);
const loadingRuns = ref(false);
const answering = ref(false);

const step = computed(() => state.value?.Values?.CurrentStep);
const pending = computed(() => state.value?.PendingConfirmation || null);
const busy = computed(() => !!state.value?.Values?.IsBusy);
const canRun = (name) => !!state.value?.Commands?.[name]?.CanExecute;

const errorText = computed(
  () =>
    requestError.value ||
    state.value?.LastCommandError ||
    (state.value?.Values?.HasError ? state.value.Values.ErrorMessage : '')
);

function applyState(next) {
  if (!next) return;
  state.value = next;
  if (next.Active === false) {
    // The session ended: Accept applied the result, Close/Cancel discarded it.
    stopPolling();
    if (next.LastOutcome === 'accepted') emit('accepted');
    emit('close');
  }
}

async function call(promise) {
  try {
    requestError.value = '';
    applyState(await promise);
  } catch (err) {
    requestError.value = err.message;
  }
}

// Resume a session that is still running (it survives the window, a page reload or a sleeping phone),
// otherwise start a new one.
async function open() {
  state.value = null;
  requestError.value = '';
  notice.value = '';
  try {
    const current = await api.getState();
    // NINA ends a session left idle for 30 minutes to free its frames; say so rather than silently
    // starting over.
    if (!current.Active && current.LastOutcome === 'timedOut') notice.value = L('timedOutNotice');
    applyState(current.Active ? current : await api.start());
  } catch (err) {
    requestError.value = err.message;
  }
  loadSavedRuns();
  startPolling();
}

async function loadSavedRuns() {
  loadingRuns.value = true;
  try {
    const result = await apiService.hocusfocus.listAutoFocusDirectories();
    savedRuns.value = result?.DirectoryNames || [];
  } catch (err) {
    console.error('[Optimizer] Error listing saved auto-focus runs:', err);
    savedRuns.value = [];
  } finally {
    loadingRuns.value = false;
  }
}

const setProperty = (name, value) => call(api.setProperty(name, value));
const setSource = (relativePath) => call(api.setSource(0, relativePath));
const runCommand = (name) => call(api.runCommand(name));
const endSession = async () => {
  await call(api.end());
  emit('close');
};

async function answer(agreed) {
  if (!pending.value) return;
  answering.value = true;
  await call(api.confirm(pending.value.Id, agreed));
  answering.value = false;
}

// Closing while it works only hides the window: the run carries on in NINA and can be reopened.
// With nothing running, closing ends the session, as closing the desktop wizard does.
function onDismiss() {
  if (busy.value) emit('close');
  else endSession();
}

// --- Polling while the window is open --------------------------------------------------------

let pollTimer = null;
let pollGeneration = 0;

function startPolling() {
  stopPolling();
  const generation = pollGeneration;
  const poll = async () => {
    try {
      const next = await api.getState();
      if (generation !== pollGeneration) return;
      applyState(next);
    } catch (err) {
      if (generation === pollGeneration) requestError.value = err.message;
    }
    if (generation === pollGeneration) pollTimer = setTimeout(poll, 1000);
  };
  pollTimer = setTimeout(poll, 1000);
}

function stopPolling() {
  pollGeneration++;
  clearTimeout(pollTimer);
  pollTimer = null;
}

watch(
  () => props.show,
  (visible) => (visible ? open() : stopPolling()),
  { immediate: true }
);

onBeforeUnmount(stopPolling);
</script>
