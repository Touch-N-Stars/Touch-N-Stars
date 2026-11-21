<template>
  <div class="max-w-2xl lg:max-w-6xl mx-auto flex flex-col gap-4 pb-8">
    <!-- The mode only exists on PINS -->
    <div v-if="!available" class="tns-card flex flex-col gap-3">
      <h1 class="text-xl font-bold text-content">{{ $t('components.simpleMode.title') }}</h1>
      <p class="text-sm text-content-muted">{{ $t('components.simpleMode.pinsOnly') }}</p>
      <router-link to="/equipment" class="tns-btn-secondary">
        {{ $t('components.simpleMode.more.equipment') }}
      </router-link>
    </div>

    <template v-else>
      <header class="flex flex-col gap-1 px-1">
        <h1 class="text-2xl font-bold text-content">{{ $t('components.simpleMode.title') }}</h1>
        <p class="text-sm text-content-muted">{{ $t('components.simpleMode.subtitle') }}</p>
      </header>

      <!-- Reached /start with the mode switched off (e.g. by a bookmark) -->
      <div
        v-if="!enabled"
        class="tns-card border-accent/40! flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <p class="flex-1 text-sm text-content">{{ $t('components.simpleMode.offHint') }}</p>
        <button type="button" class="tns-btn-primary sm:w-auto!" @click="switchMode(true)">
          {{ $t('components.simpleMode.turnOn') }}
        </button>
      </div>

      <!-- Phone: one column, picture first. Tablet landscape: picture and equipment on the
           left, the night on the right. -->
      <div class="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:items-start">
        <div class="flex flex-col gap-4">
          <SimpleLivePanel />
          <SimpleRigCard />
        </div>

        <div class="flex flex-col gap-4">
          <SimpleSetupChecks />

          <section class="flex flex-col gap-2">
            <div class="flex items-baseline justify-between gap-2 px-1">
              <h2 class="tns-section-title">{{ $t('components.simpleMode.night.title') }}</h2>
              <span class="text-xs text-content-faint">
                {{
                  $t('components.simpleMode.night.progress', {
                    done: doneCount,
                    total: steps.length,
                  })
                }}
              </span>
            </div>

            <SimpleStepCard
              v-for="(step, index) in steps"
              :key="step.id"
              :number="index + 1"
              :status="step.status"
              :current="step.id === currentId"
              :title="$t(`components.simpleMode.steps.${step.id}.title`)"
              :description="$t(`components.simpleMode.steps.${step.id}.description`)"
              :summary="summaries[step.id] || ''"
              :markable="MARKABLE_STEPS.includes(step.id)"
              :skippable="SKIPPABLE_STEPS.includes(step.id)"
              :hasMark="Boolean(marks[step.id])"
              @mark="setMark(step.id, $event)"
            >
              <!-- 1. Connect -->
              <template v-if="step.id === 'connect'">
                <p v-if="step.status !== 'done'" class="text-xs text-content-faint">
                  {{ $t('components.simpleMode.steps.connect.hint') }}
                </p>
              </template>

              <!-- 2. Cool the camera -->
              <template v-else-if="step.id === 'cool'">
                <DeviceNotConnected
                  v-if="!store.cameraInfo.Connected"
                  messageKey="components.simpleMode.needsCamera"
                />
                <template v-else-if="step.status !== 'done'">
                  <NumberInputPicker
                    :modelValue="coolTemp"
                    labelKey="components.simpleMode.steps.cool.targetTemp"
                    :label="$t('components.simpleMode.steps.cool.targetTemp')"
                    inputId="simple-mode-cool-temp"
                    :min="-40"
                    :max="20"
                    :step="1"
                    :decimalPlaces="0"
                    :useDefaultSentinel="false"
                    labelPosition="top"
                    wrapperClass="w-full"
                    @update:modelValue="settingsStore.setSimpleModeCoolTemp($event)"
                  />
                  <button
                    type="button"
                    class="tns-btn-primary"
                    :disabled="busy.cool || cameraStore.coolingState === 'cooling'"
                    @click="startCooling"
                  >
                    <Spinner v-if="busy.cool" size="sm" />
                    {{ $t('components.simpleMode.steps.cool.start', { temp: coolTemp }) }}
                  </button>
                </template>
              </template>

              <!-- 3. Mount ready -->
              <template v-else-if="step.id === 'mount'">
                <DeviceNotConnected
                  v-if="!store.mountInfo.Connected"
                  messageKey="components.simpleMode.needsMount"
                />
                <p
                  v-else-if="step.status !== 'done' && tppaStore.stoppedAfterRun"
                  class="text-xs text-status-warn"
                >
                  {{ $t('components.simpleMode.steps.mount.trackingOffAfterPolar') }}
                </p>
                <button
                  v-if="store.mountInfo.Connected && step.status !== 'done'"
                  type="button"
                  class="tns-btn-primary"
                  :disabled="busy.mount || store.mountIsSlewing"
                  @click="makeMountReady"
                >
                  <Spinner v-if="busy.mount" size="sm" />
                  {{ $t('components.simpleMode.steps.mount.action') }}
                </button>
              </template>

              <!-- 4. Polar alignment -->
              <template v-else-if="step.id === 'polar'">
                <p v-if="locationMissing || databaseMissing" class="text-xs text-status-warn">
                  {{ $t('components.simpleMode.setupChecks.blockedPolar') }}
                </p>
                <p v-if="!focusSettled" class="text-xs text-status-warn">
                  {{ $t('components.simpleMode.focusFirst') }}
                </p>
                <button
                  type="button"
                  class="tns-btn-primary"
                  :disabled="!store.mountInfo.Connected || !store.cameraInfo.Connected"
                  @click="openPolarAlignment"
                >
                  {{ $t('components.simpleMode.steps.polar.action') }}
                </button>
                <p
                  v-if="!store.mountInfo.Connected || !store.cameraInfo.Connected"
                  class="text-xs text-status-warn"
                >
                  {{ $t('components.simpleMode.needsCameraAndMount') }}
                </p>
              </template>

              <!-- 5. Target: picked in the sky atlas, which slews, centers and fills the plan -->
              <template v-else-if="step.id === 'target'">
                <p v-if="databaseMissing" class="text-xs text-status-warn">
                  {{ $t('components.simpleMode.setupChecks.blockedTarget') }}
                </p>
                <p v-if="!focusSettled" class="text-xs text-status-warn">
                  {{ $t('components.simpleMode.focusFirst') }}
                </p>
                <ol class="text-xs text-content-muted list-decimal pl-5 flex flex-col gap-1">
                  <li>{{ $t('components.simpleMode.steps.target.howSearch') }}</li>
                  <!-- The atlas' own button labels, so the hint matches in every language -->
                  <li>
                    {{
                      $t('components.simpleMode.steps.target.howSlew', {
                        button: $t('components.slewAndCenter.slew_and_center'),
                        slew: $t('components.slewAndCenter.slew'),
                      })
                    }}
                  </li>
                  <li>
                    {{
                      $t('components.simpleMode.steps.target.howPlan', {
                        button: $t('components.framing.setSequnceTarget'),
                      })
                    }}
                  </li>
                </ol>
                <!-- Same rig-wide setting as the switch next to the atlas slew button -->
                <div class="tns-field-row">
                  <span class="text-sm text-content">
                    {{ $t('components.simpleMode.steps.target.autoCenter') }}
                  </span>
                  <ToggleButton
                    :statusValue="settingsStore.mount?.useCenter === true"
                    @update:statusValue="setAutoCenter"
                  />
                </div>
                <button type="button" class="tns-btn-primary" @click="openAtlas">
                  {{ $t('components.simpleMode.steps.target.action') }}
                </button>
              </template>

              <!-- 6. Focus -->
              <template v-else-if="step.id === 'focus'">
                <!-- Autofocus needs a one-time setup per telescope (step size, exposure,
                     star detection); unset, a run tends to fail. Hocus Focus brings the
                     assistant for it. -->
                <div
                  v-if="afSetupNeeded"
                  class="flex flex-col gap-2 rounded-control border border-status-warn/40 p-3"
                >
                  <p class="text-sm text-content">
                    {{ $t('components.simpleMode.steps.focus.setupFirst') }}
                  </p>
                  <button type="button" class="tns-btn-primary" @click="showAfSetup = true">
                    {{ $t('components.simpleMode.steps.focus.setup') }}
                  </button>
                </div>
                <!-- Focus needs stars in the picture; the target step comes later, so the way
                     to point the telescope somewhere is offered here too. -->
                <button
                  v-if="store.mountInfo.Connected"
                  type="button"
                  class="tns-btn-secondary"
                  @click="openAtlas"
                >
                  {{ $t('components.simpleMode.steps.focus.pointAtStars') }}
                </button>
                <template v-if="store.focuserInfo.Connected">
                  <button
                    v-if="!store.focuserAfInfo?.autofocus_running"
                    type="button"
                    :class="afSetupNeeded ? 'tns-btn-secondary' : 'tns-btn-primary'"
                    :disabled="busy.focus || !store.cameraInfo.Connected"
                    @click="startAutofocus"
                  >
                    <Spinner v-if="busy.focus" size="sm" />
                    {{ $t('components.simpleMode.steps.focus.autofocus') }}
                  </button>
                  <router-link to="/autofocus" class="tns-btn-secondary">
                    {{ $t('components.simpleMode.steps.focus.watch') }}
                  </router-link>
                </template>
                <template v-else>
                  <p class="text-xs text-content-faint">
                    {{ $t('components.simpleMode.steps.focus.manualHint') }}
                  </p>
                  <router-link to="/camera" class="tns-btn-primary">
                    {{ $t('components.simpleMode.steps.focus.manual') }}
                  </router-link>
                </template>
              </template>

              <!-- 7. Guiding with the guider built into PINS -->
              <template v-else-if="step.id === 'guide'">
                <template v-if="!usesNativeGuider">
                  <p class="text-sm text-content">
                    {{ $t('components.simpleMode.steps.guide.useNativeHint') }}
                  </p>
                  <button
                    v-if="nativeGuiderOffered"
                    type="button"
                    class="tns-btn-primary"
                    :disabled="busy.guide"
                    @click="switchToNativeGuider"
                  >
                    <Spinner v-if="busy.guide" size="sm" />
                    {{ $t('components.simpleMode.steps.guide.useNative') }}
                  </button>
                  <p v-else-if="nativeGuiderOffered === false" class="text-xs text-status-warn">
                    {{ $t('components.simpleMode.steps.guide.nativeMissing') }}
                    <router-link to="/pins" class="underline text-accent">
                      {{ $t('components.simpleMode.more.system') }}
                    </router-link>
                  </p>
                </template>
                <template v-else-if="!guideCameraChosen">
                  <label for="simple-mode-guide-camera" class="text-xs text-status-warn">
                    {{ $t('components.simpleMode.steps.guide.chooseCamera') }}
                  </label>
                  <select
                    id="simple-mode-guide-camera"
                    class="tns-select"
                    :disabled="busy.guide || guideCameras.length === 0"
                    :value="''"
                    @change="chooseGuideCamera($event.target.value)"
                  >
                    <option value="" disabled>
                      {{
                        guideCameras.length
                          ? $t('components.simpleMode.steps.guide.chooseCameraAction')
                          : $t('components.simpleMode.steps.guide.noGuideCamera')
                      }}
                    </option>
                    <option v-for="camera in guideCameras" :key="camera.id" :value="camera.id">
                      {{ camera.name }}
                    </option>
                  </select>
                </template>
                <template v-else-if="store.guiderInfo.Connected">
                  <button
                    v-if="!guiderBusy"
                    type="button"
                    class="tns-btn-primary"
                    :disabled="busy.guide || !store.mountInfo.Connected"
                    @click="startGuiding"
                  >
                    <Spinner v-if="busy.guide" size="sm" />
                    {{
                      nativeGuiderStore.isCalibrated
                        ? $t('components.simpleMode.steps.guide.start')
                        : $t('components.simpleMode.steps.guide.calibrateAndStart')
                    }}
                  </button>
                  <button
                    v-else
                    type="button"
                    class="tns-btn-danger"
                    :disabled="busy.guide"
                    @click="stopGuiding"
                  >
                    {{ $t('components.simpleMode.steps.guide.stop') }}
                  </button>
                </template>
                <DeviceNotConnected v-else messageKey="components.simpleMode.needsGuider" />
                <router-link v-if="usesNativeGuider" to="/guider" class="tns-btn-secondary">
                  {{ $t('components.simpleMode.steps.guide.details') }}
                </router-link>
              </template>

              <!-- 8. Capture -->
              <template v-else-if="step.id === 'capture'">
                <div v-if="plan.targets > 0" class="grid grid-cols-2 gap-2">
                  <div class="tns-stat-tile">
                    <span class="tns-stat-label">{{
                      $t('components.simpleMode.steps.capture.targets')
                    }}</span>
                    <span class="tns-stat-value">{{ plan.targets }}</span>
                  </div>
                  <div class="tns-stat-tile">
                    <span class="tns-stat-label">{{
                      $t('components.simpleMode.steps.capture.remaining')
                    }}</span>
                    <span class="tns-stat-value">{{ plan.remaining }}</span>
                  </div>
                </div>
                <p v-else class="text-xs text-content-faint">
                  {{ $t('components.simpleMode.steps.capture.noPlan') }}
                </p>
                <p
                  v-if="plan.targets > 0 && plan.totalSeconds === 0"
                  class="text-xs text-status-warn"
                >
                  {{ $t('components.simpleMode.steps.capture.noExposures') }}
                </p>
                <router-link to="/sequence" class="tns-btn-secondary">
                  {{
                    plan.targets > 0
                      ? $t('components.simpleMode.steps.capture.editPlan')
                      : $t('components.simpleMode.steps.capture.createPlan')
                  }}
                </router-link>
                <template v-if="sequenceStore.sequenceRunning">
                  <router-link to="/seq-mon" class="tns-btn-primary">
                    {{ $t('components.simpleMode.steps.capture.watch') }}
                  </router-link>
                  <button
                    type="button"
                    class="tns-btn-danger"
                    :disabled="busy.capture"
                    @click="stopCapture"
                  >
                    {{ $t('components.simpleMode.steps.capture.stop') }}
                  </button>
                </template>
                <button
                  v-else
                  type="button"
                  class="tns-btn-primary"
                  :disabled="
                    busy.capture || plan.totalSeconds === 0 || sequenceStore.sequenceControlsLocked
                  "
                  @click="startCapture"
                >
                  <Spinner v-if="busy.capture" size="sm" />
                  {{ $t('components.simpleMode.steps.capture.start') }}
                </button>
              </template>

              <!-- 9. End of night -->
              <template v-else-if="step.id === 'end'">
                <button type="button" class="tns-btn-danger" @click="showEndNight = true">
                  {{ $t('components.simpleMode.steps.end.action') }}
                </button>
              </template>
            </SimpleStepCard>
          </section>

          <!-- Everything else, one tap away -->
          <section class="tns-card flex flex-col gap-3">
            <h2 class="tns-section-title">{{ $t('components.simpleMode.more.title') }}</h2>
            <div class="grid grid-cols-2 gap-2">
              <router-link
                v-for="link in moreLinks"
                :key="link.to"
                :to="link.to"
                class="tns-btn-secondary"
              >
                {{ $t(link.labelKey) }}
              </router-link>
            </div>
            <button
              v-if="enabled"
              type="button"
              class="tns-btn-ghost w-full! text-content-muted"
              @click="switchMode(false)"
            >
              {{ $t('components.simpleMode.showAll') }}
            </button>
          </section>
        </div>
      </div>
    </template>

    <HfSetupAssistant
      v-if="hfStore.available"
      :show="showAfSetup"
      @finished="settingsStore.markAutofocusSetUp(store.profileInfo?.Id)"
      @close="showAfSetup = false"
    />

    <SimpleEndNightModal
      :show="showEndNight"
      @close="showEndNight = false"
      @finished="(ok) => ok && setMark('end', 'done')"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useCameraStore } from '@/store/cameraStore';
import { useSequenceStore } from '@/store/sequenceStore';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { useTppaStore } from '@/store/tppaStore';
import { useToastStore } from '@/store/toastStore';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import { useFramingStore } from '@/store/framingStore';
import { NATIVE_GUIDER_ID, isNativeGuiderInUse } from '@/utils/nativeGuider';
import { setProfileDevice } from '@/utils/equipmentDevices';
import { useSimpleMode } from '@/composables/useSimpleMode';
import { useEquipmentConnection } from '@/composables/useEquipmentConnection';
import { usePolling } from '@/composables/usePolling';
import { waitForState } from '@/utils/waitForState';
import Spinner from '@/components/helpers/Spinner.vue';
import DeviceNotConnected from '@/components/helpers/DeviceNotConnected.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import SimpleRigCard from '@/components/simpleMode/SimpleRigCard.vue';
import SimpleLivePanel from '@/components/simpleMode/SimpleLivePanel.vue';
import SimpleStepCard from '@/components/simpleMode/SimpleStepCard.vue';
import SimpleEndNightModal from '@/components/simpleMode/SimpleEndNightModal.vue';
import SimpleSetupChecks from '@/components/simpleMode/SimpleSetupChecks.vue';
import HfSetupAssistant from '@/components/focuser/hocus/HfSetupAssistant.vue';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { useSimpleSetupChecks } from '@/composables/useSimpleSetupChecks';
import {
  MARKABLE_STEPS,
  SKIPPABLE_STEPS,
  currentStepId,
  isInNight,
  isWarmingUp,
  marksForNight,
  nightKey,
  nightSteps,
} from '@/utils/simpleMode';
import {
  FRAME_OVERHEAD_SECONDS,
  formatClock,
  formatDuration,
  summarizeTargets,
} from '@/utils/sequenceSimple';
import {
  autofocusStartRefusal,
  isBackendRefusal,
  reportBackendRefusal,
  toastBackendError,
} from '@/utils/backendErrors';

const { t } = useI18n();
const router = useRouter();
const store = apiStore();
const settingsStore = useSettingsStore();
const cameraStore = useCameraStore();
const sequenceStore = useSequenceStore();
const sequenceV2Store = useSequenceV2Store();
const tppaStore = useTppaStore();
const toastStore = useToastStore();
const nativeGuiderStore = useNativeGuiderStore();
const equipmentStore = useEquipmentStore();
const framingStore = useFramingStore();
const hfStore = useHocusFocusStore();
const { available, enabled } = useSimpleMode();
const { allConnected, equipmentToConnect, isDeviceConnected } = useEquipmentConnection();
const { locationMissing, databaseMissing } = useSimpleSetupChecks();

// --- Night and clock -------------------------------------------------------------------
// A local clock, not a backend poll: it rolls the night over at noon and moves the
// plan's "done at" forward while the page is open.
const nowMs = ref(Date.now());
usePolling(() => (nowMs.value = Date.now()), 60000, { immediate: false });
const night = computed(() => nightKey(new Date(nowMs.value)));
const marks = computed(() => marksForNight(settingsStore.simpleMode?.steps, night.value));

function setMark(stepId, mark) {
  settingsStore.setSimpleModeStepMark(night.value, stepId, mark);
}

// A target centered from the app (sky atlas) is the "target" step done - the user would
// otherwise have to mark it by hand right after the app said "target centered".
watch(
  () => framingStore.lastSlewResult,
  (result) => {
    if (result?.ok && result.centered && isInNight(result.atMs, night.value)) {
      setMark('target', 'done');
    }
  }
);

const coolTemp = computed(() => {
  const value = Number(settingsStore.simpleMode?.coolTemp);
  return Number.isFinite(value) ? value : -10;
});

// --- Last autofocus --------------------------------------------------------------------
// Read from the backend, so an autofocus run from the focus page or by the sequence counts too.
const lastAfTimestamp = ref(null);
async function refreshLastAutofocus() {
  if (!store.focuserInfo.Connected) return;
  try {
    const response = await apiService.focuserLastAf();
    lastAfTimestamp.value = response?.Success ? (response.Response?.Timestamp ?? null) : null;
  } catch {
    lastAfTimestamp.value = null;
  }
}
watch(
  () => store.focuserAfInfo?.autofocus_running,
  (running, wasRunning) => {
    if (wasRunning && !running) refreshLastAutofocus();
  }
);
watch(() => store.focuserInfo.Connected, refreshLastAutofocus);

// --- Autofocus setup ---------------------------------------------------------------------
// Offered until the assistant was finished for this profile on this device. Only with Hocus
// Focus, which brings the assistant; same availability probe as the focus page.
const showAfSetup = ref(false);
watch(
  () => [store.isPINS, store.connectionEpoch],
  () => hfStore.checkAvailability(),
  { immediate: true }
);
const afSetupNeeded = computed(
  () =>
    hfStore.available === true &&
    store.focuserInfo.Connected &&
    !settingsStore.simpleMode?.afSetupProfiles?.includes(store.profileInfo?.Id)
);

// The last-af report carries no outcome: a failed run is written too (seen with Hocus Focus).
// The plugin's autofocus info knows how the last run ended.
const lastAfFailed = computed(() => store.focuserAfInfo?.afError === true);
const lastAfSucceededTonight = computed(
  () => isInNight(lastAfTimestamp.value, night.value) && !lastAfFailed.value
);

// --- Plan ------------------------------------------------------------------------------
const planSummary = computed(() =>
  summarizeTargets(sequenceV2Store.data, {
    overheadSeconds: FRAME_OVERHEAD_SECONDS,
    nowMs: nowMs.value,
  })
);
const plan = computed(() => {
  const summary = planSummary.value;
  return {
    targets: summary.targets.length,
    totalSeconds: summary.totalSeconds,
    remainingSeconds: summary.remainingSeconds,
    remaining: formatDuration(summary.remainingSeconds),
    doneAt: summary.remainingSeconds > 0 ? formatClock(summary.endMs) : '',
  };
});

// --- Steps -----------------------------------------------------------------------------
// --- Guiding: the guider built into PINS ------------------------------------------------
// The simple mode guides with PINS' own guider (no PHD2): one device, one guide camera slot,
// calibration on the first start. Older PINS builds do not offer it; then the step says so.
const usesNativeGuider = computed(() => isNativeGuiderInUse(store));
// null = not asked yet, true/false = whether PINS lists the built-in guider as a device.
const nativeGuiderOffered = ref(null);
async function refreshGuiderOptions() {
  try {
    const response = await apiService.guiderAction('list-devices');
    const list = Array.isArray(response?.Response) ? response.Response : null;
    nativeGuiderOffered.value = list ? list.some((d) => d?.Id === NATIVE_GUIDER_ID) : null;
  } catch {
    nativeGuiderOffered.value = null;
  }
}
const guideCameraChosen = computed(() => {
  const id = store.profileInfo?.GuideCameraSettings?.Id;
  return Boolean(id) && id !== 'No_Device';
});

// Guide cameras PINS can see, without the "no camera" entry and the imaging camera (one
// device cannot serve both slots).
const guideCameras = ref([]);
async function refreshGuideCameras() {
  try {
    const response = await apiService.guideCameraAction('list-devices');
    const list = Array.isArray(response?.Response) ? response.Response : [];
    const imagingId = store.profileInfo?.CameraSettings?.Id;
    guideCameras.value = list
      .filter((d) => d?.Id && d.Id !== 'No_Device' && d.Id !== imagingId)
      .map((d) => ({ id: d.Id, name: d.DisplayName || d.Name || d.Id }));
  } catch {
    guideCameras.value = [];
  }
}
function chooseGuideCamera(id) {
  if (!id) return;
  return withBusy('guide', async () => {
    await selectProfileDevice('guideCameraAction', id);
  });
}
watch(
  () => usesNativeGuider.value && !guideCameraChosen.value,
  (needed) => {
    if (needed) refreshGuideCameras();
  },
  { immediate: true }
);
// The guider's own state when it is the built-in one: it knows more states than ninaAPI.
const guiderState = computed(() =>
  usesNativeGuider.value && store.guiderInfo.Connected
    ? nativeGuiderStore.state
    : (store.guiderInfo.State ?? '')
);
const guiderBusy = computed(() =>
  ['Guiding', 'Calibrating', 'Looping', 'Settling', 'Reacquiring', 'Paused', 'LostLock'].includes(
    guiderState.value
  )
);
watch(
  () => [usesNativeGuider.value, store.guiderInfo.Connected],
  ([native, connected]) => {
    if (native && connected) nativeGuiderStore.refreshStatus();
  },
  { immediate: true }
);

const steps = computed(() =>
  nightSteps({
    hasEquipment: equipmentToConnect.value.length > 0,
    allConnected: allConnected.value,
    camera: {
      connected: store.cameraInfo.Connected,
      canCool: Boolean(store.cameraInfo.Connected && store.cameraInfo.CanSetTemperature),
      coolerOn: ['cooling', 'holding'].includes(cameraStore.coolingState),
      warming: cameraWarming.value,
      ramping: cameraStore.coolingState === 'cooling',
      setPoint: store.cameraInfo.TemperatureSetPoint,
      temperature: store.cameraInfo.Temperature,
      targetTemp: coolingTarget.value,
    },
    mount: {
      connected: store.mountInfo.Connected,
      parked: store.mountIsParked,
      tracking: Boolean(store.mountInfo.TrackingEnabled),
      slewing: store.mountIsSlewing,
    },
    focuser: {
      connected: store.focuserInfo.Connected,
      afRunning: Boolean(store.focuserAfInfo?.autofocus_running),
      afDoneTonight: lastAfSucceededTonight.value,
    },
    // Always offered on PINS: the built-in guider needs no extra software, only a guide camera.
    guider: { inProfile: true, state: guiderState.value },
    sequence: {
      running: sequenceStore.sequenceRunning,
      targets: plan.value.targets,
      totalSeconds: plan.value.totalSeconds,
      remainingSeconds: plan.value.remainingSeconds,
    },
    tppaRunning: tppaStore.isRunning,
    marks: marks.value,
  })
);
const currentId = computed(() => currentStepId(steps.value));
// Plate solving (polar alignment, centering) needs sharp stars: those steps remind of focus
// until it is done or deliberately skipped.
const focusSettled = computed(() =>
  ['done', 'skipped'].includes(steps.value.find((step) => step.id === 'focus')?.status)
);
const doneCount = computed(
  () => steps.value.filter((step) => ['done', 'skipped'].includes(step.status)).length
);

// What the camera was last told to cool to; the profile's temperature before the first run.
const coolingTarget = computed(() => store.cameraInfo.TargetTemp ?? cameraStore.targetTemp);
const cameraWarming = computed(
  () =>
    Boolean(store.cameraInfo.Connected) &&
    isWarmingUp({
      coolingState: cameraStore.coolingState,
      setPoint: store.cameraInfo.TemperatureSetPoint,
      temperature: store.cameraInfo.Temperature,
      targetTemp: coolingTarget.value,
    })
);

function formatTemp(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)} °C` : '–';
}

const summaries = computed(() => {
  const connected = equipmentToConnect.value.filter((d) => isDeviceConnected(d.apiName)).length;
  const lastAf = lastAfTimestamp.value ? new Date(lastAfTimestamp.value).getTime() : null;
  return {
    connect: t('components.simpleMode.steps.connect.summary', {
      connected,
      total: equipmentToConnect.value.length,
    }),
    cool: !store.cameraInfo.Connected
      ? ''
      : cameraWarming.value
        ? t('components.simpleMode.steps.cool.warmingSummary', {
            temp: formatTemp(store.cameraInfo.Temperature),
          })
        : `${formatTemp(store.cameraInfo.Temperature)} → ${formatTemp(
            cameraStore.coolingState === 'off' ? coolTemp.value : coolingTarget.value
          )}`,
    mount: !store.mountInfo.Connected
      ? ''
      : store.mountIsParked
        ? t('components.simpleMode.rig.parked')
        : store.mountInfo.TrackingEnabled
          ? t('components.simpleMode.rig.tracking')
          : t('components.simpleMode.rig.notTracking'),
    target: targetSummary(),
    focus:
      lastAf && isInNight(lastAfTimestamp.value, night.value)
        ? t(
            lastAfFailed.value
              ? 'components.simpleMode.steps.focus.lastFailed'
              : 'components.simpleMode.steps.focus.lastRun',
            { time: formatClock(lastAf) }
          )
        : '',
    guide: store.guiderInfo.Connected
      ? t(`components.simpleMode.guiderState.${guiderStateKey(guiderState.value)}`)
      : '',
    capture: captureSummary(),
  };
});

function targetSummary() {
  const last = framingStore.lastSlewResult;
  if (last?.ok && last.centered && last.name && isInNight(last.atMs, night.value)) {
    return t('components.simpleMode.steps.target.centeredSummary', { name: last.name });
  }
  if (!store.mountInfo.Connected) return '';
  return `RA ${store.mountInfo.RightAscensionString ?? '–'} · Dec ${store.mountInfo.DeclinationString ?? '–'}`;
}

function captureSummary() {
  const { targets, totalSeconds, doneAt } = plan.value;
  if (targets === 0) return '';
  if (totalSeconds === 0) {
    return t('components.simpleMode.steps.capture.summaryEmpty', { targets }, targets);
  }
  if (doneAt) {
    return t('components.simpleMode.steps.capture.summary', { targets, time: doneAt }, targets);
  }
  return t('components.simpleMode.steps.capture.summaryDone', { targets }, targets);
}

function guiderStateKey(state) {
  return ['Guiding', 'Calibrating', 'Looping', 'LostLock', 'Paused', 'Reacquiring'].includes(state)
    ? state
    : 'Idle';
}

// --- Actions ---------------------------------------------------------------------------
// One busy flag per step, so a slow backend cannot be triggered twice by an impatient tap.
const busy = reactive({ cool: false, mount: false, focus: false, guide: false, capture: false });
const showEndNight = ref(false);

async function withBusy(key, action) {
  if (busy[key]) return;
  busy[key] = true;
  try {
    await action();
  } catch (error) {
    console.error(`[Simple mode] ${key} failed`, error);
  } finally {
    busy[key] = false;
  }
}

function startCooling() {
  return withBusy('cool', async () => {
    const response = await cameraStore.startCooling(coolTemp.value, 10);
    if (isBackendRefusal(response)) {
      toastBackendError(response, 'components.simpleMode.steps.cool.failed');
    }
  });
}

const UNPARK_TIMEOUT_MS = 60000;
// Two device polls plus slack.
const TRACKING_TIMEOUT_MS = 8000;

function makeMountReady() {
  return withBusy('mount', async () => {
    if (store.mountInfo.AtPark) {
      const response = await apiService.mountAction('unpark');
      if (reportBackendRefusal(response, 'components.backendErrors.mountUnpark')) return;
      // Unpark runs in the background; a tracking command sent meanwhile is lost (seen with
      // the Alpaca simulator, which ends the unpark with tracking stopped).
      if (!(await waitForState(() => !store.mountInfo.AtPark, UNPARK_TIMEOUT_MS))) return;
    }
    if (!store.mountInfo.TrackingEnabled) {
      // 0 = sidereal tracking
      const response = await apiService.setTrackingMode(0);
      // ninaAPI answers "Tracking mode changed" with Success: false although tracking starts
      // (every time with the Alpaca simulator), so the flag alone would report a failure next
      // to a step that turns "Done". The mount's own state decides; the answer only supplies
      // the reason when tracking really stays off.
      if (await waitForState(() => store.mountInfo.TrackingEnabled, TRACKING_TIMEOUT_MS)) return;
      toastBackendError(
        isBackendRefusal(response) ? response : null,
        'components.simpleMode.steps.mount.trackingFailed'
      );
    }
  });
}

function openPolarAlignment() {
  store.mount.currentTab = 'showTppa';
  router.push('/mount');
}

function setAutoCenter(on) {
  settingsStore.mount.useCenter = Boolean(on);
  settingsStore.saveMountSettings();
}

function openAtlas() {
  store.showSkyAtlas = true;
}

function startAutofocus() {
  return withBusy('focus', async () => {
    const response = await apiService.focuserAfAction('start');
    const refusal = autofocusStartRefusal(response);
    if (refusal !== null) {
      toastBackendError({ Error: refusal }, 'components.backendErrors.autofocusStart');
      return;
    }
    store.afTimestampLastStart = Date.now();
    store.afCurveData = [];
  });
}

// Writes the device into the profile and lets NINA re-read its device list. "Connect
// everything" connects without ?to=, i.e. with the device NINA's chooser holds; without the
// rescan the chooser keeps the previous pick (seen: OfflineDevice instead of the built-in
// guider, and the old "No camera" written back over the new guide camera).
async function selectProfileDevice(apiAction, deviceId) {
  await setProfileDevice(apiAction, deviceId);
  await apiService[apiAction]('rescan');
  equipmentStore.triggerReload();
}

async function switchToNativeGuider() {
  return withBusy('guide', async () => {
    // The profile must not change under a connected guider.
    if (store.guiderInfo.Connected) await apiService.guiderAction('disconnect');
    await selectProfileDevice('guiderAction', NATIVE_GUIDER_ID);
  });
}

// Like the guider page: without a calibration the start calibrates first (no slew - it would
// move the mount off the target), afterwards it guides straight away.
function startGuiding() {
  return withBusy('guide', () =>
    nativeGuiderStore.runAction(
      'start-guiding',
      { calibrate: !nativeGuiderStore.isCalibrated },
      { title: t('components.backendErrors.guidingStart') }
    )
  );
}

function stopGuiding() {
  return withBusy('guide', () => nativeGuiderStore.runAction('stop'));
}

function startCapture() {
  return withBusy('capture', async () => {
    const confirmed = await toastStore.showConfirmation(
      t('components.simpleMode.steps.capture.confirmStartTitle'),
      t(
        'components.simpleMode.steps.capture.confirmStartMessage',
        { targets: plan.value.targets, remaining: plan.value.remaining },
        plan.value.targets
      ),
      t('components.simpleMode.steps.capture.start'),
      t('common.cancel')
    );
    if (!confirmed) return;
    sequenceStore.setSequenceRunning(true);
    const response = await apiService.sequenceAction('start');
    if (reportBackendRefusal(response, 'components.backendErrors.sequenceStart')) {
      sequenceStore.setSequenceRunning(false);
      return;
    }
    await sequenceStore.getSequenceInfo();
  });
}

function stopCapture() {
  return withBusy('capture', async () => {
    const confirmed = await toastStore.showConfirmation(
      t('components.simpleMode.steps.capture.confirmStopTitle'),
      t('components.simpleMode.steps.capture.confirmStopMessage'),
      t('components.simpleMode.steps.capture.stop'),
      t('common.cancel')
    );
    if (!confirmed) return;
    const response = await apiService.sequenceAction('stop');
    if (response?.Success) {
      await sequenceStore.getSequenceInfo();
      sequenceStore.setSequenceRunning(false);
    }
  });
}

function switchMode(on) {
  settingsStore.setSimpleModeEnabled(on);
  if (!on) router.push('/equipment');
}

const moreLinks = [
  { to: '/equipment', labelKey: 'components.simpleMode.more.equipment' },
  { to: '/mount', labelKey: 'components.simpleMode.more.mount' },
  { to: '/autofocus', labelKey: 'components.simpleMode.more.focus' },
  { to: '/guider', labelKey: 'components.simpleMode.more.guider' },
  { to: '/pins', labelKey: 'components.simpleMode.more.system' },
  { to: '/settings', labelKey: 'components.simpleMode.more.settings' },
];

// --- Lifecycle -------------------------------------------------------------------------
// Same ownership as the sequence editor: this page polls the tree while it is open and
// restarts the poller when the backend comes back (a connection loss stops it).
watch(
  () => store.isBackendReachable,
  (reachable) => {
    if (reachable && !sequenceV2Store.isFetching()) sequenceV2Store.startPolling();
  }
);

onMounted(() => {
  sequenceV2Store.startPolling();
  refreshGuiderOptions();
  refreshLastAutofocus();
});

onUnmounted(() => sequenceV2Store.stopPolling());
</script>
