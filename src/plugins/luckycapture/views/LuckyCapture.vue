<script setup>
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore } from '@/store/settingsStore';
import {
  cameraPreferenceKey,
  readCameraPreferences,
  writeCameraPreferences,
  sensorPoint,
  cameraDefaults,
} from '../utils/cameraPreferences';
import FocusPanel from '../components/FocusPanel.vue';
import MountPanel from '../components/MountPanel.vue';
import CameraControl from '../components/CameraControl.vue';
import IntensityHistogram from '../components/IntensityHistogram.vue';
import FileBrowser from '@/components/helpers/fileBrowser.vue';
import apiService from '@/services/apiService';
import { readLimit, selectionToRoi, moveCaptureRoi, roiPresets } from '../utils/captureUi';
import { useLuckyCaptureStore } from '../store/luckycaptureStore';
const store = useLuckyCaptureStore();
const connectionSettings = useSettingsStore();
const rotatedPreview = ref(false);
const preferenceKey = computed(() =>
  cameraPreferenceKey(
    `${connectionSettings.connection.ip}:${connectionSettings.connection.port}`,
    store.camera
  )
);
function savePreferences(settings) {
  const previous = readCameraPreferences(localStorage, preferenceKey.value) || {};
  writeCameraPreferences(localStorage, preferenceKey.value, {
    ...previous,
    ...(settings ? { settings: { ...settings, usbLimit: form.usbLimit } } : {}),
    rotatedPreview: rotatedPreview.value,
    outputDirectory: recording.outputDirectory,
  });
}
function rotatePreview() {
  rotatedPreview.value = !rotatedPreview.value;
  savePreferences();
}

const { t } = useI18n();
const text = (key) => t(`luckycapture.${key}`);
const form = reactive({
  exposureSeconds: 0.02,
  gain: null,
  offset: null,
  usbLimit: null,
  binning: '1x1',
  bitDepth: null,
  acquisitionMode: 'auto',
  allowExperimentalStreaming: false,
  allowDriverReconnect: false,
  allowStreamDepthReduction: false,
});
const roi = reactive({ x: 0, y: 0, width: 512, height: 512 });
const roiStep = ref(0.1);
const appliedRoi = computed(() => store.settings.roi);
const binning = computed(() => (form.binning || '1x1').split('x').map(Number));
const roiPresetOptions = computed(() =>
  store.camera?.roiSupported
    ? roiPresets(store.camera, { binX: binning.value[0], binY: binning.value[1] })
    : []
);
const roiPresetValue = computed(() => {
  if (!useRoi.value) return 'full';
  const match = roiPresetOptions.value.find(
    (preset) =>
      preset.roi.x === roi.x &&
      preset.roi.y === roi.y &&
      preset.roi.width === roi.width &&
      preset.roi.height === roi.height
  );
  return match?.key || 'custom';
});
function applyRoiPreset(key) {
  if (key === 'full') {
    useRoi.value = false;
    return;
  }
  const preset = roiPresetOptions.value.find((option) => option.key === key);
  if (!preset) return;
  useRoi.value = true;
  Object.assign(roi, preset.roi);
}
const canChangeRoi = computed(
  () =>
    store.camera?.connected &&
    store.camera.roiSupported &&
    !busy.value &&
    !focusBusy.value &&
    ['READY', 'PREVIEWING', 'ERROR'].includes(store.status.state)
);
const roiDirections = [
  { key: 'up', dx: 0, dy: -1, icon: '\u2191' },
  { key: 'left', dx: -1, dy: 0, icon: '\u2190' },
  { key: 'right', dx: 1, dy: 0, icon: '\u2192' },
  { key: 'down', dx: 0, dy: 1, icon: '\u2193' },
];
function shiftedRoi(direction) {
  if (!appliedRoi.value) return null;
  const sign = rotatedPreview.value ? -1 : 1;
  return moveCaptureRoi(
    appliedRoi.value,
    store.camera,
    store.settings,
    direction.dx * sign,
    direction.dy * sign,
    roiStep.value
  );
}
function canMoveRoi(direction) {
  const next = shiftedRoi(direction);
  return (
    canChangeRoi.value && next && (next.x !== appliedRoi.value.x || next.y !== appliedRoi.value.y)
  );
}
async function changePreviewRoi(next) {
  // invoke() has already marked this action busy; check device/session guards here.
  if (
    !store.camera?.connected ||
    focusBusy.value ||
    !['READY', 'PREVIEWING', 'ERROR'].includes(store.status.state)
  )
    return;
  selecting.value = false;
  selection.value = null;
  drag.value = null;
  try {
    await store.changeRoi(next);
  } finally {
    useRoi.value = !!store.settings.roi;
    if (store.settings.roi) Object.assign(roi, store.settings.roi);
    savePreferences(store.settings);
  }
}
const useRoi = ref(false);
const recording = reactive({
  format: 'ser',
  outputDirectory: '',
  frameLimit: null,
  durationSeconds: null,
  playbackFps: 25,
  target: '',
  filter: '',
  relativeDirectory: '',
  filenameTemplate: '{date}_{time}_{target}_{camera}_{sequence}',
});
watch(
  () => recording.outputDirectory,
  () => {
    savePreferences();
    checkFolder();
  }
);
const folderBrowserOpen = ref(false);
const folderMissing = ref(false);
const effectiveFolder = computed(
  () => recording.outputDirectory || store.capabilities.defaultOutputDirectory || ''
);
// Quick check through the existing filesystem API; the plugin re-checks authoritatively
// (mounted, writable) when a recording or snapshot starts and reports any fallback.
async function checkFolder() {
  const selected = recording.outputDirectory;
  if (!selected) {
    folderMissing.value = false;
    return;
  }
  let missing;
  try {
    missing = !(await apiService.browseFilesystem(selected))?.success;
  } catch {
    missing = true;
  }
  if (recording.outputDirectory === selected) folderMissing.value = missing;
}
const folderFallback = computed(() => {
  const status = store.status;
  if (
    status.outputDirectoryFallback &&
    status.requestedOutputDirectory === recording.outputDirectory
  )
    return status.outputDirectory;
  const snapshot = store.snapshotFallback;
  return snapshot?.requested === recording.outputDirectory ? snapshot.directory : null;
});
const folderWarning = computed(() => {
  if (!recording.outputDirectory) return '';
  if (folderMissing.value)
    return t('luckycapture.outputDirectoryUnavailable', {
      path: store.capabilities.defaultOutputDirectory || '',
    });
  if (folderFallback.value)
    return t('luckycapture.outputDirectoryFallbackUsed', { path: folderFallback.value });
  return '';
});
const focusBusy = ref(false);
const focusStatus = ref(null);
const analysisBox = computed(() => {
  const roi = focusStatus.value?.settings?.roi;
  const capture = store.previewRoi || {
    x: 0,
    y: 0,
    width: store.camera?.width,
    height: store.camera?.height,
  };
  if (
    !roi ||
    !capture.width ||
    !capture.height ||
    roi.x < capture.x ||
    roi.y < capture.y ||
    roi.x + roi.width > capture.x + capture.width ||
    roi.y + roi.height > capture.y + capture.height
  )
    return null;
  return {
    left: `${((roi.x - capture.x) / capture.width) * 100}%`,
    top: `${((roi.y - capture.y) / capture.height) * 100}%`,
    width: `${(roi.width / capture.width) * 100}%`,
    height: `${(roi.height / capture.height) * 100}%`,
  };
});

const focusPanel = ref(null);
const selectionKind = ref('capture');
const working = ref(false);
const busy = computed(() => working.value || store.pending);
const lock = computed(() => store.active || busy.value);
const finishing = computed(() =>
  ['STARTING', 'STOPPING', 'FINALIZING'].includes(store.status.state)
);
const recordingActive = computed(() =>
  ['RECORDING', 'STOPPING', 'FINALIZING'].includes(store.status.state)
);
const previewOnly = computed(
  () => form.acquisitionMode === 'preview' && store.capabilities?.stream?.previewOnly
);
const canStart = computed(
  () =>
    store.available &&
    store.camera?.connected &&
    !busy.value &&
    !finishing.value &&
    !focusBusy.value &&
    !recordingActive.value
);
const panel = ref('preview');
const mountOpen = ref(false);
const pageRoot = ref(null);
const compact = ref(window.innerWidth <= 900);
let resizeFrame = 0;
const resizeObserver = new ResizeObserver(([entry]) => {
  const shouldCompact =
    (entry.borderBoxSize?.[0]?.inlineSize ?? entry.target.getBoundingClientRect().width) <= 960;
  cancelAnimationFrame(resizeFrame);
  if (shouldCompact !== compact.value) {
    resizeFrame = requestAnimationFrame(() => {
      compact.value = shouldCompact;
    });
  }
});
const selecting = ref(false);
const cameraForm = ref(null);
const roiHint = computed(() => (selecting.value ? text('roiSelecting') : text('roiHint')));
const stateText = computed(() => text(`state${store.status.state || 'LOADING'}`));
const primaryMetrics = ['currentAcquisitionFps', 'writtenFrames', 'elapsedSeconds'];
const detailMetrics = [
  'acquiredFrames',
  'acceptedFrames',
  'pluginDroppedFrames',
  'streamTapDroppedFrames',
  'previewSkippedFrames',
  'averageAcquisitionFps',
  'writtenFps',
  'queueDepth',
];
async function tabKey(event, current) {
  const items = compact.value
    ? ['preview', 'camera', 'recording', 'focus']
    : ['camera', 'recording', 'focus'];
  const index = items.indexOf(current);
  let next;
  if (event.key === 'ArrowRight') next = items[(index + 1) % items.length];
  if (event.key === 'ArrowLeft') next = items[(index + items.length - 1) % items.length];
  if (event.key === 'Home') next = items[0];
  if (event.key === 'End') next = items[items.length - 1];
  if (!next) return;
  event.preventDefault();
  selectPanel(next);
  await nextTick();
  document.getElementById(`lc-tab-${next}`)?.focus();
}
const selectPanel = (value) => {
  selecting.value = false;
  panel.value = value;
};
watch(
  () => store.active,
  (active) => {
    if (active) {
      selecting.value = false;
      drag.value = null;
    }
  }
);
const supportedControls = computed(() =>
  store.controls
    .filter((c) => ['exposure', 'gain', 'offset', 'usbLimit', 'bitDepth', 'binning'].includes(c.id))
    .map((control) => {
      if (
        control.id !== 'bitDepth' ||
        store.capabilities.rawDepthOptions?.length < 2 ||
        !store.capabilities.rawDepthOptions
      )
        return control;
      const stream = store.capabilities.stream;
      const enabled =
        form.acquisitionMode !== 'exposures' &&
        stream?.available &&
        (stream.hardwareValidated || form.allowExperimentalStreaming) &&
        (!stream.requiresDriverReconnect || form.allowDriverReconnect);
      return {
        ...control,
        type: 'enum',
        options: store.capabilities.rawDepthOptions,
        readOnly: !enabled,
      };
    })
);
const showEightBitTip = computed(() => {
  const depth = supportedControls.value.find((c) => c.id === 'bitDepth');
  return !!depth && !depth.readOnly && depth.options?.includes(8) && Number(form.bitDepth) > 8;
});
const controlKey = (id) => (id === 'exposure' ? 'exposureSeconds' : id);
const number = (value, digits = 1) => (Number.isFinite(value) ? value.toFixed(digits) : '\u2014');
async function invoke(action) {
  if (working.value) return;
  working.value = true;
  try {
    await action();
  } catch {
    /* store displays structured error */
  } finally {
    working.value = false;
    await nextTick();
    if (invalidControl.value)
      cameraForm.value?.querySelector(`[data-control="${invalidControl.value}"]`)?.focus();
  }
}
async function load() {
  await store.open();
  if (!store.camera?.connected) return;
  const saved = readCameraPreferences(localStorage, preferenceKey.value);
  const values = store.active
    ? store.settings
    : saved?.settings || cameraDefaults(store.camera, store.controls, store.capabilities);
  rotatedPreview.value = saved?.rotatedPreview ?? connectionSettings.currentImageRotation === 180;
  recording.outputDirectory = saved?.outputDirectory || '';
  checkFolder();
  Object.assign(form, values, {
    binning: `${values.binX || 1}x${values.binY || 1}`,
  });
  for (const c of store.controls)
    if (form[controlKey(c.id)] == null && c.currentValue != null)
      form[controlKey(c.id)] = c.currentValue;
  useRoi.value = !!values.roi;
  if (values.roi) Object.assign(roi, values.roi);
}
const invalidControl = ref(null);
async function validateCamera() {
  invalidControl.value = null;
  for (const control of store.controls) {
    if (control.readOnly || control.type === 'enum' || control.id === 'binning') continue;
    const value = form[controlKey(control.id)];
    if (value == null && control.id !== 'exposure') continue;
    const numeric = Number(value);
    if (
      value === '' ||
      !Number.isFinite(numeric) ||
      (control.min != null && numeric < control.min) ||
      (control.max != null && numeric > control.max)
    ) {
      invalidControl.value = control.id;
      panel.value = 'camera';
      store.error = text('invalidCameraSettings');
      throw new Error('Invalid camera settings');
    }
  }
  if (
    useRoi.value &&
    (Object.values(roi).some((n) => !Number.isSafeInteger(n)) ||
      roi.x < 0 ||
      roi.y < 0 ||
      roi.width < 2 ||
      roi.height < 2 ||
      roi.x + roi.width > store.camera.width ||
      roi.y + roi.height > store.camera.height)
  ) {
    panel.value = 'camera';
    store.error = text('invalidRoi');
    throw new Error('Invalid ROI');
  }
}
async function apply() {
  await validateCamera();
  const usb = store.controls.find((c) => c.id === 'usbLimit');
  if (usb && form.usbLimit != null && Number(form.usbLimit) !== usb.currentValue) {
    await store.command('controls/usbLimit', { value: Number(form.usbLimit) }, 'PUT');
    await store.refreshCamera();
  }
  const [binX, binY] = form.binning.split('x').map(Number);
  store.settings = await store.command(
    'settings',
    {
      exposureSeconds: Number(form.exposureSeconds),
      gain: form.gain == null ? null : Number(form.gain),
      offset: form.offset == null ? null : Number(form.offset),
      binX,
      binY,
      bitDepth: supportedControls.value.some((c) => c.id === 'bitDepth' && !c.readOnly)
        ? Number(form.bitDepth)
        : null,
      acquisitionMode: form.acquisitionMode,
      allowExperimentalStreaming: form.allowExperimentalStreaming,
      allowDriverReconnect: form.allowDriverReconnect,
      allowStreamDepthReduction: form.allowStreamDepthReduction,
      roi: useRoi.value ? { ...roi } : null,
    },
    'PUT'
  );
  savePreferences(store.settings);
  await store.refreshCamera();
}
async function start(record) {
  if (record) {
    try {
      recording.frameLimit = readLimit(recording.frameLimit, true);
      recording.durationSeconds = readLimit(recording.durationSeconds);
    } catch {
      panel.value = 'recording';
      store.error = text('invalidLimit');
      return;
    }
  }
  await validateCamera();
  if (store.status.state === 'PREVIEWING') await store.command('preview/stop', {});
  await apply();
  if (record)
    await store.command('recording/start', {
      ...recording,
      frameLimit: recording.frameLimit ? Number(recording.frameLimit) : null,
      durationSeconds: recording.durationSeconds ? Number(recording.durationSeconds) : null,
    });
  else await store.command('preview/start', { previewFps: 8 });
}
async function togglePreview() {
  if (store.status.state === 'PREVIEWING') await store.command('preview/stop', {});
  else {
    selecting.value = false;
    await start(false);
  }
}
async function toggleRecord() {
  if (recordingActive.value) await store.command('recording/stop', {});
  else {
    selecting.value = false;
    await start(true);
  }
}
async function selectFocusRoi() {
  if (focusBusy.value || !store.previewUrl) return;
  selectionKind.value = 'focus';
  selecting.value = true;
  selection.value = null;
  panel.value = 'preview';
}
async function toggleSelection() {
  selectionKind.value = 'capture';
  if (selecting.value) {
    selecting.value = false;
    drag.value = null;
    return;
  }
  if (store.status.state === 'PREVIEWING') await store.command('preview/stop', {});
  selecting.value = true;
  selection.value = null;
}
const drag = ref(null);
const selection = ref(null);
function point(event) {
  const box = event.currentTarget.getBoundingClientRect();
  return sensorPoint(
    {
      x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)),
    },
    rotatedPreview.value
  );
}
function selectStart(event) {
  if (
    !selecting.value ||
    (selectionKind.value === 'capture' ? lock.value : focusBusy.value) ||
    !store.camera?.roiSupported ||
    !event.isPrimary ||
    (event.pointerType === 'mouse' && event.button !== 0)
  )
    return;
  event.currentTarget.setPointerCapture(event.pointerId);
  drag.value = point(event);
  selection.value = null;
}
function selectMove(event) {
  if (!drag.value) return;
  const end = point(event);
  selection.value = {
    x: Math.min(drag.value.x, end.x),
    y: Math.min(drag.value.y, end.y),
    width: Math.abs(end.x - drag.value.x),
    height: Math.abs(end.y - drag.value.y),
  };
}
function selectEnd(event) {
  selectMove(event);
  drag.value = null;
  if (!selection.value || selection.value.width < 0.01 || selection.value.height < 0.01) return;
  const source = store.previewRoi || {
    x: 0,
    y: 0,
    width: store.camera.width,
    height: store.camera.height,
  };
  if (selectionKind.value === 'focus') {
    focusPanel.value?.setRoi(selectionToRoi(source, selection.value));
    selecting.value = false;
    panel.value = 'focus';
    return;
  }
  Object.assign(roi, selectionToRoi(source, selection.value));
  selecting.value = false;
  panel.value = 'camera';
  useRoi.value = true;
}
onMounted(() => {
  resizeObserver.observe(pageRoot.value);
  invoke(load);
});
onUnmounted(() => {
  resizeObserver.disconnect();
  cancelAnimationFrame(resizeFrame);
  store.close();
});
</script>

<template>
  <main ref="pageRoot" class="lc" :class="{ compact }">
    <header class="page-header">
      <div class="heading">
        <h1>LuckyCapture</h1>
        <p>{{ store.camera?.name || text('noCamera') }}</p>
      </div>
      <button :disabled="busy" @click="invoke(load)">{{ text('refresh') }}</button>
    </header>
    <div class="capture-toolbar" :aria-label="text('captureActions')">
      <div class="session-state" role="status" :class="{ running: store.active }">
        <span class="state-dot" />{{ stateText }}
      </div>
      <div class="primary-actions">
        <button
          class="preview-action"
          :disabled="
            busy ||
            finishing ||
            recordingActive ||
            (!canStart && store.status.state !== 'PREVIEWING')
          "
          @click="invoke(togglePreview)"
        >
          {{ store.status.state === 'PREVIEWING' ? text('pausePreview') : text('preview') }}
        </button>
        <button
          class="record-action"
          :disabled="busy || finishing || previewOnly || (!canStart && !recordingActive)"
          @click="invoke(toggleRecord)"
        >
          {{ finishing ? text('finishing') : recordingActive ? text('stop') : text('record') }}
        </button>
      </div>
    </div>
    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>
    <p v-if="!store.available && !busy" class="notice">{{ text('unavailable') }}</p>
    <p v-else-if="!store.camera?.connected && !busy" class="notice">
      {{ text('connectEquipment') }}
    </p>
    <p v-if="store.available && !store.streamConnected" class="notice" role="status">
      {{ text('reconnecting') }}
    </p>
    <p v-if="previewOnly" class="notice">{{ text('previewOnlyNotice') }}</p>
    <div class="layout">
      <nav class="section-tabs" role="tablist" :aria-label="text('captureSections')">
        <button
          v-if="compact"
          id="lc-tab-preview"
          role="tab"
          aria-controls="lc-preview"
          :aria-selected="panel === 'preview'"
          :tabindex="panel === 'preview' ? 0 : -1"
          @keydown="tabKey($event, 'preview')"
          @click="selectPanel('preview')"
        >
          {{ text('preview') }}
        </button>
        <button
          id="lc-tab-camera"
          role="tab"
          aria-controls="lc-camera"
          :aria-selected="panel === 'camera' || (!compact && panel === 'preview')"
          :tabindex="panel === 'camera' || (!compact && panel === 'preview') ? 0 : -1"
          @keydown="tabKey($event, 'camera')"
          @click="selectPanel('camera')"
        >
          {{ text('cameraTab') }}
        </button>
        <button
          id="lc-tab-recording"
          role="tab"
          aria-controls="lc-recording"
          :aria-selected="panel === 'recording'"
          :tabindex="panel === 'recording' ? 0 : -1"
          @keydown="tabKey($event, 'recording')"
          @click="selectPanel('recording')"
        >
          {{ text('recording') }}
        </button>
        <button
          id="lc-tab-focus"
          role="tab"
          aria-controls="lc-focus"
          :aria-selected="panel === 'focus'"
          :tabindex="panel === 'focus' ? 0 : -1"
          @keydown="tabKey($event, 'focus')"
          @click="selectPanel('focus')"
        >
          {{ t('luckycaptureFocus.tab') }}
        </button>
      </nav>
      <section
        v-show="!compact || panel === 'preview'"
        id="lc-preview"
        class="visual"
        :class="{ 'mount-centering': mountOpen }"
        :role="compact ? 'tabpanel' : undefined"
        :aria-labelledby="compact ? 'lc-tab-preview' : undefined"
      >
        <p v-if="store.camera?.sourceKind === 'simulated'" class="notice simulation-banner">
          {{ t('luckycaptureFocus.simulation') }} - {{ t('luckycaptureFocus.syntheticNotice') }}
        </p>
        <p v-if="focusStatus?.device?.physical" class="notice">
          {{ t('luckycaptureFocus.physicalWarning') }}
        </p>
        <p v-if="focusStatus?.metrics" role="status">
          {{ t('luckycaptureFocus.score') }}:
          {{ focusStatus.metrics.valid ? focusStatus.metrics.score.toFixed(3) : '\u2014' }}
          <span v-if="!focusStatus.metrics.valid">{{
            focusStatus.metrics.flags.map((flag) => t(`luckycaptureFocus.flag_${flag}`)).join(', ')
          }}</span>
        </p>
        <div class="preview" :class="{ selecting }">
          <div
            v-if="store.previewUrl"
            class="preview-frame"
            :class="{ rotated: rotatedPreview }"
            @pointerdown="selectStart"
            @pointermove="selectMove"
            @pointerup="selectEnd"
            @pointercancel="drag = null"
            @lostpointercapture="drag = null"
          >
            <img :src="store.previewUrl" :alt="text('preview')" draggable="false" />
            <div
              v-if="analysisBox && !selecting"
              class="selection focus-selection"
              :style="analysisBox"
            >
              <span>{{ t('luckycaptureFocus.roi') }}</span>
            </div>
            <div
              v-if="selection && (selecting || selectionKind === 'capture')"
              class="selection"
              :style="{
                left: selection.x * 100 + '%',
                top: selection.y * 100 + '%',
                width: selection.width * 100 + '%',
                height: selection.height * 100 + '%',
              }"
            />
          </div>
          <div v-else class="empty-preview">
            <p>{{ text('startPreview') }}</p>
            <p class="hint">{{ text('previewHelp') }}</p>
          </div>
        </div>
        <MountPanel :visible="!compact || panel === 'preview'" @update:open="mountOpen = $event" />
        <div class="preview-tools">
          <button
            v-if="store.camera?.roiSupported"
            :disabled="busy || recordingActive || finishing || !store.previewUrl"
            :aria-pressed="selecting"
            @click="invoke(toggleSelection)"
          >
            {{ selecting ? text('cancelSelection') : text('selectRoi') }}
          </button>
          <button
            v-if="store.camera?.roiSupported"
            type="button"
            :disabled="!canChangeRoi || !appliedRoi"
            @click="invoke(() => changePreviewRoi(null))"
          >
            {{ text('resetRoi') }}
          </button>
          <button type="button" :aria-pressed="rotatedPreview" @click="rotatePreview">
            {{ text('rotatePreview') }}
          </button>
          <button
            :disabled="busy || !store.previewUrl"
            @click="invoke(() => store.command('snapshot', recording))"
          >
            {{ text('snapshotShort') }}
          </button>
        </div>
        <fieldset
          v-if="appliedRoi && store.camera?.roiSupported"
          class="roi-navigation"
          :disabled="!canChangeRoi"
          aria-describedby="lc-move-roi-help"
        >
          <legend>{{ text('moveRoi') }}</legend>
          <div class="roi-pad">
            <button
              v-for="direction in roiDirections"
              :key="direction.key"
              type="button"
              :class="`roi-${direction.key}`"
              :aria-label="text(`roiMove${direction.key}`)"
              :disabled="!canMoveRoi(direction)"
              @click="invoke(() => changePreviewRoi(shiftedRoi(direction)))"
            >
              <span aria-hidden="true">{{ direction.icon }}</span>
            </button>
          </div>
          <div class="roi-position">
            <label for="lc-roi-step">{{ text('roiMoveStep') }}</label>
            <select id="lc-roi-step" v-model.number="roiStep">
              <option :value="0">{{ text('roiMoveFine') }}</option>
              <option :value="0.1">{{ text('roiMoveNormal') }}</option>
              <option :value="0.5">{{ text('roiMoveLarge') }}</option>
            </select>
            <p class="hint">
              X {{ appliedRoi.x }} · Y {{ appliedRoi.y }} · {{ appliedRoi.width }} ×
              {{ appliedRoi.height }}
            </p>
          </div>
          <p id="lc-move-roi-help" class="hint">{{ text('roiMoveHelp') }}</p>
        </fieldset>
        <p class="hint">{{ text('previewOrientationHelp') }}</p>
        <p class="hint" :class="{ selectingHint: selecting }">{{ roiHint }}</p>
        <dl class="stats primary-stats">
          <div v-for="key in primaryMetrics" :key="key">
            <dt>{{ text(key) }}</dt>
            <dd>
              {{
                number(store.status[key], key.endsWith('Frames') || key === 'queueDepth' ? 0 : 1)
              }}
            </dd>
          </div>
          <div>
            <dt>{{ text('saturationPercentage') }}</dt>
            <dd>{{ number(store.histogram?.saturationPercentage) }}</dd>
          </div>
        </dl>
        <progress
          v-if="store.status.targetFrames || store.status.targetDurationSeconds"
          :aria-label="text('recordingProgress')"
          :value="store.status.frameProgress ?? store.status.timeProgress ?? 0"
          max="1"
        />
        <p v-if="store.status.outputFilename" class="filename">{{ store.status.outputFilename }}</p>
        <p v-if="store.snapshotPath" class="filename">{{ store.snapshotPath }}</p>
        <p v-if="store.status.lastError || store.status.sidecarError" class="error" role="alert">
          {{ store.status.lastError || store.status.sidecarError }}
        </p>
        <IntensityHistogram :histogram="store.histogram" />
        <details class="card capture-details">
          <summary>{{ text('captureDetails') }}</summary>
          <dl class="stats compact-counters">
            <div v-for="key in detailMetrics" :key="key">
              <dt>{{ text(key) }}</dt>
              <dd>
                {{
                  number(store.status[key], key.endsWith('Frames') || key === 'queueDepth' ? 0 : 1)
                }}
              </dd>
            </div>
            <div>
              <dt>{{ text('disk') }}</dt>
              <dd>{{ number(store.status.freeDiskBytes / 1073741824) }} GiB</dd>
            </div>
          </dl>
          <p v-if="store.status.stopReason">
            {{ text('stopReason') }}: {{ store.status.stopReason }}
          </p>
          <p v-if="store.status.outputPath" class="filename">{{ store.status.outputPath }}</p>
        </details>
      </section>
      <section
        v-show="panel === 'camera' || (!compact && panel === 'preview')"
        id="lc-camera"
        class="controls"
        role="tabpanel"
        aria-labelledby="lc-tab-camera"
      >
        <div v-if="store.status.state === 'PREVIEWING'" class="notice">
          <p>{{ text('pauseToAdjust') }}</p>
          <button :disabled="busy" @click="invoke(togglePreview)">
            {{ text('pausePreview') }}
          </button>
        </div>
        <p v-else-if="recordingActive || finishing" class="notice">{{ text('recordingLocked') }}</p>
        <form ref="cameraForm" @submit.prevent="invoke(apply)">
          <fieldset class="settings-grid" :disabled="lock || !store.camera?.connected">
            <legend>{{ text('cameraControls') }}</legend>
            <CameraControl
              v-for="c in supportedControls.filter((c) => c.id !== 'usbLimit')"
              :key="c.id"
              :control="c"
              v-model="form[controlKey(c.id)]"
              :invalid="invalidControl === c.id"
            />
            <p v-if="showEightBitTip" class="field-help full-width speed-tip" role="note">
              {{ text('speedTipBitDepth') }}
              <button type="button" class="inline-action" @click="form.bitDepth = 8">
                {{ text('useEightBit') }}
              </button>
            </p>
            <details class="full-width advanced-settings">
              <summary>{{ text('advancedCamera') }}</summary>
              <div class="settings-grid">
                <label class="full-width"
                  >{{ text('acquisitionMode') }}
                  <select v-model="form.acquisitionMode" aria-describedby="lc-mode-help">
                    <option value="auto">{{ text('automaticStream') }}</option>
                    <option value="exposures">{{ text('repeatedExposures') }}</option>
                    <option v-if="store.capabilities?.stream?.previewOnly" value="preview">
                      {{ text('cameraPreview') }}
                    </option>
                  </select>
                </label>
                <p id="lc-mode-help" class="field-help full-width">
                  {{ text('helpAcquisitionMode') }}
                </p>
                <template
                  v-if="
                    store.capabilities?.stream?.available &&
                    !store.capabilities.stream.hardwareValidated
                  "
                >
                  <label class="check full-width"
                    ><input v-model="form.allowExperimentalStreaming" type="checkbox" />{{
                      text('experimentalStream')
                    }}</label
                  >
                  <label
                    class="check full-width"
                    v-if="store.capabilities.stream.requiresDriverReconnect"
                    ><input v-model="form.allowDriverReconnect" type="checkbox" />{{
                      text('driverReconnect')
                    }}</label
                  >
                  <label
                    class="check full-width"
                    v-if="store.capabilities.stream.backend === 'INDI'"
                    ><input v-model="form.allowStreamDepthReduction" type="checkbox" />{{
                      text('streamDepthReduction')
                    }}</label
                  >
                </template>
                <CameraControl
                  v-for="c in supportedControls.filter((c) => c.id === 'usbLimit')"
                  :key="c.id"
                  :control="c"
                  v-model="form[controlKey(c.id)]"
                  :invalid="invalidControl === c.id"
                />
              </div>
            </details>
            <template v-if="store.camera?.roiSupported"
              ><label v-if="roiPresetOptions.length" class="full-width"
                >{{ text('roiPreset') }}
                <select
                  :value="roiPresetValue"
                  aria-describedby="lc-roi-preset-help"
                  @change="applyRoiPreset($event.target.value)"
                >
                  <option value="full">{{ text('roiPresetFull') }}</option>
                  <option v-for="preset in roiPresetOptions" :key="preset.key" :value="preset.key">
                    {{ preset.roi.width }} × {{ preset.roi.height }}
                  </option>
                  <option v-if="roiPresetValue === 'custom'" value="custom" disabled>
                    {{ text('roiPresetCustom') }}
                  </option>
                </select></label
              >
              <p
                v-if="roiPresetOptions.length"
                id="lc-roi-preset-help"
                class="field-help full-width"
              >
                {{ text('helpRoiPreset') }}
              </p>
              <label class="check full-width"
                ><input v-model="useRoi" type="checkbox" aria-describedby="lc-roi-help" />
                {{ text('roi') }}</label
              >
              <p class="field-help full-width">{{ text('cameraPreferencesHelp') }}</p>
              <p id="lc-roi-help" class="field-help full-width">{{ text('helpRoi') }}</p>
              <p
                v-if="useRoi && store.status.roiMode === 'software'"
                role="status"
                class="field-help full-width"
              >
                {{ text('roiSoftware') }}
              </p>
              <div v-if="useRoi" class="roi-fields full-width">
                <label v-for="key in ['x', 'y', 'width', 'height']" :key="key"
                  >{{ text(`roi${key}`)
                  }}<input
                    v-model.number="roi[key]"
                    type="number"
                    inputmode="numeric"
                    required
                    :min="key === 'width' || key === 'height' ? 2 : 0"
                    step="2"
                /></label>
              </div>
            </template>
            <button class="full-width" type="submit">{{ text('apply') }}</button>
          </fieldset>
        </form>
      </section>
      <section
        v-show="panel === 'recording'"
        id="lc-recording"
        class="controls"
        role="tabpanel"
        aria-labelledby="lc-tab-recording"
      >
        <p class="hint">{{ text('recordingHelp') }}</p>
        <fieldset class="settings-grid" :disabled="busy || recordingActive || finishing">
          <legend>{{ text('recording') }}</legend>
          <div
            v-if="store.capabilities.customOutputDirectory"
            class="field full-width output-folder"
          >
            <span id="lc-folder-label" class="label">{{ text('outputDirectory') }}</span>
            <div class="folder-row">
              <output
                class="folder-path"
                aria-labelledby="lc-folder-label"
                aria-describedby="lc-help-outputDirectory"
                :class="{ unavailable: folderWarning }"
                >{{ effectiveFolder || '—' }}</output
              >
              <button
                type="button"
                :title="text('chooseFolderTitle')"
                @click="folderBrowserOpen = true"
              >
                {{ text('browseFolder') }}
              </button>
              <button
                v-if="recording.outputDirectory"
                type="button"
                @click="recording.outputDirectory = ''"
              >
                {{ text('useDefaultFolder') }}
              </button>
            </div>
            <p v-if="!recording.outputDirectory" class="field-help">
              {{ text('outputDirectoryIsDefault') }}
            </p>
            <p v-if="folderWarning" class="notice folder-warning" role="status">
              {{ folderWarning }}
            </p>
            <p id="lc-help-outputDirectory" class="field-help">{{ text('helpoutputDirectory') }}</p>
          </div>
          <label
            >{{ text('format')
            }}<select v-model="recording.format" aria-describedby="lc-format-help">
              <option value="ser">{{ text('formatSer') }}</option>
              <option value="avi" :disabled="!store.capabilities.avi">
                {{ text('formatAvi') }}
              </option>
            </select></label
          >
          <p id="lc-format-help" class="field-help full-width">{{ text('helpFormat') }}</p>
          <div
            v-for="key in ['frameLimit', 'durationSeconds', 'playbackFps']"
            :key="key"
            v-show="key !== 'playbackFps' || recording.format === 'avi'"
            class="field"
          >
            <label :for="`lc-record-${key}`">{{ text(key) }}</label>
            <input
              :id="`lc-record-${key}`"
              :aria-describedby="`lc-help-${key}`"
              v-model.number="recording[key]"
              type="number"
              :inputmode="key === 'frameLimit' ? 'numeric' : 'decimal'"
              :min="key === 'durationSeconds' ? 0.01 : 1"
              :step="key === 'durationSeconds' ? 'any' : 1"
            />
            <p :id="`lc-help-${key}`" class="field-help">{{ text(`help${key}`) }}</p>
          </div>
          <details class="full-width recording-details">
            <summary>{{ text('fileSettings') }}</summary>
            <div class="settings-grid">
              <div
                v-for="key in ['target', 'filter', 'relativeDirectory', 'filenameTemplate']"
                :key="key"
                class="field"
              >
                <label :for="`lc-file-${key}`">{{ text(key) }}</label>
                <input
                  :id="`lc-file-${key}`"
                  :aria-describedby="`lc-help-${key}`"
                  v-model="recording[key]"
                  type="text"
                  autocomplete="off"
                />
                <p :id="`lc-help-${key}`" class="field-help">{{ text(`help${key}`) }}</p>
              </div>
            </div>
          </details>
        </fieldset>
        <p class="hint">{{ text('rawNote') }}</p>
        <FileBrowser
          v-model="folderBrowserOpen"
          mode="directory"
          :title="text('chooseFolderTitle')"
          :initial-path="effectiveFolder"
          @select="recording.outputDirectory = $event"
        />
      </section>
      <section
        v-show="panel === 'focus'"
        id="lc-focus"
        class="controls"
        role="tabpanel"
        aria-labelledby="lc-tab-focus"
      >
        <FocusPanel
          ref="focusPanel"
          :compact="compact"
          @changed="
            selection = null;
            invoke(load);
          "
          @select-roi="selectFocusRoi"
          @busy="focusBusy = $event"
          @status="focusStatus = $event"
        />
      </section>
    </div>
  </main>
</template>

<style scoped>
.stats.compact-counters {
  gap: 0.35rem 0.75rem;
}
.compact-counters > div {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: baseline;
}
.compact-counters dt {
  font-size: 0.8rem;
}
.compact-counters dd {
  font-size: 0.9rem;
  white-space: nowrap;
}
.field-help {
  color: var(--lc-muted);
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0.35rem 0 0;
  overflow-wrap: anywhere;
}
.field {
  min-width: 0;
}
.output-folder .label {
  display: block;
  margin-bottom: 0.35rem;
}
.folder-row {
  display: flex;
  gap: 0.5rem;
  align-items: stretch;
  min-width: 0;
}
.folder-path {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  white-space: nowrap;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--lc-border);
  border-radius: 0.5rem;
  font-family: ui-monospace, monospace;
  font-size: 0.875rem;
}
.folder-path.unavailable {
  border-color: #f59e0b;
}
.folder-row button {
  flex-shrink: 0;
}
.folder-warning {
  margin-top: 0.5rem;
}
.speed-tip .inline-action {
  margin-left: 0.25rem;
}
.lc {
  --lc-border: #69758a;
  --lc-muted: #b8c5d8;
  max-width: 1200px;
  margin: auto;
  padding: 1rem;
  color: var(--color-content, #e2e8f0);
}
.lc *,
.lc *::before,
.lc *::after {
  box-sizing: border-box;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}
.heading {
  min-width: 0;
}
h1 {
  font-size: 1.4rem;
  font-weight: 700;
}
.heading p {
  color: var(--lc-muted);
  overflow-wrap: anywhere;
}
button,
input:not([type='checkbox']),
select,
output {
  min-height: 48px;
  border: 1px solid var(--lc-border);
  border-radius: var(--radius-control, 12px);
  padding: 0.6rem 0.75rem;
  font: inherit;
  font-size: 1rem;
  color: inherit;
}
button {
  cursor: pointer;
  background: var(--color-surface-2, #1a2336);
  line-height: 1.35;
  min-width: 48px;
  touch-action: manipulation;
  overflow-wrap: anywhere;
}
button:disabled {
  cursor: default;
  opacity: 0.5;
}
button:not(:disabled):hover {
  filter: brightness(1.15);
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid var(--color-accent, #22d3ee);
  outline-offset: 3px;
}
.capture-toolbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem;
  border: 1px solid var(--lc-border);
  border-radius: var(--radius-card, 14px);
  background: var(--color-ground, #0a0f1c);
  box-shadow: 0 3px 12px #0005;
  margin-bottom: 0.75rem;
}
.session-state {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  font-weight: 600;
  font-size: 0.9rem;
}
.state-dot {
  width: 0.65rem;
  height: 0.65rem;
  background: #94a3b8;
  border-radius: 50%;
  flex-shrink: 0;
}
.running .state-dot {
  background: #34d399;
}
:global(.app-portrait .capture-toolbar) {
  top: calc(82px + var(--subnav-offset, 0px) + var(--stage-inset, 6px));
}
:global(.app-landscape .capture-toolbar) {
  top: calc(var(--subnav-offset, 0px) + var(--stage-inset, 6px));
}
.primary-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}
.primary-actions button {
  min-width: 150px;
  font-weight: 700;
}
.preview-action {
  background: #036682;
  border-color: #22d3ee;
  color: #fff;
}
.record-action {
  background: #a3342b;
  border-color: #fb938a;
  color: #fff;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
  grid-template-rows: min-content 1fr;
  gap: 0.75rem 1rem;
  align-items: start;
}
.visual {
  grid-column: 1;
  grid-row: 1 / span 2;
  min-width: 0;
}
.controls {
  grid-column: 2;
  min-width: 0;
}
.section-tabs {
  grid-column: 2;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.35rem;
}
.section-tabs button {
  border-color: transparent;
  background: var(--color-surface-1, #111827);
  font-weight: 600;
  padding: 0.6rem 0.25rem;
}
.section-tabs button[aria-selected='true'] {
  border-color: #22d3ee;
  color: #22d3ee;
  background: #123047;
}
.preview {
  --preview-height: clamp(200px, 40vh, 360px);
  position: relative;
  height: var(--preview-height);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #080b10;
  border: 1px solid var(--lc-border);
  border-radius: var(--radius-card, 14px);
}
.preview-frame.rotated {
  transform: rotate(180deg);
}
.preview-frame {
  position: relative;
  max-width: 100%;
  line-height: 0;
  user-select: none;
  touch-action: pan-y pinch-zoom;
}
.selecting .preview-frame {
  touch-action: none;
  cursor: crosshair;
}
.selecting {
  border-color: #22d3ee;
}
.preview img {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: var(--preview-height);
  display: block;
}
.empty-preview {
  padding: 1rem;
  text-align: center;
}
.selection {
  position: absolute;
  border: 2px solid #ffb850;
  background: #ffb85022;
  pointer-events: none;
}
.preview-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.6rem;
}
.preview-tools button {
  flex: 1;
  min-height: 44px;
  min-width: 7rem;
}
.roi-navigation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.6rem 1rem;
  margin-top: 0.6rem;
}
.roi-pad {
  display: grid;
  grid-template-columns: repeat(3, 44px);
  grid-template-rows: repeat(3, 44px);
  gap: 4px;
}
.roi-pad button {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  font-size: 1.4rem;
}
.roi-up {
  grid-area: 1 / 2;
}
.roi-left {
  grid-area: 2 / 1;
}
.roi-right {
  grid-area: 2 / 3;
}
.roi-down {
  grid-area: 3 / 2;
}
.roi-position {
  min-width: 0;
  align-self: center;
}
.roi-position select {
  width: 100%;
  min-height: 44px;
}
.roi-position p {
  overflow-wrap: anywhere;
}
.roi-navigation > p {
  grid-column: 1 / -1;
  margin: 0;
}
.hint,
dt {
  color: var(--lc-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}
.hint {
  margin: 0.5rem 0;
}
.selectingHint {
  color: #22d3ee;
}
.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  margin: 0.75rem 0;
  font-variant-numeric: tabular-nums;
}
.stats div {
  min-width: 0;
}
dt {
  overflow-wrap: anywhere;
}
dd {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}
.primary-stats {
  padding: 0.75rem;
  border-radius: var(--radius-card, 14px);
  background: var(--color-surface-1, #111827);
}
.card,
fieldset {
  min-width: 0;
  border: 1px solid var(--lc-border);
  border-radius: var(--radius-card, 14px);
  padding: 0.8rem;
}
legend {
  padding: 0 0.3rem;
  font-weight: 700;
}
label {
  display: block;
  font-size: 0.9rem;
  line-height: 1.45;
}
input:not([type='checkbox']),
select,
output {
  display: block;
  width: 100%;
  margin-top: 0.25rem;
  background: var(--color-surface-1, #111827);
}
input[type='checkbox'] {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  accent-color: #22d3ee;
}
select option {
  background: #111827;
  color: #e2e8f0;
}
.check {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  min-height: 48px;
  padding: 0.4rem 0;
}
.settings-grid,
.roi-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}
.full-width {
  grid-column: 1 / -1;
}
summary {
  cursor: pointer;
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-weight: 600;
  list-style: none;
}
summary::before {
  content: '\203A';
  font-size: 1.4rem;
}
details[open] > summary::before {
  transform: rotate(90deg);
}
details > div {
  margin-top: 0.5rem;
}

.error,
.notice {
  overflow-wrap: anywhere;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  border-radius: 0.5rem;
}
.error {
  color: #ffb5ae;
  border: 1px solid #ff978a;
  background: #381a22;
}
.notice {
  background: #1a2336;
  color: #d4ddeb;
}
.notice button {
  margin-top: 0.6rem;
}
progress {
  display: block;
  width: 100%;
  margin: 0.75rem 0;
  accent-color: #22d3ee;
}
.filename {
  overflow-wrap: anywhere;
  font-size: 0.875rem;
  margin: 0.5rem 0;
}
.compact {
  & {
    padding: 0.65rem;
    padding-bottom: calc(0.65rem + env(safe-area-inset-bottom, 0px));
  }
  .layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto;
  }
  .visual,
  .controls,
  .section-tabs {
    grid-column: 1;
    grid-row: auto;
  }
  .section-tabs {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .section-tabs button {
    font-size: clamp(0.75rem, 3.4vw, 0.875rem);
    overflow-wrap: normal;
    word-break: normal;
  }
  .capture-toolbar {
    display: block;
    padding: 0.5rem;
  }
  .session-state {
    margin: 0 0 0.45rem 0.2rem;
  }
  .primary-actions button {
    min-width: 0;
    width: 100%;
  }
  .primary-actions {
    width: 100%;
  }
  .preview {
    --preview-height: clamp(180px, 34vh, 300px);
  }
}
@supports (height: 1dvh) {
  .preview {
    --preview-height: clamp(200px, 40dvh, 360px);
  }
  .compact .preview {
    --preview-height: clamp(180px, 34dvh, 300px);
  }
}
@media (max-width: 360px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .roi-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .page-header {
    gap: 0.4rem;
  }
  h1 {
    font-size: 1.2rem;
  }
}
@media (max-height: 500px) and (orientation: landscape) {
  .preview {
    --preview-height: 180px;
  }
  .capture-toolbar {
    display: flex;
  }
  .session-state {
    margin: 0;
  }
  .primary-actions {
    flex: 2;
    width: auto;
  }
}
.focus-selection {
  border-color: #22d3ee;
  background: #22d3ee12;
  pointer-events: none;
}
.focus-selection span {
  position: absolute;
  top: 0;
  left: 0;
  padding: 2px 4px;
  color: #fff;
  background: #102d3d;
  font-size: 12px;
}
.compact .visual.mount-centering .preview {
  --preview-height: clamp(140px, 24vh, 200px);
}
@supports (height: 1dvh) {
  .compact .visual.mount-centering .preview {
    --preview-height: clamp(140px, 24dvh, 200px);
  }
}
</style>
