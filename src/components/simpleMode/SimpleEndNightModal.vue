<template>
  <!-- Closing while the actions run must not look like a cancel: they keep running, so the
       close button and the backdrop stay off until the run is through. -->
  <Modal
    :show="show"
    maxWidth="max-w-md"
    zIndex="z-dialog"
    :closeOnBackdropClick="false"
    :disableClose="running"
    @close="$emit('close')"
  >
    <template #header>
      <h2 class="text-lg font-bold text-content">
        {{ $t('components.simpleMode.endNight.title') }}
      </h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-3 w-full">
        <p class="text-sm text-content-muted">
          {{
            actions.length
              ? $t('components.simpleMode.endNight.intro')
              : store.mountInfo.Connected
                ? $t('components.simpleMode.endNight.nothingToDo')
                : $t('components.simpleMode.endNight.nothingToDoNoMount')
          }}
        </p>
        <ul class="flex flex-col gap-2">
          <li
            v-for="action in actions"
            :key="action"
            class="flex flex-wrap items-center gap-x-3 rounded-chip bg-surface-2 px-3 min-h-touch"
          >
            <input
              :id="`end-night-${action}`"
              v-model="selected[action]"
              type="checkbox"
              class="w-5 h-5 accent-accent-action shrink-0"
              :disabled="running || results[action] !== undefined"
            />
            <label :for="`end-night-${action}`" class="flex-1 text-sm text-content py-2">
              {{ $t(`components.simpleMode.endNight.actions.${action}`, { minutes: warmMinutes }) }}
            </label>
            <Spinner v-if="results[action] === 'running'" size="sm" class="text-accent" />
            <CheckIcon v-else-if="results[action] === 'ok'" class="w-5 h-5 text-status-ok" />
            <ExclamationTriangleIcon
              v-else-if="results[action] === 'failed'"
              class="w-5 h-5 text-status-danger"
            />
            <!-- The reason stays next to the step: a toast was gone before anyone read it. -->
            <p
              v-if="results[action] === 'failed'"
              class="basis-full pb-2 text-xs text-status-danger wrap-break-word"
            >
              {{ reasons[action] }}
            </p>
          </li>
        </ul>
        <p
          v-if="finished"
          class="text-sm"
          :class="anyFailed ? 'text-status-warn' : 'text-status-ok'"
        >
          {{
            anyFailed
              ? $t('components.simpleMode.endNight.someFailed')
              : results.warmCamera === 'ok'
                ? $t('components.simpleMode.endNight.doneWarming')
                : $t('components.simpleMode.endNight.doneShutdown')
          }}
        </p>
        <div class="flex gap-2 w-full">
          <button
            type="button"
            class="tns-btn-secondary"
            :disabled="running"
            @click="$emit('close')"
          >
            {{ finished ? $t('common.close') : $t('common.cancel') }}
          </button>
          <button
            v-if="!finished && actions.length"
            type="button"
            class="tns-btn-danger"
            :disabled="running || !anySelected"
            @click="run"
          >
            <Spinner v-if="running" size="sm" />
            {{ $t('components.simpleMode.endNight.confirm') }}
          </button>
          <button
            v-else-if="finished && !anyFailed && results.warmCamera !== 'ok'"
            type="button"
            class="tns-btn-primary"
            @click="$emit('shutdown')"
          >
            {{ $t('components.simpleMode.summary.ended.shutdown') }}
          </button>
          <!-- The plan already parked and warmed up by itself: the night still has to end here,
               or the start page keeps asking for it. -->
          <button
            v-else-if="!finished"
            type="button"
            class="tns-btn-primary"
            @click="endWithoutActions"
          >
            {{ $t('components.simpleMode.endNight.confirm') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useCameraStore } from '@/store/cameraStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { endNightActions } from '@/utils/simpleMode';
import { warmUpMinutes } from '@/utils/coolingPresets';
import { waitForState } from '@/utils/waitForState';
import { isBackendRefusal } from '@/utils/backendErrors';

const props = defineProps({
  show: { type: Boolean, default: false },
});
const emit = defineEmits(['close', 'finished', 'shutdown']);

const { t } = useI18n();
const store = apiStore();
const cameraStore = useCameraStore();
const sequenceStore = useSequenceStore();

// Frozen when the dialog opens: the list must not reshuffle while the actions change the very
// state it is derived from.
const actions = ref([]);
const selected = reactive({});
const results = reactive({});
// Why a step failed, shown under it.
const reasons = reactive({});
const running = ref(false);
const finished = ref(false);

watch(
  () => props.show,
  (show) => {
    if (!show) return;
    actions.value = endNightActions({
      sequenceRunning: sequenceStore.sequenceRunning,
      guiding: store.guiderInfo.Connected && store.guiderIsRunning,
      mountUnparked: store.mountInfo.Connected && !store.mountInfo.AtPark,
      coolerOn: ['cooling', 'holding'].includes(cameraStore.coolingState),
    });
    for (const key of Object.keys(selected)) delete selected[key];
    for (const key of Object.keys(results)) delete results[key];
    for (const key of Object.keys(reasons)) delete reasons[key];
    for (const action of actions.value) selected[action] = true;
    running.value = false;
    finished.value = false;
  },
  { immediate: true }
);

const anySelected = computed(() => actions.value.some((action) => selected[action]));
const anyFailed = computed(() => Object.values(results).includes('failed'));

// The profile's warm-up ramp, chosen with the cooling timing on the start page.
const warmMinutes = computed(() => warmUpMinutes(store.profileInfo?.CameraSettings));
const PARK_TIMEOUT_MS = 3 * 60 * 1000;

const RUNNERS = {
  async stopSequence() {
    const response = await apiService.sequenceAction('stop');
    if (isBackendRefusal(response)) throw response;
    sequenceStore.setSequenceRunning(false);
  },
  async stopGuiding() {
    const response = await apiService.guiderAction('stop');
    if (isBackendRefusal(response)) throw response;
  },
  async parkMount() {
    const response = await apiService.mountAction('park');
    if (isBackendRefusal(response)) throw response;
    // The park is acknowledged at once and runs in the background. Only a parked mount is
    // safe to power off, so the tick waits for it.
    if (!(await waitForState(() => store.mountInfo.AtPark === true, PARK_TIMEOUT_MS))) {
      throw { Error: t('components.simpleMode.endNight.parkTimeout') };
    }
  },
  async warmCamera() {
    await cameraStore.startWarming(warmMinutes.value);
  },
};

function endWithoutActions() {
  emit('finished', true);
  emit('close');
}

async function run() {
  running.value = true;
  try {
    // One after the other on purpose: the order of endNightActions() is the safe order.
    for (const action of actions.value) {
      if (!selected[action]) continue;
      results[action] = 'running';
      try {
        await RUNNERS[action]();
        results[action] = 'ok';
      } catch (error) {
        console.error(`[Simple mode] end of night: ${action} failed`, error);
        results[action] = 'failed';
        reasons[action] = error?.Error || error?.message || t('components.backendErrors.noReason');
        // A sequence that keeps running would fight the mount and the camera over what
        // follows (it may slew or cool again), so nothing else runs after this failure.
        if (action === 'stopSequence') break;
      }
    }
  } finally {
    running.value = false;
    finished.value = true;
    emit('finished', !anyFailed.value);
  }
}
</script>
