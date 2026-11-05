<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { isAppBackgrounded } from '@/utils/appLifecycle';
import { luckyCaptureRequest } from '../services/luckycapture';
import { useLuckyCaptureStore } from '../store/luckycaptureStore';
const store = useLuckyCaptureStore();
const props = defineProps({ compact: Boolean });
const emit = defineEmits(['changed', 'select-roi', 'busy', 'status']);
const { t, te } = useI18n();
const errorLabel = (code) => {
  const key = `luckycaptureFocus.error_${String(code).split(':')[0]}`;
  return te(key) ? t(key) : code;
};
const text = (key, values) => t(`luckycaptureFocus.${key}`, values || {});
const supported = computed(() => store.capabilities?.focusApiVersion >= 2);
const status = ref(null);
const metrics = ref(null);
const pending = ref(false);
const error = ref('');
const source = ref('real');
const simulation = reactive({
  target: 'moon',
  source: 'procedural',
  actuator: 'virtual',
  seed: 42,
  fps: 20,
  seeing: 0.2,
  noise: 0.002,
  drift: 0,
  transparency: 1,
  defocusScale: 0.025,
  idealFocusPosition: 25000,
  width: 512,
  height: 512,
  bitDepth: 16,
  pixelFormat: 'Mono',
  targetScale: 0.65,
  focusCoupled: true,
  loop: true,
  playbackSpeed: 1,
  fixtureId: null,
  virtualFault: 'none',
});
const config = reactive({
  enabled: false,
  profile: 'moon',
  metric: 'auto',
  roi: null,
  sampleFps: 20,
  maxPixels: 65536,
  framesPerPoint: 50,
  points: 7,
  step: 25,
  maxDisplacement: 150,
  flushMilliseconds: 750,
  pointTimeoutSeconds: 30,
  bestFraction: 0.25,
  maximumSpread: 0.5,
  minimumPeakProminence: 0.03,
});
const fixtures = ref([]);
const replayPaused = ref(false);
async function toggleReplay() {
  await call('simulation/replay/control', { paused: !replayPaused.value });
  replayPaused.value = !replayPaused.value;
}
const roiDraft = reactive({ x: 0, y: 0, width: 128, height: 128 });
const step = ref(25);
const absolute = ref(25000);
const mode = ref('auto');
const manualCard = ref(null);
watch(mode, async (value) => {
  if (value === 'manual' && props.compact) {
    await nextTick();
    manualCard.value?.scrollIntoView({ block: 'start' });
  }
});
const motionDialog = ref(null);
const requestedAction = ref(null);
const approvedBounds = reactive({ minimum: 0, maximum: 0 });
const solarAck = ref(false);
let lease = '';
let timer;
let ticks = 0;
let closed = false;
let polling = false;
const captureActive = computed(() => store.active);
const recording = computed(() =>
  ['RECORDING', 'STARTING', 'STOPPING', 'FINALIZING'].includes(store.status.state)
);
const physical = computed(() => status.value?.device?.physical);
const moving = computed(
  () =>
    pending.value ||
    status.value?.busy ||
    status.value?.device?.moving ||
    status.value?.device?.settling
);
const canAdjust = computed(
  () => supported.value && status.value?.device?.connected && !moving.value && !recording.value
);
const canAutofocus = computed(
  () => canAdjust.value && store.camera?.connected && !status.value?.rawReplay
);
const sweepDistance = computed(() => config.step * Math.floor(config.points / 2));
const jobActive = computed(() => Boolean(status.value?.busy));
const progress = computed(() => Math.min(config.points, points.value.length));
const solar = computed(() => config.profile.startsWith('solar'));
const points = computed(() => status.value?.job?.points || []);
const latest = computed(() => metrics.value?.latest);
const plot = (values) => {
  if (values.length < 2) return '';
  const low = Math.min(...values.map((p) => p[1]));
  const high = Math.max(...values.map((p) => p[1]));
  const start = Math.min(...values.map((p) => p[0]));
  const end = Math.max(...values.map((p) => p[0]));
  return values
    .map(
      ([x, y]) =>
        `${8 + ((x - start) / Math.max(1, end - start)) * 304},${92 - ((y - low) / Math.max(1e-9, high - low)) * 84}`
    )
    .join(' ');
};
const curve = computed(() => plot(points.value.map((p) => [p.position, p.score])));
const trend = computed(() =>
  plot((metrics.value?.history || []).slice(-60).map((p, i) => [i, p.score]))
);
async function call(path, data, method = 'POST') {
  return await luckyCaptureRequest(path, data, method);
}
async function perform(action) {
  if (pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    await action();
    await refresh();
  } catch (failure) {
    error.value = failure?.response?.data?.code
      ? errorLabel(failure.response.data.code)
      : failure.message;
  } finally {
    pending.value = false;
  }
}
async function refresh() {
  if (!supported.value || closed || polling) return;
  // Without a lease this is plain status polling. With one it also carries the heartbeat that
  // keeps armed focus motion alive, so it has to keep running in the background.
  if (isAppBackgrounded.value && !lease) return;
  polling = true;
  try {
    if (lease && ticks++ % 8 === 0) await call('focus/heartbeat', { leaseToken: lease });
    const [focus, measured] = await Promise.all([
      call('focus/status', undefined, 'GET'),
      call('focus/metrics', undefined, 'GET'),
    ]);
    if (closed) return;
    status.value = focus;
    if (!pending.value) source.value = focus.sourceKind;
    metrics.value = measured;
    emit('busy', Boolean(focus.busy));
    emit('status', focus);
    if (!focus.armed) lease = '';
  } catch (failure) {
    error.value = failure?.response?.data?.code
      ? errorLabel(failure.response.data.code)
      : failure.message;
  } finally {
    polling = false;
  }
}
async function load() {
  if (!supported.value) return;
  const [focusSettings, simSettings, media] = await Promise.all([
    call('focus/settings', undefined, 'GET'),
    call('simulation/settings', undefined, 'GET'),
    call('simulation/sources', undefined, 'GET'),
  ]);
  Object.assign(config, focusSettings);
  Object.assign(simulation, simSettings);
  fixtures.value = media.fixtures;
  await refresh();
  source.value = status.value?.sourceKind || 'real';
  if (status.value?.device?.connected) {
    absolute.value = status.value.device.position;
  }
}
async function selectSource() {
  await call('simulation/select', { sourceKind: source.value });
  lease = '';
  solarAck.value = false;
  await load();
  emit('changed');
}
async function applySimulation() {
  await call('simulation/settings', { ...simulation }, 'PUT');
  lease = '';
  await load();
  emit('changed');
}
async function applyFocus() {
  await call('focus/settings', { ...config }, 'PUT');
}
async function setRoi(roi) {
  await perform(async () => {
    config.roi = roi;
    Object.assign(roiDraft, roi);
    await applyFocus();
  });
}
async function startFeedback() {
  config.enabled = true;
  await applyFocus();
  if (store.status.state !== 'PREVIEWING') await store.command('preview/start', { previewFps: 8 });
}
async function executeAction(action, approved = false) {
  if (action === 'auto') await startFeedback();
  if (physical.value && approved) {
    const armed = await call('focus/arm', {
      ...approvedBounds,
      acknowledgeRealMotion: true,
      solarAcknowledged: solarAck.value,
    });
    lease = armed.leaseToken;
  }
  if (action === 'auto') await call('focus/autofocus/start', { leaseToken: lease });
  else if (action === 'absolute')
    await call('focus/move-absolute', { position: absolute.value, leaseToken: lease });
  else
    await call('focus/move-relative', {
      steps: action === 'in' ? -step.value : step.value,
      leaseToken: lease,
    });
}
function requestAction(action) {
  if (!canAdjust.value) return;
  if (
    physical.value &&
    (!status.value?.armed || (action === 'auto' && store.status.state !== 'PREVIEWING'))
  ) {
    const position = status.value.device.position;
    approvedBounds.minimum = Math.max(0, position - config.maxDisplacement);
    approvedBounds.maximum = Math.min(
      status.value.device.maximum ?? Number.MAX_SAFE_INTEGER,
      position + config.maxDisplacement
    );
    requestedAction.value = action;
    solarAck.value = false;
    motionDialog.value.showModal();
  } else perform(() => executeAction(action));
}
async function confirmMotion() {
  const action = requestedAction.value;
  motionDialog.value.close();
  requestedAction.value = null;
  await perform(() => executeAction(action, true));
}
async function stopMotion() {
  // Stop remains available while another UI request is pending.
  try {
    await call('focus/stop', {});
    lease = '';
    await refresh();
  } catch (failure) {
    error.value = failure.message;
  }
}
defineExpose({ setRoi });
watch(
  supported,
  (ready) => {
    if (ready) perform(load);
  },
  { immediate: true }
);
onMounted(() => {
  timer = setInterval(refresh, 500);
});
onUnmounted(() => {
  closed = true;
  clearInterval(timer);
  emit('busy', false);
  if (supported.value) call('focus/stop', {}).catch(() => {});
  lease = '';
});
</script>

<template>
  <section class="focus-panel" :aria-label="text('title')">
    <p v-if="!supported" role="status">{{ text('unsupported') }}</p>
    <div v-else class="focus-body">
      <header class="focus-heading">
        <div>
          <h2>{{ text('title') }}</h2>
          <p>{{ status?.device?.name || text('disconnected') }}</p>
        </div>
        <div class="position-readout">
          <span>{{ text('position') }}</span
          ><strong>{{ status?.device?.connected ? status.device.position : '\u2014' }}</strong>
        </div>
      </header>
      <p v-if="source === 'simulated'" class="simulation-note">
        {{ text('simulation') }} · {{ text('syntheticNotice') }}
      </p>
      <p v-if="error" role="alert" class="focus-error">{{ error }}</p>
      <p v-if="!status?.device?.connected" class="help" role="status">{{ text('connectHelp') }}</p>
      <div class="focus-modes" role="group" :aria-label="text('focusMode')">
        <button :aria-pressed="mode === 'auto'" @click="mode = 'auto'">
          {{ text('autoMode') }}
        </button>
        <button :aria-pressed="mode === 'manual'" @click="mode = 'manual'">
          {{ text('manualMode') }}
        </button>
      </div>
      <label class="target-picker"
        >{{ text('focusTarget') }}
        <select
          v-model="config.profile"
          :disabled="moving || recording"
          @change="perform(applyFocus)"
        >
          <option value="moon">{{ text('moon') }}</option>
          <option value="planet">{{ text('planet') }}</option>
          <option value="saturn">{{ text('saturn') }}</option>
          <option value="solar-white">{{ text('sunWhite') }}</option>
          <option value="solar-ha">{{ text('sunHa') }}</option>
        </select>
      </label>
      <div v-if="solar" class="solar-warning" role="note">
        <strong>{{ text('solarTitle') }}</strong>
        <p>{{ text('solarWarning') }}</p>
      </div>
      <section v-if="mode === 'auto'" class="focus-card" :aria-label="text('autoMode')">
        <h3>{{ text('autoHeading') }}</h3>
        <p class="help">{{ text('autoHelp') }}</p>
        <button
          v-if="!jobActive"
          class="autofocus-primary"
          :disabled="!canAutofocus"
          @click="requestAction('auto')"
        >
          {{ pending ? text('preparing') : text('findFocus') }}
        </button>
        <p v-if="!store.camera?.connected" class="help">{{ text('cameraHelp') }}</p>
        <p v-else-if="recording" class="help">{{ text('recordingHelp') }}</p>
        <p v-else-if="status?.rawReplay" class="help">{{ text('rawHelp') }}</p>
        <p v-else-if="!jobActive" class="help search-summary">
          {{ text('searchDistance', { steps: sweepDistance }) }}
        </p>
      </section>
      <section
        v-else
        ref="manualCard"
        class="focus-card manual-card"
        :aria-label="text('manualMode')"
      >
        <h3>{{ text('manualHeading') }}</h3>
        <p class="help">{{ text('manualHelp') }}</p>
        <div v-if="compact && store.previewUrl" class="manual-preview">
          <img :src="store.previewUrl" :alt="text('focusPreview')" />
        </div>
        <div class="step-presets" role="group" :aria-label="text('step')">
          <button
            v-for="preset in [
              { key: 'fine', value: 5 },
              { key: 'normal', value: 25 },
              { key: 'coarse', value: 100 },
            ]"
            :key="preset.key"
            :aria-pressed="step === preset.value"
            :disabled="moving"
            @click="step = preset.value"
          >
            {{ text(preset.key) }}
          </button>
        </div>
        <div class="focus-grid manual-buttons">
          <button :disabled="!canAdjust" @click="requestAction('in')">
            <span aria-hidden="true">-</span> {{ text('inward') }}
          </button>
          <button :disabled="!canAdjust" @click="requestAction('out')">
            {{ text('outward') }} <span aria-hidden="true">+</span>
          </button>
        </div>
        <p class="help">{{ text('stepAmount', { steps: step }) }}</p>
        <button
          v-if="store.status.state !== 'PREVIEWING' || !config.enabled"
          :disabled="moving || recording || !store.camera?.connected"
          @click="perform(startFeedback)"
        >
          {{ text('startFeedback') }}
        </button>
        <p v-if="physical && !status?.armed" class="help">{{ text('approvalHelp') }}</p>
        <details>
          <summary>{{ text('exactPosition') }}</summary>
          <div class="focus-grid">
            <label
              >{{ text('step')
              }}<input
                v-model.number="step"
                type="number"
                min="1"
                max="1000"
                :disabled="moving" /></label
            ><label
              >{{ text('absolute')
              }}<input v-model.number="absolute" type="number" min="0" :disabled="moving"
            /></label>
          </div>
          <button :disabled="!canAdjust" @click="requestAction('absolute')">
            {{ text('move') }}
          </button>
        </details>
      </section>
      <div v-if="jobActive" class="focus-progress" role="status" aria-live="polite">
        <strong>{{ text(`state_${status.job.state}`) }}</strong>
        <progress
          v-if="mode === 'auto' && points.length"
          :value="progress"
          :max="config.points"
          :aria-label="text('progressLabel')"
        />
        <span v-if="points.length">{{
          text('progressCount', { current: progress, total: config.points })
        }}</span>
        <button class="focus-stop" @click="stopMotion">{{ text('stopNow') }}</button>
      </div>
      <button v-else-if="status?.armed" class="focus-stop" @click="stopMotion">
        {{ text('endSession') }}
      </button>
      <div
        v-if="status?.job?.state === 'COMPLETE' && status?.job?.bestPosition != null"
        class="focus-success"
        role="status"
      >
        <strong>{{ text('bestFound') }}</strong
        ><span>{{ text('position') }} {{ status.job.bestPosition }}</span>
        <p class="help">{{ text('bestHelp') }}</p>
      </div>
      <p v-if="status?.job?.state === 'ERROR'" class="focus-error" role="alert">
        {{ errorLabel(status.job.error) }}
      </p>
      <p v-if="status?.job?.state === 'CANCELLED'" class="help" role="status">
        {{ text('error_CANCELLED') }}
      </p>
      <div v-if="latest" class="live-score" role="status">
        <div>
          <span>{{ text('sharpness') }}</span
          ><strong>{{ latest.valid ? latest.score.toFixed(2) : '\u2014' }}</strong>
        </div>
        <p class="help">
          {{
            latest.valid
              ? text('sharpnessHelp')
              : latest.flags.map((flag) => text(`flag_${flag}`)).join(', ')
          }}
        </p>
      </div>
      <div class="focus-actions roi-actions">
        <button :disabled="!store.previewUrl || moving" @click="emit('select-roi')">
          {{ text('chooseArea') }}
        </button>
        <button
          v-if="config.roi"
          :disabled="moving"
          @click="
            perform(async () => {
              config.roi = null;
              await applyFocus();
            })
          "
        >
          {{ text('resetRoi') }}
        </button>
      </div>
      <details class="focus-details">
        <summary>{{ text('focusDetails') }}</summary>
        <svg
          v-if="curve"
          class="focus-plot"
          viewBox="0 0 320 100"
          role="img"
          :aria-label="text('curve')"
        >
          <polyline :points="curve" />
        </svg>
        <svg
          v-if="trend"
          class="focus-plot"
          viewBox="0 0 320 100"
          role="img"
          :aria-label="text('trend')"
        >
          <polyline :points="trend" />
        </svg>
        <p class="help">{{ text('scoreHelp') }}</p>
        <ul v-if="points.length" class="focus-results">
          <li v-for="point in points" :key="point.position">
            {{ point.position }}: {{ point.score.toFixed(3) }} · {{ point.framesAccepted }}/{{
              point.framesRequested
            }}
            · {{ text('spread') }} {{ point.seeingSpread.toFixed(2) }}
          </li>
        </ul>
      </details>
      <details class="focus-details">
        <summary>{{ text('advancedFocus') }}</summary>
        <fieldset :disabled="moving || recording">
          <details>
            <summary>{{ text('roi') }}</summary>
            <div class="focus-grid">
              <label v-for="key in ['x', 'y', 'width', 'height']" :key="key"
                >{{ text(key)
                }}<input
                  v-model.number="roiDraft[key]"
                  type="number"
                  :min="key === 'width' || key === 'height' ? 16 : 0"
                  step="2"
              /></label>
            </div>
            <button @click="setRoi({ ...roiDraft })">{{ text('applyRoi') }}</button>
          </details>
          <details>
            <summary>{{ text('scanSettings') }}</summary>
            <div class="focus-grid">
              <label
                >{{ text('metric')
                }}<select v-model="config.metric">
                  <option value="auto">{{ text('automatic') }}</option>
                  <option value="tenengrad">Tenengrad</option>
                  <option value="hsm">HSM</option>
                </select></label
              >
              <label
                >{{ text('samples')
                }}<input v-model.number="config.framesPerPoint" type="number" min="5" max="500"
              /></label>
              <label
                >{{ text('points')
                }}<input v-model.number="config.points" type="number" min="5" max="9" step="2"
              /></label>
              <label
                >{{ text('scanStep')
                }}<input v-model.number="config.step" type="number" min="1" max="1000"
              /></label>
              <label
                >{{ text('span')
                }}<input v-model.number="config.maxDisplacement" type="number" min="2" max="5000"
              /></label>
              <label
                >{{ text('flush')
                }}<input
                  v-model.number="config.flushMilliseconds"
                  type="number"
                  min="100"
                  max="10000"
                  step="50"
              /></label>
              <label
                >{{ text('sampleFps')
                }}<input v-model.number="config.sampleFps" type="number" min="1" max="30"
              /></label>
              <label
                >{{ text('timeout')
                }}<input
                  v-model.number="config.pointTimeoutSeconds"
                  type="number"
                  min="2"
                  max="120"
              /></label>
              <label
                >{{ text('bestFraction')
                }}<input
                  v-model.number="config.bestFraction"
                  type="number"
                  min="0.1"
                  max="1"
                  step="0.05"
              /></label>
              <label
                >{{ text('spread')
                }}<input
                  v-model.number="config.maximumSpread"
                  type="number"
                  min="0.01"
                  max="2"
                  step="0.05"
              /></label>
            </div>
            <button @click="perform(applyFocus)">{{ text('applyFocus') }}</button>
          </details>
        </fieldset>
      </details>
      <details class="simulation-tools">
        <summary>{{ text('simulationTools') }}</summary>
        <p class="help">{{ text('simulationHelp') }}</p>
        <label
          >{{ text('source')
          }}<select
            v-model="source"
            :disabled="captureActive || moving"
            @change="perform(selectSource)"
          >
            <option value="real">{{ text('realCamera') }}</option>
            <option value="simulated">{{ text('simulation') }}</option>
          </select></label
        >
        <details v-if="source === 'simulated'" :open="!captureActive">
          <summary>{{ text('simulationSettings') }}</summary>
          <fieldset :disabled="captureActive || moving">
            <legend>{{ text('simulationSettings') }}</legend>
            <div class="focus-grid">
              <label
                >{{ text('target')
                }}<select v-model="simulation.target">
                  <option value="moon">{{ text('moon') }}</option>
                  <option value="sun-white">{{ text('sunWhite') }}</option>
                  <option value="sun-ha">{{ text('sunHa') }}</option>
                  <option value="jupiter">Jupiter</option>
                  <option value="saturn">{{ text('saturn') }}</option>
                </select></label
              >
              <label
                >{{ text('actuator')
                }}<select v-model="simulation.actuator">
                  <option value="virtual">{{ text('virtualFocuser') }}</option>
                  <option value="physical" :disabled="!status?.physicalFocuserConnected">
                    {{ text('pinsFocuser') }}
                  </option>
                </select></label
              >
              <label
                >{{ text('media')
                }}<select v-model="simulation.source">
                  <option value="procedural">{{ text('procedural') }}</option>
                  <option value="ser">SER</option>
                  <option value="image">PNG / TIFF</option>
                </select></label
              >
              <label v-if="simulation.source !== 'procedural'"
                >{{ text('fixture')
                }}<select v-model="simulation.fixtureId">
                  <option :value="null">{{ text('chooseFixture') }}</option>
                  <option v-for="file in fixtures" :key="file.id" :value="file.id">
                    {{ file.name }}
                  </option>
                </select></label
              >
              <label
                >{{ text('ideal')
                }}<input v-model.number="simulation.idealFocusPosition" type="number" min="0"
              /></label>
              <label
                >{{ text('fps')
                }}<input v-model.number="simulation.fps" type="number" min="1" max="60"
              /></label>
              <label
                >{{ text('seed') }}<input v-model.number="simulation.seed" type="number"
              /></label>
              <label
                >{{ text('seeing')
                }}<input
                  v-model.number="simulation.seeing"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
              /></label>
              <label
                >{{ text('defocus')
                }}<input
                  v-model.number="simulation.defocusScale"
                  type="number"
                  min="0"
                  max="0.2"
                  step="0.005"
              /></label>
            </div>
            <details>
              <summary>{{ text('advancedSimulation') }}</summary>
              <label v-if="simulation.actuator === 'virtual'"
                >{{ text('virtualFault') }}
                <select v-model="simulation.virtualFault">
                  <option value="none">{{ text('faultNone') }}</option>
                  <option value="disconnect">{{ text('faultDisconnect') }}</option>
                  <option value="stall">{{ text('faultStall') }}</option>
                  <option value="readback">{{ text('faultReadback') }}</option>
                </select>
              </label>

              <div class="focus-grid">
                <label
                  >{{ text('width')
                  }}<input v-model.number="simulation.width" type="number" min="64" max="1024"
                /></label>
                <label
                  >{{ text('height')
                  }}<input v-model.number="simulation.height" type="number" min="64" max="1024"
                /></label>
                <label
                  >{{ text('depth')
                  }}<select v-model.number="simulation.bitDepth">
                    <option :value="8">8</option>
                    <option :value="16">16</option>
                  </select></label
                >
                <label
                  >{{ text('format')
                  }}<select v-model="simulation.pixelFormat">
                    <option
                      v-for="format in ['Mono', 'RGGB', 'GRBG', 'GBRG', 'BGGR', 'RGB', 'BGR']"
                      :key="format"
                    >
                      {{ format }}
                    </option>
                  </select></label
                >
                <label
                  >{{ text('noise')
                  }}<input
                    v-model.number="simulation.noise"
                    type="number"
                    min="0"
                    max="0.1"
                    step="0.001"
                /></label>
                <label
                  >{{ text('transparency')
                  }}<input
                    v-model.number="simulation.transparency"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                /></label>
                <label
                  >{{ text('drift')
                  }}<input
                    v-model.number="simulation.drift"
                    type="number"
                    min="-10"
                    max="10"
                    step="0.1"
                /></label>
                <label
                  >{{ text('scale')
                  }}<input
                    v-model.number="simulation.targetScale"
                    type="number"
                    min="0.2"
                    max="0.9"
                    step="0.05"
                /></label>
                <label><input v-model="simulation.loop" type="checkbox" />{{ text('loop') }}</label>
                <label
                  ><input v-model="simulation.focusCoupled" type="checkbox" />{{
                    text('coupled')
                  }}</label
                >
                <label
                  >{{ text('speed')
                  }}<input
                    v-model.number="simulation.playbackSpeed"
                    type="number"
                    min="0.1"
                    max="4"
                    step="0.1"
                /></label>
              </div>
            </details>
            <p class="help">{{ text('mediaAdvice') }}</p>
            <button @click="perform(applySimulation)">{{ text('applySimulation') }}</button>
          </fieldset>
        </details>

        <button
          v-if="source === 'simulated' && simulation.source !== 'procedural' && captureActive"
          :disabled="moving || recording"
          @click="perform(toggleReplay)"
        >
          {{ text(replayPaused ? 'resumeReplay' : 'pauseReplay') }}
        </button>
      </details>
      <dialog
        ref="motionDialog"
        class="motion-dialog"
        :aria-labelledby="'focus-motion-title'"
        @cancel="requestedAction = null"
      >
        <h2 id="focus-motion-title">{{ text('allowMotionTitle') }}</h2>
        <p>{{ text('allowMotionHelp') }}</p>
        <p class="approved-travel">
          <strong>{{ approvedBounds.minimum }} - {{ approvedBounds.maximum }}</strong
          ><span>{{ text('allowedPositions') }}</span>
        </p>
        <p v-if="source === 'simulated'" class="simulation-note">{{ text('physicalWarning') }}</p>
        <label v-if="solar && source === 'real'"
          ><input v-model="solarAck" type="checkbox" />{{ text('solarAck') }}</label
        >
        <div class="focus-actions">
          <button
            @click="
              motionDialog.close();
              requestedAction = null;
            "
          >
            {{ text('cancel') }}</button
          ><button
            class="autofocus-primary"
            :disabled="solar && source === 'real' && !solarAck"
            @click="confirmMotion"
          >
            {{ requestedAction === 'auto' ? text('allowAndFocus') : text('allowAndMove') }}
          </button>
        </div>
      </dialog>
    </div>
  </section>
</template>

<style scoped>
.focus-panel {
  border: 1px solid #526078;
  border-radius: 14px;
  padding: 12px;
  margin: 0;
  color: inherit;
  background: var(--background, #0d1421);
}
summary {
  cursor: pointer;
  padding: 8px 0;
  font-weight: 600;
  min-height: 44px;
}
.focus-body {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.focus-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
fieldset {
  min-width: 0;
  border: 1px solid #4a5870;
  border-radius: 10px;
  padding: 12px;
  display: grid;
  gap: 12px;
}
legend {
  font-weight: 600;
  padding: 0 5px;
}
label {
  display: grid;
  gap: 5px;
  font-size: 14px;
  min-width: 0;
}
label:has(input[type='checkbox']) {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
input:not([type='checkbox']),
select,
button {
  width: 100%;
  min-height: 48px;
  box-sizing: border-box;
  border-radius: 9px;
  border: 1px solid #64748b;
  background: #141d2c;
  color: #e8edf7;
  font-size: 16px;
  padding: 8px;
}
input[type='checkbox'] {
  min-width: 22px;
  min-height: 22px;
}
button {
  cursor: pointer;
}
button:disabled,
fieldset:disabled {
  opacity: 0.55;
}
.focus-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.focus-actions button {
  flex: 1 1 120px;
}
.help,
.focus-results {
  font-size: 13px;
  color: #bac7db;
}
.metric strong {
  font-size: 22px;
  font-variant-numeric: tabular-nums;
}
.focus-error,
.solar-warning,
.physical-note {
  padding: 10px;
  border: 1px solid #e3a342;
  border-radius: 8px;
  color: #ffdc9d;
}
.simulation-note {
  padding: 10px;
  background: #213456;
  border-radius: 8px;
  font-weight: 600;
}
.focus-stop {
  border-color: #ffbd65;
}
.focus-plot {
  width: 100%;
  height: 90px;
  border: 1px solid #42506a;
  background: #080d16;
  border-radius: 8px;
}
.focus-plot polyline {
  fill: none;
  stroke: #6ee7b7;
  stroke-width: 2;
}
.focus-results {
  display: flex;
  gap: 8px 20px;
  flex-wrap: wrap;
}
@media (max-width: 380px) {
  .focus-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.focus-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.focus-heading h2 {
  font-size: 20px;
  font-weight: 650;
  margin: 0 0 4px;
}
.focus-heading p {
  font-size: 13px;
  color: #b8c5d7;
  margin: 0;
}
.position-readout {
  display: grid;
  text-align: right;
  font-size: 12px;
  color: #b8c5d7;
  flex-shrink: 0;
}
.position-readout strong {
  font-size: 22px;
  color: #f1f5f9;
  font-variant-numeric: tabular-nums;
}
.focus-modes,
.step-presets {
  display: flex;
  padding: 4px;
  gap: 4px;
  border-radius: 12px;
  background: #080f1b;
}
.focus-modes button,
.step-presets button {
  flex: 1;
  min-width: 0;
  border-color: transparent;
  background: transparent;
}
.focus-modes button[aria-pressed='true'],
.step-presets button[aria-pressed='true'] {
  background: #15374a;
  border-color: #22d3ee;
  color: #a5f3fc;
}
.focus-card {
  display: grid;
  gap: 12px;
  border: 1px solid #35445c;
  padding: 16px;
  border-radius: 12px;
}
.focus-card h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
.help {
  line-height: 1.5;
  margin: 0;
}
.autofocus-primary {
  background: #087c96;
  color: white;
  border-color: #22d3ee;
  font-weight: 650;
  min-height: 54px;
}
.manual-buttons button {
  min-height: 58px;
  font-weight: 600;
}
.manual-buttons span {
  font-size: 24px;
  padding: 0 4px;
}
.manual-preview {
  display: flex;
  justify-content: center;
  border-radius: 8px;
  background: #070c13;
  overflow: hidden;
}
.manual-preview img {
  display: block;
  width: auto;
  max-width: 100%;
  height: 160px;
  object-fit: contain;
}
.manual-card {
  scroll-margin-top: calc(130px + env(safe-area-inset-top, 0px));
}
.focus-progress,
.focus-success {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid #3a6074;
  border-radius: 12px;
  background: #102735;
}
.focus-progress progress {
  width: 100%;
  accent-color: #22d3ee;
}
.focus-success {
  border-color: #348966;
  background: #102b24;
}
.live-score {
  padding: 12px;
  border-radius: 10px;
  background: #111d30;
}
.live-score > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.live-score strong {
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
.focus-details,
.simulation-tools {
  border-top: 1px solid #2d3b50;
  padding-top: 4px;
}
.focus-details > fieldset,
.simulation-tools > label {
  margin: 8px 0;
}
button:focus-visible,
select:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 3px solid #67e8f9;
  outline-offset: 3px;
}
.motion-dialog {
  color: #e8edf7;
  background: #101927;
  border: 1px solid #64748b;
  border-radius: 16px;
  padding: 22px;
  width: min(440px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  box-sizing: border-box;
  overflow: auto;
}
.motion-dialog::backdrop {
  background: #000a;
}
.motion-dialog h2 {
  font-size: 21px;
  font-weight: 600;
  margin: 0 0 12px;
}
.motion-dialog p {
  line-height: 1.5;
  margin: 0 0 16px;
}
.motion-dialog label {
  margin-bottom: 16px;
}
.approved-travel {
  display: grid;
  padding: 12px;
  background: #172b3f;
  border-radius: 10px;
  text-align: center;
}
.approved-travel strong {
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
.approved-travel span {
  font-size: 13px;
  color: #bac7db;
}
@media (max-width: 380px) {
  .manual-buttons {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .focus-card {
    padding: 12px;
  }
}
</style>
