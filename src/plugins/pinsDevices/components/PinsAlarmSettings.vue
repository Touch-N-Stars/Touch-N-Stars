<template>
  <section class="tns-card flex flex-col gap-4">
    <div class="flex flex-col gap-1">
      <h3 class="tns-section-title">{{ t(`${K}.title`) }}</h3>
      <p v-if="!alarm.unsupportedHere" class="tns-label">{{ t(`${K}.intro`) }}</p>
    </div>

    <!-- A box whose plugin has no alarm yet -->
    <p v-if="alarm.unsupportedHere" class="text-sm text-status-warn">
      {{ t(`${K}.updateRequired`) }}
    </p>

    <template v-else-if="!alarm.settings">
      <div v-if="alarm.loadError" class="flex flex-col gap-2">
        <p class="text-sm text-status-danger">{{ t(`${K}.loadFailed`) }}</p>
        <button type="button" class="tns-btn-secondary w-auto!" @click="load">
          {{ t(`${K}.retry`) }}
        </button>
      </div>
      <div v-else class="flex items-center gap-2 tns-label">
        <Spinner size="sm" />
        <span>{{ t('common.loading') }}</span>
      </div>
    </template>

    <template v-else>
      <!-- Status -->
      <div v-if="statusLine" class="flex flex-col gap-1">
        <div class="flex items-center gap-2 text-sm text-content">
          <span class="tns-dot" :class="DOT_CLASSES[statusLine.tone]" />
          <span class="min-w-0">
            {{ t(`${K}.status.${statusLine.key}`, statusLine.params) }}
            <span v-if="alarm.status?.Bursting" class="text-status-danger font-semibold">
              · {{ t(`${K}.status.bursting`) }}
            </span>
          </span>
        </div>
      </div>

      <!-- On/off -->
      <div class="tns-field-row min-h-touch">
        <span class="text-sm text-content">{{ t(`${K}.enabled`) }}</span>
        <toggleButton
          :status-value="!!alarm.settings.Enabled"
          :disabled="alarm.saving"
          @click="alarm.saveSettings((s) => ({ Enabled: !s.Enabled }))"
        />
      </div>

      <!-- Categories -->
      <div class="flex flex-col gap-2" :class="{ 'opacity-50': !alarm.settings.Enabled }">
        <h4 class="text-sm font-semibold text-content">{{ t(`${K}.categoriesTitle`) }}</h4>
        <div v-for="category in ALARM_CATEGORIES" :key="category" class="tns-field-row min-h-touch">
          <div class="flex flex-col">
            <span class="text-sm text-content">{{ t(`${K}.categories.${category}`) }}</span>
            <span class="tns-label">{{ t(`${K}.categoryHints.${category}`) }}</span>
          </div>
          <toggleButton
            :status-value="!!alarm.settings.Categories?.[category]"
            :disabled="alarm.saving"
            @click="toggleCategory(category)"
          />
        </div>
        <p class="tns-label">{{ t(`${K}.categoriesHint`) }}</p>
      </div>

      <!-- Sound -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <NumberInputPicker
          v-model="local.Volume"
          inputId="pins-alarm-volume"
          :labelKey="`${K}.volume`"
          :label="t(`${K}.volume`)"
          labelPosition="top"
          wrapperClass="w-full"
          :useDefaultSentinel="false"
          v-bind="ALARM_LIMITS.Volume"
          @change="queueSave('Volume')"
          @blur="flushPending"
        />
        <NumberInputPicker
          v-model="local.BurstSeconds"
          inputId="pins-alarm-burst"
          :labelKey="`${K}.burstSeconds`"
          :label="t(`${K}.burstSeconds`)"
          labelPosition="top"
          wrapperClass="w-full"
          :useDefaultSentinel="false"
          v-bind="ALARM_LIMITS.BurstSeconds"
          @change="queueSave('BurstSeconds')"
          @blur="flushPending"
        />
      </div>

      <!-- Never beep for (removable while there are entries) -->
      <div v-if="exclusions.length" class="flex flex-col gap-2">
        <h4 class="text-sm font-semibold text-content">{{ t(`${K}.exclusionsTitle`) }}</h4>
        <div v-for="entry in exclusions" :key="entry" class="tns-field-row">
          <span class="text-xs text-content break-all">{{ entry }}</span>
          <button
            type="button"
            class="tns-btn-secondary w-auto! px-2! text-xs! shrink-0"
            :aria-label="t(`${K}.removeExclusion`)"
            @click="alarm.removeExclusion(entry)"
          >
            {{ t(`${K}.removeExclusion`) }}
          </button>
        </div>
      </div>

      <!-- Advanced -->
      <button
        type="button"
        class="flex items-center justify-between w-full min-h-touch text-xs text-content-muted hover:text-content transition-colors"
        :aria-expanded="showAdvanced"
        @click="showAdvanced = !showAdvanced"
      >
        <span>{{ t(`${K}.advanced`) }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-180': showAdvanced }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      <div v-if="showAdvanced" class="flex flex-col gap-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberInputPicker
            v-for="field in ADVANCED_FIELDS"
            :key="field.name"
            v-model="local[field.name]"
            :inputId="`pins-alarm-${field.name}`"
            :labelKey="`${K}.${field.labelKey}`"
            :label="t(`${K}.${field.labelKey}`)"
            labelPosition="top"
            wrapperClass="w-full"
            :useDefaultSentinel="false"
            v-bind="ALARM_LIMITS[field.name]"
            @change="queueSave(field.name)"
            @blur="flushPending"
          />
        </div>
        <p class="tns-label">{{ t(`${K}.graceHint`) }}</p>

        <div class="flex flex-col gap-2">
          <h4 class="text-sm font-semibold text-content">{{ t(`${K}.addExclusionTitle`) }}</h4>
          <div class="flex gap-2">
            <input
              v-model="newExclusion"
              type="text"
              class="tns-input min-w-0"
              :placeholder="t(`${K}.exclusionPlaceholder`)"
              @keyup.enter="addExclusion"
            />
            <button type="button" class="tns-btn-secondary w-auto! shrink-0" @click="addExclusion">
              {{ t(`${K}.addExclusion`) }}
            </button>
          </div>
          <p v-if="exclusionError" class="text-xs text-status-danger">
            {{ t(`${K}.exclusionErrors.${exclusionError}`) }}
          </p>
          <p class="tns-label">{{ t(`${K}.exclusionsHint`) }}</p>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-col sm:flex-row gap-2">
        <button type="button" class="tns-btn-primary" :disabled="alarm.testing" @click="test">
          <Spinner v-if="alarm.testing" size="sm" />
          <span>{{ t(`${K}.test`) }}</span>
        </button>
        <button
          type="button"
          class="tns-btn-secondary"
          :disabled="alarm.silencing"
          @click="alarm.silence(SILENCE_MINUTES)"
        >
          {{ t(`${K}.silence`, { minutes: SILENCE_MINUTES }) }}
        </button>
        <button
          v-if="isMuted"
          type="button"
          class="tns-btn-secondary"
          :disabled="alarm.silencing"
          @click="alarm.silence(0)"
        >
          {{ t(`${K}.endMute`) }}
        </button>
      </div>
      <p
        v-if="testText"
        class="text-sm"
        :class="alarm.testResult?.kind === 'ok' ? 'text-status-ok' : 'text-status-danger'"
      >
        {{ testText }}
      </p>
      <p v-if="alarm.saveError" class="text-sm text-status-danger">
        {{ t(`${K}.saveFailed`, { reason: alarm.saveError }) }}
      </p>

      <PinsAlarmHistory
        :entries="alarm.history"
        :clockOffsetMs="alarm.clockOffsetMs"
        :exclusions="exclusions"
        @exclude="excludeEntry"
      />
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import toggleButton from '@/components/helpers/toggleButton.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import PinsAlarmHistory from './PinsAlarmHistory.vue';
import { usePinsAlarmStore } from '../store/pinsAlarmStore.js';
import {
  ALARM_CATEGORIES,
  ALARM_LIMITS,
  SILENCE_MINUTES,
  alarmStatusLine,
  parseServerUtc,
} from '../utils/alarm.js';

const K = 'plugins.pinsDevices.config.alarm';
const SAVE_DELAY_MS = 600;
const POLL_MS = 5000;

const ADVANCED_FIELDS = [
  { name: 'ToneMs', labelKey: 'toneMs' },
  { name: 'PauseMs', labelKey: 'pauseMs' },
  { name: 'GraceMinutes', labelKey: 'graceMinutes' },
  { name: 'ThrottleMinutes', labelKey: 'throttleMinutes' },
];
const NUMBER_FIELDS = ['Volume', 'BurstSeconds', ...ADVANCED_FIELDS.map((f) => f.name)];

const DOT_CLASSES = {
  ok: 'bg-status-ok',
  warn: 'bg-status-warn',
  danger: 'bg-status-danger',
  muted: 'bg-content-faint',
};

const props = defineProps({
  // The card is visible (its tabs use v-show)
  active: { type: Boolean, default: false },
});

const { t } = useI18n();
const alarm = usePinsAlarmStore();

const showAdvanced = ref(false);
const newExclusion = ref('');
const exclusionError = ref(null);
const nowMs = ref(Date.now());

// Local copy of the number fields: edited freely, saved after a short pause. A field that waits
// for its save, or whose save is on its way, is not overwritten by settings that come back.
const local = reactive(Object.fromEntries(NUMBER_FIELDS.map((f) => [f, 0])));
const pending = new Set();
const inFlight = new Map();
let saveTimer = null;

function syncLocal(settings) {
  if (!settings) return;
  for (const field of NUMBER_FIELDS) {
    const busy = pending.has(field) || (inFlight.get(field) ?? 0) > 0;
    if (!busy && typeof settings[field] === 'number') {
      const limits = ALARM_LIMITS[field];
      local[field] = Math.min(Math.max(settings[field], limits.min), limits.max);
    }
  }
}
watch(
  () => alarm.settings,
  (settings) => syncLocal(settings),
  { immediate: true }
);

function queueSave(field) {
  pending.add(field);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushPending, SAVE_DELAY_MS);
}

async function flushPending() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!pending.size) return;
  const fields = [...pending];
  const patch = {};
  for (const field of fields) {
    patch[field] = Math.round(Number(local[field]));
    inFlight.set(field, (inFlight.get(field) ?? 0) + 1);
  }
  pending.clear();
  const result = await alarm.saveSettings(patch);
  for (const field of fields) inFlight.set(field, inFlight.get(field) - 1);
  if (result === 'cancelled') {
    // Not sent (the app came back from the background): send it again shortly
    for (const field of fields) pending.add(field);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushPending, SAVE_DELAY_MS);
  } else {
    // Saved or refused: show what PINS has now (the stored, rounded value)
    const box = alarm.settings ?? {};
    for (const field of fields) {
      if (
        !pending.has(field) &&
        (inFlight.get(field) ?? 0) === 0 &&
        typeof box[field] === 'number'
      ) {
        local[field] = box[field];
      }
    }
  }
}

function toggleCategory(category) {
  alarm.saveSettings((s) => ({ Categories: { [category]: !s.Categories?.[category] } }));
}

async function load() {
  await alarm.loadSettings();
  await alarm.refreshLive();
}

// Settings load whenever the card becomes visible; status and history refresh while it is
const isActive = computed(() => props.active && !alarm.unsupportedHere && !!alarm.settings);
useBackgroundAwarePolling(
  async () => {
    nowMs.value = Date.now();
    await alarm.refreshLive();
  },
  POLL_MS,
  isActive,
  { immediate: true }
);
watch(
  () => props.active,
  (on) => {
    if (on) {
      alarm.loadSettings();
    } else {
      flushPending();
    }
  },
  { immediate: true }
);
onBeforeUnmount(flushPending);

const exclusions = computed(() => alarm.settings?.Exclusions ?? []);

const mutedUntil = computed(() => parseServerUtc(alarm.status?.MutedUntilUtc, alarm.clockOffsetMs));
const isMuted = computed(() => !!mutedUntil.value && mutedUntil.value.getTime() > nowMs.value);
const statusLine = computed(() => alarmStatusLine(alarm.status, mutedUntil.value, nowMs.value));

const testText = computed(() => {
  const r = alarm.testResult;
  if (!r || r.kind === 'cancelled') return '';
  switch (r.kind) {
    case 'ok':
      return t(`${K}.testOk`, { count: r.tones });
    case 'noPowerBox':
      return t(`${K}.testNoPowerBox`);
    case 'notSupported':
      return t(`${K}.testNotSupported`);
    case 'unreachable':
      return t(`${K}.unreachable`);
    default:
      return t(`${K}.testFailed`, { reason: r.reason || '-' });
  }
});

function test() {
  flushPending();
  alarm.testBeep({
    Volume: Math.round(local.Volume),
    ToneMs: Math.round(local.ToneMs),
    PauseMs: Math.round(local.PauseMs),
    BurstSeconds: Math.round(local.BurstSeconds),
  });
}

async function addExclusion() {
  const reason = await alarm.addExclusion(newExclusion.value);
  exclusionError.value = reason === 'save' ? null : reason;
  if (!reason) newExclusion.value = '';
}

async function excludeEntry(entry) {
  await alarm.addExclusion(entry.Key);
}
</script>
