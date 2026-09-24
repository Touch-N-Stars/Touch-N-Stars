<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatSegmentDuration, summarizeExposurePlan, isSegmentNow } from '../calculations';

const props = defineProps({
  segments: { type: Array, required: true },
});

const { t } = useI18n();

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const formatDuration = formatSegmentDuration;
const exposureSummary = summarizeExposurePlan;

const rows = computed(() =>
  props.segments.map((s, i) => ({
    key: `${s.Id || 'wait'}-${i}`,
    isWait: s.WaitPeriod || !s.Id,
    name: s.Name,
    start: s.StartTime,
    end: s.EndTime,
    summary: exposureSummary(s.ExposurePlan || []),
    isNow: isSegmentNow(s),
  }))
);
</script>

<template>
  <div class="rounded-lg bg-surface-1 p-3">
    <p class="mb-3 flex items-start gap-1.5 text-[11px] text-content-faint">
      <svg
        class="mt-0.5 h-3.5 w-3.5 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0Zm-9-3.75h.008v.008H12V8.25Z"
        />
      </svg>
      <span>
        {{ t('plugins.targetSchedulerViewer.schedulePreview.disclaimer') }}
        <a
          href="https://tcpalmer.github.io/nina-scheduler/concepts/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent underline"
          >{{ t('plugins.targetSchedulerViewer.schedulePreview.learnMore') }}</a
        >
      </span>
    </p>

    <div v-if="!rows.length" class="text-sm text-content-faint">
      {{ t('plugins.targetSchedulerViewer.schedulePreview.noScheduleData') }}
    </div>

    <ol v-else class="relative space-y-1 border-l border-line pl-4">
      <li v-for="row in rows" :key="row.key" class="relative">
        <span
          class="absolute -left-[21px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full shadow-[0_0_0_3px_var(--color-surface-1)]"
          :class="row.isWait ? 'bg-surface-3' : row.isNow ? 'bg-status-ok' : 'bg-accent'"
        />
        <div
          class="rounded px-2 py-1.5 text-xs"
          :class="row.isNow ? 'bg-status-ok/15' : 'bg-transparent'"
        >
          <div class="flex items-center gap-3">
            <span class="tabular-nums text-content-faint">
              {{ formatTime(row.start) }}–{{ formatTime(row.end) }}
            </span>
            <span class="tabular-nums text-content-faint">
              ({{ formatDuration(row.start, row.end) }})
            </span>
          </div>

          <div v-if="row.isWait" class="mt-1 flex items-center gap-2">
            <svg
              class="h-3.5 w-3.5 shrink-0 text-content-faint"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998Z"
              />
            </svg>
            <span class="italic text-content-faint">{{
              t('plugins.targetSchedulerViewer.schedulePreview.waitingNotVisible')
            }}</span>
          </div>
          <template v-else>
            <div class="mt-1 font-medium">{{ row.name }}</div>
            <div class="break-words text-content-muted">{{ row.summary }}</div>
          </template>
        </div>
      </li>
    </ol>
  </div>
</template>
