<template>
  <main class="mx-auto max-w-2xl p-4 space-y-5 text-content">
    <header>
      <h1 class="text-2xl font-semibold">MLAstro RPA</h1>
      <p class="text-sm text-content-muted mt-1">
        Automated polar alignment with your imaging camera and TPPA.
      </p>
    </header>
    <p
      v-if="error"
      role="alert"
      class="rounded-lg border border-status-danger bg-status-danger/10 p-3"
    >
      {{ error }}
    </p>
    <p v-if="notice" role="status" class="text-accent">{{ notice }}</p>
    <p
      v-if="watchdog?.supported && watchdog.enabled === false"
      role="alert"
      class="rounded-lg border border-status-warn bg-status-warn/10 p-3"
    >
      The firmware communication watchdog is disabled. Communication-loss protection is unavailable.
    </p>
    <p
      v-if="motionFaulted"
      role="alert"
      class="rounded-lg border border-status-danger bg-status-danger/10 p-3 font-semibold"
    >
      Motion is inhibited:
      {{ status.motionFault || 'A movement command could not be confirmed.' }}
      Use Clear fault and reconnect, then wait for the RPA to be ready before moving again.
    </p>
    <p
      v-else-if="motionInhibited"
      role="status"
      class="rounded-lg border border-status-warn bg-status-warn/10 p-3"
    >
      Motion is inhibited while the controller stops. Wait for the device status to update.
    </p>
    <section class="rounded-xl border border-line-strong p-4 space-y-3">
      <h2 class="text-lg font-semibold">1. Connect the RPA</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          >Connection
          <select
            :value="connection.transport"
            :disabled="busy || !connectionReady || status.connected"
            class="field"
            @change="transport = $event.target.value"
          >
            <option v-if="!connectionReady" value="">Checking connection…</option>
            <option value="wifi">Wi-Fi</option>
            <option value="usb">USB serial</option>
          </select>
        </label>
        <label v-if="connection.transport === 'wifi'"
          >Hostname or IP address
          <input
            :value="connection.address"
            @input="address = $event.target.value"
            :placeholder="status.connected ? 'Connected address unavailable' : ''"
            :disabled="busy || status.connected"
            class="field"
            spellcheck="false"
          />
        </label>
        <label v-else-if="connection.transport === 'usb'"
          >USB device
          <select
            :value="connection.address"
            @change="usbSelection = $event.target.value"
            :disabled="busy || status.connected || usbLoading"
            class="field"
          >
            <option value="auto">Auto-detect</option>
            <option
              v-if="
                status.connected && !usbDevices.some((device) => device.path === connection.address)
              "
              :value="connection.address"
            >
              Connected RPA - {{ connection.address }}
            </option>
            <option v-for="device in usbDevices" :key="device.path" :value="device.path">
              {{ device.label }}{{ device.likelyRpa ? ' (likely RPA)' : '' }} -
              {{ device.path }}
            </option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          class="tns-btn-primary"
          :disabled="
            busy || !connectionReady || status.connected || (transport === 'usb' && usbLoading)
          "
          @click="connect"
        >
          Connect
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="!canDisconnect(status, false, busy)"
          @click="disconnect"
        >
          Disconnect
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="
            busy ||
            stopping ||
            running ||
            pendingStart ||
            status.apiVersion < 2 ||
            !status.apiVersion
          "
          @click="reconnect"
        >
          Clear fault and reconnect
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="busy || status.apiVersion < 2 || !status.apiVersion"
          @click="checkConnection"
        >
          Run connection check
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="busy || status.apiVersion < 2 || !status.apiVersion"
          @click="downloadDiagnostics"
        >
          Download diagnostics
        </button>
        <button class="tns-btn-secondary" :disabled="busy" @click="refreshConnection">
          Refresh
        </button>
      </div>
      <p
        v-if="connectionReady && (!status.apiVersion || status.apiVersion < 2)"
        class="text-sm text-content-muted"
      >
        Fault recovery and diagnostic export require a newer backend.
      </p>
      <div
        v-if="diagnostics"
        class="border border-line-strong rounded-lg p-3 space-y-1 text-sm"
        role="status"
      >
        <p class="font-semibold">Connection check snapshot</p>
        <p>
          Firmware: {{ diagnostics.firmwareVersion || 'unknown' }} · PINS:
          {{ diagnostics.pinsVersion || 'unknown' }} · TPPA:
          {{ diagnostics.tppaVersion || 'unknown' }}
        </p>
        <p>
          Plugin: {{ diagnostics.pluginVersion || 'unknown' }} · Relay:
          {{ diagnostics.relayVersion || 'unknown' }}
        </p>
        <p>
          Transport: {{ diagnostics.transport || 'unknown' }} · Device readiness:
          {{ diagnostics.readiness || 'unknown' }}
        </p>
        <p>
          Telemetry age: {{ durationDisplay(diagnostics.telemetryAgeMilliseconds) }} · Longest
          observed gap: {{ durationDisplay(diagnostics.longestTelemetryGapMilliseconds) }}
        </p>
        <p>
          Pi throttling flags:
          {{
            diagnostics.piPower?.throttled == null
              ? 'unknown'
              : `0x${diagnostics.piPower.throttled.toString(16)}`
          }}
          · USB max current setting: {{ diagnostics.piPower?.usbMaxCurrentEnable ?? 'unknown' }}
        </p>
        <p v-if="diagnostics.piPower?.throttled > 0" class="text-status-warn">
          The Pi reports current or past power or throttling flags. Inspect its power supply and
          cooling.
        </p>
      </div>
      <p role="status">
        {{
          !connectionReady
            ? 'Checking connection…'
            : status.connected
              ? 'Connected'
              : 'Disconnected'
        }}
        ·
        {{ status.deviceStatus || 'Waiting for device' }}
      </p>
      <p v-if="status.connected && status.usbDevicePath" class="text-sm text-content-muted">
        USB device: {{ status.usbDevicePath }}
      </p>
    </section>
    <section class="rounded-xl border border-line-strong p-4 space-y-3">
      <h2 class="text-lg font-semibold">Manual adjustments</h2>
      <p class="text-sm text-content-muted">
        Choose a bounded step and press an arrow to move. Direction reversals may take longer while
        firmware backlash compensation runs.
      </p>
      <p class="text-sm text-status-warn">
        Moving the RPA shifts the field of view. It is not blocked while PINS is exposing, guiding
        or running a sequence, so stop those first.
      </p>
      <label
        >Step size (arcseconds)
        <select v-model.number="manualStep" class="field max-w-48" :disabled="manualBlocked">
          <option :value="5">5″</option>
          <option :value="10">10″</option>
          <option :value="30">30″</option>
          <option :value="60">60″</option>
          <option :value="120">120″</option>
        </select>
      </label>
      <p v-if="manualBlockReason" role="status" class="text-status-warn">
        {{ manualBlockReason }}
      </p>
      <div class="arrow-pad" role="group" aria-label="Manual altitude and azimuth adjustments">
        <button
          class="pad-key pad-up"
          aria-label="Altitude up"
          :disabled="manualBlocked"
          @click="manualMove('alt', 1)"
        >
          <span aria-hidden="true">↑</span><small>Alt up</small>
        </button>
        <button
          class="pad-key pad-left"
          aria-label="Azimuth left"
          :disabled="manualBlocked"
          @click="manualMove('az', -1)"
        >
          <span aria-hidden="true">←</span><small>Az left</small>
        </button>
        <button class="pad-key pad-stop" aria-label="Stop movement" @click="stop">STOP</button>
        <button
          class="pad-key pad-right"
          aria-label="Azimuth right"
          :disabled="manualBlocked"
          @click="manualMove('az', 1)"
        >
          <span aria-hidden="true">→</span><small>Az right</small>
        </button>
        <button
          class="pad-key pad-down"
          aria-label="Altitude down"
          :disabled="manualBlocked"
          @click="manualMove('alt', -1)"
        >
          <span aria-hidden="true">↓</span><small>Alt down</small>
        </button>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label
          >Speed level<select
            v-model.number="deviceSettings.speedLevel"
            class="field"
            :disabled="manualBlocked"
          >
            <option v-for="level in 5" :key="level" :value="level">
              {{ level }}
            </option>
          </select></label
        >
        <label
          >AZ backlash steps<input
            v-model.number="deviceSettings.azSteps"
            type="number"
            min="0"
            max="10000000"
            step="1"
            class="field"
            :disabled="manualBlocked"
        /></label>
        <label
          >ALT backlash steps<input
            v-model.number="deviceSettings.altSteps"
            type="number"
            min="0"
            step="1"
            class="field"
            :disabled="manualBlocked"
        /></label>
      </div>
      <label
        ><input
          v-model="deviceSettings.backlashEnabled"
          type="checkbox"
          :disabled="manualBlocked"
        />
        Enable backlash compensation</label
      >
      <div class="flex gap-2">
        <button
          class="tns-btn-secondary"
          :disabled="manualBlocked || !deviceSettingsLoaded"
          @click="saveDeviceSettings"
        >
          Save device settings</button
        ><button
          class="tns-btn-secondary"
          :disabled="deviceSettingsBlocked"
          @click="loadDeviceSettings"
        >
          Reload device settings
        </button>
      </div>
      <p v-if="!deviceSettingsLoaded" class="text-sm text-content-muted">
        Load device settings before changing speed or backlash settings.
      </p>
      <p v-if="status.backlash" class="text-sm text-content-muted">
        Firmware backlash:
        {{ status.backlash.enabled ? 'enabled' : 'disabled' }} · AZ
        {{ status.backlash.azSteps }} steps · ALT {{ status.backlash.altSteps }} steps
      </p>
      <p role="status">{{ status.manualMoveStatus || 'Idle' }}</p>
      <p v-if="status.automationEnabled || running" class="text-sm text-content-muted">
        Manual controls are locked during alignment. Stop alignment first.
      </p>
    </section>
    <section class="rounded-xl border border-line-strong p-4 space-y-3">
      <h2 class="text-lg font-semibold">2. Choose the finish tolerance</h2>
      <p class="text-sm text-content-muted">
        Use TPPA's existing camera, exposure and starting-position settings. A connected, unparked
        mount is required for the automatic three-point sweep.
      </p>
      <label
        >Alignment tolerance (arcminutes)
        <input
          v-model.number="tolerance"
          type="number"
          min="0.1"
          max="10"
          step="0.1"
          class="field max-w-48"
          :disabled="busy || status.automationEnabled || running || status.jogActive"
        />
      </label>
      <button
        class="tns-btn-secondary"
        :disabled="busy || status.automationEnabled || running || status.jogActive"
        @click="saveSettings"
      >
        Save settings
      </button>
      <details>
        <summary class="cursor-pointer text-content-muted">Advanced correction settings</summary>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <label
            >Correction fraction<input
              v-model.number="factor"
              type="number"
              min="0.05"
              max="1"
              step="0.05"
              class="field"
              :disabled="busy || status.automationEnabled || status.jogActive"
          /></label>
          <label
            >Maximum step (arcmin)<input
              v-model.number="maxStep"
              type="number"
              min="1"
              step="1"
              class="field"
              :disabled="busy || status.automationEnabled || status.jogActive"
          /></label>
          <label
            >Settling (seconds)<input
              v-model.number="settle"
              type="number"
              min="0"
              max="60"
              step="1"
              class="field"
              :disabled="busy || status.automationEnabled || status.jogActive"
          /></label>
        </div>
        <label class="block mt-3"
          ><input
            v-model="pauseFirst"
            type="checkbox"
            :disabled="busy || status.automationEnabled || status.jogActive"
          />
          Pause before the first correction</label
        >
        <div v-if="advanced.axisMode !== undefined" class="space-y-3 mt-3">
          <label
            >Correction axes
            <select v-model="advanced.axisMode" class="field" :disabled="settingsBlocked">
              <option value="Both">Both axes</option>
              <option value="Auto">Larger error first</option>
            </select>
          </label>
          <label class="block"
            ><input
              v-model="advanced.overshootEnabled"
              type="checkbox"
              :disabled="settingsBlocked"
            />
            Enable altitude overshoot</label
          >
          <label
            >Overshoot direction
            <select v-model="overshootDirection" class="field" :disabled="settingsBlocked">
              <option v-if="overshootDirection === 'conflict'" value="conflict" disabled>
                Choose one direction or off
              </option>
              <option value="off">Off</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
            </select>
          </label>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label
              >Up overshoot (arcminutes)<input
                v-model.number="advanced.overshootUpArcMin"
                type="number"
                min="0"
                step="any"
                class="field"
                :disabled="settingsBlocked"
            /></label>
            <label
              >Down overshoot (arcminutes)<input
                v-model.number="advanced.overshootDownArcMin"
                type="number"
                min="0"
                step="any"
                class="field"
                :disabled="settingsBlocked"
            /></label>
          </div>
          <label class="block"
            ><input
              v-model="advanced.autoChangeDirection"
              type="checkbox"
              :disabled="settingsBlocked"
            />
            Automatically change direction</label
          >
          <label class="block"
            ><input
              v-model="advanced.reverseAzimuth"
              type="checkbox"
              :disabled="settingsBlocked || advanced.autoChangeDirection"
            />
            Reverse azimuth direction</label
          >
          <label class="block"
            ><input
              v-model="advanced.reverseAltitude"
              type="checkbox"
              :disabled="settingsBlocked || advanced.autoChangeDirection"
            />
            Reverse altitude direction</label
          >
        </div>
        <p v-else class="text-sm text-content-muted mt-2">
          Additional correction settings are unavailable on this backend.
        </p>
        <div class="border-t border-line-strong mt-4 pt-3 space-y-2">
          <h3 class="font-semibold">Firmware communication watchdog</h3>
          <p class="text-sm text-content-muted">
            When enabled, the firmware can stop motion if communication is lost. This setting
            persists on the device. Connect to this RPA over Wi-Fi to read or change it; then switch
            back to USB if desired.
          </p>
          <p v-if="watchdogUnavailable || watchdog?.code === 'unsupported'" role="status">
            Watchdog control is unavailable on this backend or device.
          </p>
          <p v-else-if="watchdog?.code === 'wifi_required'" role="status">
            Connect to this RPA over Wi-Fi to read or change the watchdog; then switch back to USB
            if desired.
          </p>
          <p
            v-else-if="!watchdog || !watchdog.supported || watchdog.enabled === null"
            role="status"
          >
            Cannot read the watchdog. Check the RPA network connection and refresh.
          </p>
          <template v-else>
            <p role="status">
              Current device state: {{ watchdog.enabled ? 'Enabled' : 'Disabled' }}
            </p>
            <p v-if="!watchdog.enabled" class="text-status-warn">
              Communication-loss protection is disabled on the device.
            </p>
            <label
              >Requested state
              <select v-model="watchdogChoice" class="field" :disabled="deviceSettingsBlocked">
                <option :value="true">Enabled</option>
                <option :value="false">Disabled</option>
              </select>
            </label>
            <label
              v-if="watchdogChoice === false && watchdog.enabled"
              class="block text-status-warn"
            >
              <input v-model="confirmWatchdogOff" type="checkbox" /> I understand that disabling the
              watchdog removes automatic communication-loss protection.
            </label>
            <button
              class="tns-btn-secondary"
              :disabled="
                deviceSettingsBlocked ||
                watchdogChoice === watchdog.enabled ||
                (watchdogChoice === false && !confirmWatchdogOff)
              "
              @click="applyWatchdog"
            >
              Apply watchdog setting
            </button>
            <p v-if="deviceSettingsBlocked" class="text-sm text-content-muted">
              Connect the RPA and wait until it is idle and ready to change this setting.
            </p>
          </template>
        </div>
        <p class="text-sm text-content-muted mt-2">
          Firmware backlash compensation and hardware limits are preserved.
        </p>
      </details>
    </section>
    <section class="rounded-xl border border-line-strong p-4 space-y-3">
      <h2 class="text-lg font-semibold">3. Align</h2>
      <p v-if="error" role="alert" class="text-status-danger">{{ error }}</p>
      <p v-if="notice" role="status" class="text-accent">{{ notice }}</p>
      <p class="text-sm text-content-muted">
        Start selects MLAstro for TPPA, enables the controller and begins the three-point sweep.
        Ensure the telescope has room to slew.
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          class="tns-btn-primary"
          :disabled="
            busy ||
            stopping ||
            pendingStart ||
            motionInhibited ||
            status.jogActive ||
            running ||
            !status.connected ||
            status.deviceStatus !== 'READY'
          "
          @click="start"
        >
          Start automated alignment
        </button>
        <button class="tns-btn-secondary" :disabled="busy || !running" @click="pauseResume">
          {{ paused ? 'Resume' : 'Pause' }}
        </button>
        <button class="tns-btn-danger" @click="stop">Stop alignment</button>
      </div>
      <p role="status">{{ status.sessionStatus || 'Idle' }}</p>
      <p v-if="lastProgress" class="text-sm break-words">{{ lastProgress }}</p>
      <p v-if="status.automationEnabled" class="text-sm text-accent">
        Correction controller enabled
      </p>
      <p class="text-sm text-content-muted">
        The backend runs alignment even if you leave this page. Reopen it to check status.
      </p>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import { apiStore } from '@/store/store';
import { useTppaStore } from '@/store/tppaStore';
import apiService from '@/services/apiService';
import websocket from '@/services/websocketTppa';
import { buildTppaStartMessage } from '@/utils/tppaStart';
import { rpaRequest } from '../api';
import { startAutomaticAlignment } from '../workflow';
import { connectionForDisplay } from '../connection';
import { canDisconnect, motionRecovery } from '../motion';

const rig = apiStore();
const tppa = useTppaStore();
const status = ref({});
const motionFaulted = computed(() => motionRecovery(status.value).faulted);
const motionInhibited = computed(() => motionRecovery(status.value).inhibited);
const connectionReady = computed(() => typeof status.value.connected === 'boolean');
const manualStep = ref(30);
const deviceSettingsLoaded = ref(false);
let settingsGeneration = 0;
let watchdogGeneration = 0;
const deviceSettings = ref({
  speedLevel: 1,
  backlashEnabled: false,
  azSteps: 0,
  altSteps: 0,
});
const transport = ref('wifi');
const address = ref('mlastrorpa.local');
const usbSelection = ref('auto');
const connection = computed(() =>
  connectionForDisplay(status.value, {
    transport: transport.value,
    address: address.value,
    usbSelection: usbSelection.value,
  })
);
const usbDevices = ref([]);
const usbLoading = ref(false);
let usbDiscoveryGeneration = 0;
const tolerance = ref(1);
const factor = ref(0.75);
const maxStep = ref(120);
const settle = ref(3);
const pauseFirst = ref(true);
const advanced = ref({});
const overshootDirection = ref('off');
const watchdog = ref(null);
const watchdogChoice = ref(null);
const confirmWatchdogOff = ref(false);
const watchdogUnavailable = ref(false);
const diagnostics = ref(null);
const durationDisplay = (value) => (Number.isFinite(value) ? `${value} ms` : 'unknown');
const busy = ref(false);
const pendingStart = ref(false);
const stopping = ref(false);
const running = ref(false);
const paused = ref(tppa.isPause);
const error = ref('');
const notice = ref('');
const lastProgress = ref('');
const manualBlockReason = computed(() => {
  if (stopping.value) return 'Stopping the RPA. Please wait.';
  if (motionInhibited.value)
    return 'Movement is inhibited. See the connection recovery message above.';
  if (pendingStart.value) return 'Waiting for automated alignment to start.';
  if (!status.value.connected) return 'Connect the RPA to enable the arrows.';
  if (status.value.automationEnabled || status.value.sessionRunning)
    return 'Automated RPA alignment is active. Stop it before making manual adjustments.';
  if (status.value.manualMoveActive) return 'The previous step is still completing.';
  if (status.value.jogActive)
    return 'A previous continuous movement is active. Use Stop before another adjustment.';
  if (busy.value) return 'Waiting for the current request to finish.';
  if (status.value.deviceStatus !== 'READY')
    return 'Waiting for fresh READY telemetry from the RPA.';
  return '';
});
const settingsBlocked = computed(
  () =>
    busy.value ||
    stopping.value ||
    running.value ||
    pendingStart.value ||
    status.value.automationEnabled ||
    status.value.jogActive
);
const manualBlocked = computed(() => Boolean(manualBlockReason.value));
const deviceSettingsBlocked = computed(
  () =>
    busy.value ||
    stopping.value ||
    running.value ||
    pendingStart.value ||
    motionInhibited.value ||
    !status.value.connected ||
    status.value.automationEnabled ||
    status.value.manualMoveActive ||
    status.value.jogActive ||
    status.value.deviceStatus !== 'READY'
);
let poll,
  unsubscribe,
  startGeneration = 0;
let startAckTimer;
watch(
  () => status.value.connected,
  (connected, previous) => {
    if (connected && !previous) {
      loadDeviceSettings();
      loadWatchdog();
    }
    if (!connected) {
      ++settingsGeneration;
      ++watchdogGeneration;
      deviceSettingsLoaded.value = false;
      watchdog.value = null;
      confirmWatchdogOff.value = false;
    }
  }
);
watch(watchdogChoice, () => {
  confirmWatchdogOff.value = false;
});
watch(transport, (value) => {
  if (value === 'usb') discoverUsb();
  else ++usbDiscoveryGeneration;
});
async function discoverUsb() {
  const generation = ++usbDiscoveryGeneration;
  usbLoading.value = true;
  try {
    const result = await rpaRequest('usb-devices');
    if (generation !== usbDiscoveryGeneration) return;
    usbDevices.value = Array.isArray(result.devices) ? result.devices : [];
    if (
      usbSelection.value !== 'auto' &&
      !usbDevices.value.some((device) => device.path === usbSelection.value)
    )
      usbSelection.value = 'auto';
  } catch (e) {
    if (generation === usbDiscoveryGeneration) error.value = e.message;
  } finally {
    if (generation === usbDiscoveryGeneration) usbLoading.value = false;
  }
}
const refreshConnection = () =>
  run(async () => {
    if (transport.value === 'usb') await discoverUsb();
    await refresh();
    if (status.value.connected) await loadDeviceSettings();
    await loadWatchdog();
  });
async function refresh() {
  status.value = await rpaRequest('status');
  const info = await apiService.getTppaInfo();
  if (!info?.Success) throw new Error('TPPA status is unavailable.');
  running.value = Boolean(info.IsRunning);
  if (running.value) {
    pendingStart.value = false;
    clearTimeout(startAckTimer);
  }
}
async function run(operation) {
  if (busy.value || stopping.value) return;
  busy.value = true;
  error.value = '';
  notice.value = '';
  try {
    await operation();
    await refresh();
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
const connect = () =>
  run(async () => {
    const result = await rpaRequest('connect', {
      transport: transport.value,
      address: transport.value === 'usb' ? usbSelection.value : address.value.trim(),
    });
    if (!result.connected) throw new Error('RPA connection was not accepted.');
    notice.value = 'Connected. Save a positive tolerance before starting.';
  });
const disconnect = () => run(() => rpaRequest('disconnect', {}));
const reconnect = () =>
  run(async () => {
    await rpaRequest('reconnect', {});
    await loadWatchdog();
    notice.value = 'Reconnect requested. Check that the device is ready before moving.';
  });
async function loadWatchdog() {
  const generation = ++watchdogGeneration;
  try {
    const result = await rpaRequest('watchdog');
    if (generation !== watchdogGeneration) return;
    if (typeof result?.supported !== 'boolean' || ![true, false, null].includes(result.enabled))
      throw new Error('Invalid watchdog response');
    watchdog.value = result;
    watchdogChoice.value = result.enabled;
    watchdogUnavailable.value = false;
  } catch (_) {
    if (generation !== watchdogGeneration) return;
    watchdog.value = null;
    watchdogUnavailable.value = true;
  }
  confirmWatchdogOff.value = false;
}
const applyWatchdog = () =>
  run(async () => {
    if (watchdogChoice.value === false && !confirmWatchdogOff.value)
      throw new Error('Confirm disabling communication-loss protection first.');
    const requested = watchdogChoice.value;
    try {
      await rpaRequest('watchdog', {
        enabled: requested,
        confirmed: requested || confirmWatchdogOff.value,
      });
    } catch (e) {
      watchdog.value = null;
      confirmWatchdogOff.value = false;
      throw e;
    }
    await loadWatchdog();
    if (!watchdog.value?.supported || watchdog.value.enabled !== requested)
      throw new Error('Watchdog state could not be confirmed. Refresh and check the device.');
    notice.value = 'Watchdog setting confirmed on the device.';
  });
const checkConnection = () =>
  run(async () => {
    diagnostics.value = null;
    diagnostics.value = await rpaRequest('diagnostics');
  });
const downloadDiagnostics = () =>
  run(async () => {
    const report = await rpaRequest('diagnostics');
    diagnostics.value = report;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mlastro-diagnostics.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
async function loadDeviceSettings() {
  const generation = ++settingsGeneration;
  deviceSettingsLoaded.value = false;
  try {
    const settings = await rpaRequest('device-settings');
    if (generation !== settingsGeneration || !status.value.connected) return;
    if (
      !Number.isInteger(settings.speedLevel) ||
      settings.speedLevel < 1 ||
      settings.speedLevel > 5 ||
      typeof settings.backlashEnabled !== 'boolean' ||
      !Number.isInteger(settings.azSteps) ||
      settings.azSteps < 0 ||
      settings.azSteps > 10000000 ||
      !Number.isInteger(settings.altSteps) ||
      settings.altSteps < 0 ||
      settings.altSteps > 10000000
    )
      throw new Error(
        'Device settings are invalid. Reload them before changing speed or backlash settings.'
      );
    deviceSettings.value = settings;
    deviceSettingsLoaded.value = true;
  } catch (e) {
    if (generation === settingsGeneration) error.value = e.message;
  }
}
function saveDeviceSettings() {
  return run(async () => {
    const settings = deviceSettings.value;
    if (
      !Number.isInteger(settings.speedLevel) ||
      settings.speedLevel < 1 ||
      settings.speedLevel > 5 ||
      !Number.isInteger(settings.azSteps) ||
      settings.azSteps < 0 ||
      settings.azSteps > 10000000 ||
      !Number.isInteger(settings.altSteps) ||
      settings.altSteps < 0 ||
      settings.altSteps > 10000000
    )
      throw new Error('Choose a speed from 1 to 5 and whole backlash steps from 0 to 10000000.');
    await rpaRequest('device-settings', { ...settings });
    notice.value = 'Device settings saved.';
  });
}
const manualMove = (axis, direction) => {
  if (manualBlocked.value) return;
  return run(async () => {
    await rpaRequest('move', { axis, direction, arcseconds: manualStep.value });
    notice.value = 'Manual step requested. Wait for movement completion before the next step.';
  });
};
const saveSettings = () =>
  run(async () => {
    if (!Number.isFinite(tolerance.value) || tolerance.value < 0.1 || tolerance.value > 10)
      throw new Error('Choose a tolerance from 0.1 to 10 arcminutes.');
    if (
      !Number.isFinite(factor.value) ||
      factor.value < 0.05 ||
      factor.value > 1 ||
      !Number.isFinite(maxStep.value) ||
      maxStep.value < 1 ||
      !Number.isFinite(settle.value) ||
      settle.value < 0 ||
      settle.value > 60
    )
      throw new Error('Check correction fraction, maximum step and settling time.');
    const extra = { ...advanced.value };
    if (extra.axisMode !== undefined) {
      if (
        !['Both', 'Auto'].includes(extra.axisMode) ||
        !['off', 'up', 'down'].includes(overshootDirection.value) ||
        !Number.isFinite(extra.overshootUpArcMin) ||
        extra.overshootUpArcMin < 0 ||
        !Number.isFinite(extra.overshootDownArcMin) ||
        extra.overshootDownArcMin < 0
      )
        throw new Error('Choose a valid axis mode and non-negative finite overshoot amounts.');
      extra.overshootUpEnabled = overshootDirection.value === 'up';
      extra.overshootDownEnabled = overshootDirection.value === 'down';
    }
    await rpaRequest('settings', {
      ...extra,
      factor: factor.value,
      maxStepArcMin: maxStep.value,
      settleSeconds: settle.value,
      pauseBeforeFirstCorrection: pauseFirst.value,
    });
    const result = await apiService.postTppaOptions({
      AlignmentTolerance: tolerance.value,
    });
    if (!result?.Success || (result.Failures && Object.keys(result.Failures).length))
      throw new Error('TPPA did not save the tolerance.');
    const saved = await apiService.getTppaOptions();
    if (!saved?.Success || Number(saved.Options?.AlignmentTolerance?.Value) !== tolerance.value)
      throw new Error(
        'TPPA did not retain the requested tolerance. Settings were not confirmed saved.'
      );
    notice.value = 'Correction settings and TPPA tolerance saved.';
  });
const start = () =>
  run(async () => {
    const generation = ++startGeneration;
    const current = () => {
      if (generation !== startGeneration) throw new Error('Start cancelled by Stop.');
    };
    await startAutomaticAlignment({
      isCancelled: () => generation !== startGeneration,
      verify: async () => {
        await refresh();
        current();
        if (running.value) throw new Error('TPPA is already running.');
        if (!rig.cameraInfo?.Connected || !rig.mountInfo?.Connected)
          throw new Error('Connect the imaging camera and mount first.');
        if (rig.mountInfo.AtPark) throw new Error('Unpark the mount before starting alignment.');
        const options = await apiService.getTppaOptions();
        current();
        if (!(options?.Options?.AlignmentTolerance?.Value > 0))
          throw new Error('Save a positive alignment tolerance first.');
        if (!websocket.isOpen()) await websocket.connect();
        current();
        if (!websocket.isOpen()) throw new Error('TPPA connection is unavailable.');
        tppa.settingsReady = false;
        await tppa.loadTppaSettings();
        if (!tppa.settingsReady)
          throw new Error(
            'Could not load current TPPA camera settings. Open TPPA settings and retry.'
          );
        current();
        return buildTppaStartMessage({ ...tppa.settings, ManualMode: false }, rig);
      },
      select: () => rpaRequest('select-controller', {}),
      enable: () => rpaRequest('automation', { enabled: true }),
      send: (message) => {
        pendingStart.value = true;
        const sent = websocket.sendMessage(JSON.stringify(message));
        if (!sent) pendingStart.value = false;
        return sent;
      },
      stop: () => rpaRequest('stop', {}),
    });
    notice.value = 'Start sent. Watch TPPA progress for confirmation.';
    clearTimeout(startAckTimer);
    startAckTimer = setTimeout(async () => {
      if (!pendingStart.value) return;
      try {
        const info = await apiService.getTppaInfo();
        if (info?.Success && info.IsRunning) {
          pendingStart.value = false;
          running.value = true;
          return;
        }
        await stop();
        error.value =
          'TPPA did not confirm the start. Stop was requested; inspect status before retrying.';
      } catch (e) {
        error.value = `Start could not be confirmed: ${e.message}. Use Stop before retrying.`;
      }
    }, 10000);
  });
const pauseResume = () =>
  run(async () => {
    if (!websocket.isOpen()) throw new Error('TPPA connection is unavailable.');
    const sent = websocket.sendMessage(
      JSON.stringify({
        Action: paused.value ? 'resume-alignment' : 'pause-alignment',
      })
    );
    if (!sent) throw new Error('TPPA pause/resume could not be sent.');
  });
async function stop() {
  if (stopping.value) return;
  stopping.value = true;
  clearTimeout(startAckTimer);
  ++startGeneration;
  pendingStart.value = false;
  error.value = '';
  notice.value = '';
  try {
    const results = await Promise.allSettled([
      rpaRequest('stop', {}),
      (async () => {
        if (!websocket.isOpen()) await websocket.connect();
        if (!websocket.isOpen()) throw new Error('TPPA stop could not be sent.');
        if (!websocket.sendMessage(JSON.stringify({ Action: 'stop-alignment' })))
          throw new Error('TPPA stop could not be sent.');
      })(),
    ]);
    const failure = results.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    await refresh();
    notice.value = 'Stop requested; check the device status confirms it is idle.';
  } catch (e) {
    error.value = e.message;
  } finally {
    stopping.value = false;
  }
}
onMounted(() => {
  unsubscribe = websocket.addMessageListener((message) => {
    const response = message?.Response;
    if (response === 'stopped procedure') {
      pendingStart.value = false;
      running.value = false;
      paused.value = false;
    } else if (response === 'paused procedure') {
      paused.value = true;
    } else if (response === 'resumed procedure') {
      paused.value = false;
    } else if (response) {
      running.value = true;
      paused.value = response.Status === 'Paused';
      lastProgress.value =
        typeof response === 'string' ? response : response.Status || 'Alignment running';
    }
  });
  run(async () => {
    status.value = await rpaRequest('status');
    const settings = await rpaRequest('settings');
    factor.value = settings.factor;
    maxStep.value =
      Number.isFinite(settings.maxStepArcMin) && settings.maxStepArcMin >= 1
        ? settings.maxStepArcMin
        : 120;
    settle.value = settings.settleSeconds;
    pauseFirst.value = settings.pauseBeforeFirstCorrection;
    const keys = [
      'axisMode',
      'overshootEnabled',
      'overshootUpEnabled',
      'overshootDownEnabled',
      'overshootUpArcMin',
      'overshootDownArcMin',
      'autoChangeDirection',
      'reverseAzimuth',
      'reverseAltitude',
    ];
    advanced.value =
      status.value.apiVersion >= 2
        ? Object.fromEntries(
            keys.filter((key) => settings[key] !== undefined).map((key) => [key, settings[key]])
          )
        : {};
    overshootDirection.value =
      settings.overshootUpEnabled && settings.overshootDownEnabled
        ? 'conflict'
        : settings.overshootUpEnabled
          ? 'up'
          : settings.overshootDownEnabled
            ? 'down'
            : 'off';
    await loadWatchdog();
    const options = await apiService.getTppaOptions();
    tolerance.value = options?.Options?.AlignmentTolerance?.Value ?? 0;
  });
  poll = setInterval(() => {
    if (!busy.value)
      refresh().catch((e) => {
        error.value = e.message;
      });
  }, 3000);
});
onBeforeUnmount(() => {
  ++settingsGeneration;
  ++watchdogGeneration;
  ++usbDiscoveryGeneration;
  clearInterval(poll);
  unsubscribe?.();
  ++startGeneration;
});
</script>

<style scoped>
.arrow-pad {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas: '. up .' 'left stop right' '. down .';
  gap: 0.5rem;
  max-width: 340px;
  margin: 1rem auto;
}
.pad-key {
  touch-action: none;
  min-height: 74px;
  border: 1px solid #475569;
  border-radius: 0.75rem;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.pad-key span {
  font-size: 2rem;
  line-height: 1.1;
}
.pad-key small {
  font-size: 0.75rem;
}
.pad-key:focus-visible {
  outline: 3px solid #22d3ee;
}
.pad-up {
  grid-area: up;
}
.pad-left {
  grid-area: left;
}
.pad-right {
  grid-area: right;
}
.pad-down {
  grid-area: down;
}
.pad-stop {
  grid-area: stop;
  background: #9f1239;
  font-weight: 700;
}
.field {
  display: block;
  width: 100%;
  margin-top: 0.35rem;
  padding: 0.6rem;
  border: 1px solid #475569;
  border-radius: 0.5rem;
  background: #1e293b;
  color: #e2e8f0;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
label {
  font-size: 0.9rem;
}
</style>
