<template>
  <Modal
    :show="secure.showDialog"
    zIndex="z-top"
    maxWidth="max-w-md"
    bodyMaxHeight="max-h-[75vh]"
    :closeOnBackdropClick="false"
    @close="secure.closeDialog()"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">{{ $t('components.secureObservatory.title') }}</h2>
    </template>
    <template #body>
      <div class="w-full space-y-4">
        <!-- Plugin without the endpoint -->
        <p v-if="secure.supported === false" class="text-content">
          {{ $t('components.secureObservatory.unsupported') }}
        </p>

        <!-- Choose what to do -->
        <template v-else-if="!showProgress">
          <p class="text-content-muted text-sm">{{ $t('components.secureObservatory.intro') }}</p>

          <p class="flex items-start gap-2 text-sm text-content">
            <CheckIcon class="h-5 w-5 shrink-0 text-content-muted" />
            <span>{{ $t('components.secureObservatory.always') }}</span>
          </p>

          <ul class="text-sm text-content">
            <li v-for="option in SECURE_OPTIONS" :key="option.step">
              <label class="flex items-center gap-3 min-h-touch cursor-pointer">
                <input
                  v-model="choice[option.field]"
                  type="checkbox"
                  class="w-5 h-5 shrink-0"
                  :data-testid="`secure-option-${option.field}`"
                />
                <span class="flex-1">
                  {{ $t(`components.secureObservatory.steps.${option.step}`) }}
                  <span v-if="!applies(option.step)" class="text-content-faint">
                    · {{ $t('components.secureObservatory.notConnected') }}
                  </span>
                </span>
              </label>
            </li>
          </ul>

          <p
            v-if="
              choice.closeDome &&
              !choice.park &&
              store.domeInfo.Connected &&
              !store.mountInfo.AtPark
            "
            class="text-status-warn text-sm"
          >
            {{ $t('components.secureObservatory.domeNeedsPark') }}
          </p>

          <p v-if="secure.error" class="text-status-danger text-sm">{{ secure.error }}</p>

          <div class="flex justify-end gap-3 pt-2">
            <button class="tns-btn-secondary w-auto!" @click="secure.closeDialog()">
              {{ $t('common.cancel') }}
            </button>
            <button
              class="tns-btn-danger w-auto! gap-2"
              :disabled="secure.busy || secure.supported === null"
              data-testid="secure-start"
              @click="start"
            >
              <MoonIcon class="h-5 w-5 shrink-0" />
              {{ $t('components.secureObservatory.start') }}
            </button>
          </div>
        </template>

        <!-- Progress of the running or last shutdown -->
        <template v-else>
          <p class="text-sm" :class="headlineClass">{{ headline }}</p>

          <ul class="space-y-2">
            <li
              v-for="step in secure.status.steps"
              :key="step.id"
              class="flex items-start gap-3"
              :data-testid="`secure-step-${step.id}`"
            >
              <span class="mt-0.5 shrink-0">
                <Spinner v-if="step.state === 'running'" size="sm" />
                <CheckCircleIcon v-else-if="step.state === 'done'" class="h-5 w-5 text-status-ok" />
                <XCircleIcon
                  v-else-if="step.state === 'failed'"
                  class="h-5 w-5 text-status-danger"
                />
                <MinusCircleIcon
                  v-else-if="step.state === 'skipped'"
                  class="h-5 w-5 text-content-faint"
                />
                <EllipsisHorizontalCircleIcon v-else class="h-5 w-5 text-content-faint" />
              </span>
              <span class="flex-1 min-w-0">
                <span class="block text-content">
                  {{ $t(`components.secureObservatory.steps.${step.id}`) }}
                </span>
                <span v-if="step.message" class="block text-xs text-content-muted break-words">
                  {{ step.message }}
                </span>
              </span>
            </li>
          </ul>

          <div class="flex justify-end gap-3 pt-2">
            <button
              v-if="secure.running"
              class="tns-btn-secondary w-auto!"
              :disabled="secure.busy"
              @click="secure.cancel()"
            >
              {{ $t('components.secureObservatory.stop') }}
            </button>
            <button v-else class="tns-btn-secondary w-auto!" @click="again">
              {{ $t('components.secureObservatory.again') }}
            </button>
            <button class="tns-btn-primary w-auto!" @click="secure.closeDialog()">
              {{ $t('common.close') }}
            </button>
          </div>
        </template>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CheckCircleIcon,
  CheckIcon,
  EllipsisHorizontalCircleIcon,
  MinusCircleIcon,
  MoonIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import {
  SECURE_OPTIONS,
  doneMessageKey,
  useSecureObservatoryStore,
} from '@/store/secureObservatoryStore';

const { t } = useI18n();
const store = apiStore();
const settingsStore = useSettingsStore();
const secure = useSecureObservatoryStore();

// The choice is remembered per app, so the next night starts with the same ticks.
const choice = reactive({
  park: true,
  closeDome: true,
  closeCover: true,
  warmCamera: true,
  disconnect: true,
  ...(settingsStore.endNight ?? {}),
});

// Set when the user asks to choose again after a finished run.
const choosing = ref(false);

// A running shutdown is always shown; a finished one until the user chooses again or reopens.
const showProgress = computed(
  () => !!secure.status?.steps?.length && (secure.running || !choosing.value)
);

watch(
  () => secure.showDialog,
  (open) => {
    if (open) choosing.value = !secure.running && !secure.showResultOnOpen;
  }
);

// A run seen while the dialog is open ends on its result, not on the choice of steps.
watch(
  () => secure.running,
  (running) => {
    if (running) choosing.value = false;
  }
);

function applies(step) {
  switch (step) {
    case 'park_mount':
      return !!store.mountInfo.Connected;
    case 'close_dome':
      return !!store.domeInfo.Connected;
    case 'close_cover':
      return !!store.flatdeviceInfo.Connected;
    case 'warm_camera':
      return !!(store.cameraInfo.Connected && store.cameraInfo.CanSetTemperature);
    default:
      return true;
  }
}

async function start() {
  settingsStore.endNight = { ...choice };
  choosing.value = false;
  await secure.start({ ...choice });
}

function again() {
  choosing.value = true;
}

const headline = computed(() => {
  const state = secure.status?.state;
  if (state === 'running') return t('components.secureObservatory.result.running');
  if (state === 'done') return t(doneMessageKey(secure.status));
  if (state === 'cancelled') return t('components.secureObservatory.result.cancelled');
  const failed = (secure.status?.steps ?? [])
    .filter((step) => step.state === 'failed')
    .map((step) => t(`components.secureObservatory.steps.${step.id}`))
    .join(', ');
  return t('components.secureObservatory.result.failed', { steps: failed });
});

const headlineClass = computed(() => {
  const state = secure.status?.state;
  if (state === 'done') return 'text-status-ok';
  if (state === 'failed') return 'text-status-danger';
  return 'text-content-muted';
});
</script>
