<template>
  <div class="flex flex-col gap-2">
    <h4 class="text-sm font-semibold text-content">{{ t(`${K}.historyTitle`) }}</h4>
    <p v-if="!entries.length" class="tns-label">{{ t(`${K}.historyEmpty`) }}</p>
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="entry in entries"
        :key="entry.Id"
        class="flex flex-col gap-1 p-2 bg-ground/40 border border-line rounded-lg"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="tns-label min-w-0 flex-1">
            {{ formatTime(entry.LastTimeUtc || entry.TimeUtc) }}
            · {{ categoryLabel(entry) }}
            <span v-if="entry.Count > 1"
              >· {{ t(`${K}.historyCount`, { count: entry.Count }) }}</span
            >
          </span>
          <span
            class="shrink-0 max-w-[45%] text-xs font-semibold text-right"
            :class="TONE_CLASSES[outcomeTone(entry.Outcome)]"
          >
            {{ outcomeLabel(entry.Outcome) }}
          </span>
        </div>
        <p class="text-xs text-content break-words line-clamp-2" :title="entry.Reason || ''">
          {{ entry.Message }}
        </p>
        <button
          v-if="canExcludeEntry(entry) && !isExcluded(entry)"
          type="button"
          class="self-start min-h-touch text-xs text-accent underline"
          @click="emit('exclude', entry)"
        >
          {{ t(`${K}.excludeThis`) }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import { canExcludeEntry, outcomeTone, parseServerUtc } from '../utils/alarm.js';

const K = 'plugins.pinsDevices.config.alarm';

const props = defineProps({
  entries: { type: Array, default: () => [] },
  // Box clock minus phone clock
  clockOffsetMs: { type: Number, default: 0 },
  // The current "never beep for" entries: an entry already in it gets no button
  exclusions: { type: Array, default: () => [] },
});
const emit = defineEmits(['exclude']);

const { t, te } = useI18n();

const TONE_CLASSES = {
  danger: 'text-status-danger',
  warn: 'text-status-warn',
  muted: 'text-content-muted',
};

function isExcluded(entry) {
  const key = (entry.Key ?? '').trim().toLowerCase();
  return props.exclusions.some((e) => e.toLowerCase() === key);
}

function formatTime(utc) {
  const date = parseServerUtc(utc, props.clockOffsetMs);
  return date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}

function categoryLabel(entry) {
  if (entry.Origin === 'Test') return t(`${K}.historyTest`);
  const key = `${K}.categories.${entry.Category}`;
  return te(key) ? t(key) : entry.Category;
}

function outcomeLabel(outcome) {
  const key = `${K}.outcome.${outcome}`;
  return te(key) ? t(key) : outcome;
}
</script>
