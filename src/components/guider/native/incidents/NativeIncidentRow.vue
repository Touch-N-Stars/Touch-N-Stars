<template>
  <li
    class="tns-card p-3! flex flex-col gap-2"
    :class="incident.kept ? 'border-accent/40!' : ''"
    data-testid="native-guider-incident"
  >
    <div class="flex items-start gap-2">
      <!-- Summary: tapping it opens the replay -->
      <button
        type="button"
        class="flex min-w-0 flex-1 flex-col gap-1 text-left"
        @click="emit('replay', incident.id)"
      >
        <!-- Screen readers hear the action first, then the whole summary -->
        <span class="sr-only">{{ k('replayButton') }}:</span>
        <span class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span class="text-sm font-semibold text-content tabular-nums">
            {{ dateTime(incident.start) }}
          </span>
          <span class="text-sm text-content">{{ kindsText }}</span>
          <span
            v-if="incident.occurrences > 1"
            class="rounded-chip bg-surface-3 px-1.5 text-[11px] font-semibold tabular-nums text-content"
          >
            {{ k('occurrences', { count: incident.occurrences }) }}
          </span>
          <span
            v-if="incident.ongoing"
            class="rounded-chip border border-status-warn/40 bg-status-warn/10 px-1.5 text-[11px] font-semibold text-status-warn"
          >
            {{ k('ongoing') }}
          </span>
          <span
            v-if="recording"
            class="inline-flex items-center gap-1 text-[11px] font-semibold text-status-danger"
          >
            <span class="tns-dot bg-status-danger animate-pulse"></span>
            {{ k('recording') }}
          </span>
        </span>

        <span class="text-sm" :class="incident.cause ? 'text-accent' : 'text-content-muted'">
          {{ incident.cause ? likely(incident.cause) : k('analysing') }}
        </span>

        <span
          class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-content-muted tabular-nums"
        >
          <span>{{ duration }}</span>
          <span aria-hidden="true">·</span>
          <span :class="endReasonClass">{{ endReason(incident.endReason) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ k('frames', { count: incident.frameCount ?? 0 }) }}</span>
          <span aria-hidden="true">·</span>
          <span>{{ formatBytes(incident.sizeBytes) }}</span>
        </span>

        <span v-if="tags.length || incident.tags?.simulator" class="flex flex-wrap gap-1">
          <span
            v-if="incident.tags?.simulator"
            class="rounded-chip border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent"
          >
            {{ k('simulator') }}
          </span>
          <span
            v-for="tag in tags"
            :key="tag.key"
            class="max-w-full truncate rounded-chip bg-surface-2 px-1.5 py-0.5 text-[10px] text-content-muted"
            :class="tag.key === 'profile' && !ownProfile ? 'border border-line-strong' : ''"
            :title="tag.text"
          >
            {{ tag.text }}
          </span>
        </span>

        <span v-if="incident.framesOmitted" class="text-[11px] text-status-warn">
          {{ framesOmittedText }}
        </span>
        <span v-if="incident.note" class="text-xs italic text-content break-words">
          “{{ incident.note }}”
        </span>
      </button>

      <!-- Kept pin -->
      <span v-if="incident.kept" class="shrink-0" :title="k('kept')">
        <BookmarkSolidIcon class="h-5 w-5 text-accent" />
        <span class="sr-only">{{ k('kept') }}</span>
      </span>
    </div>

    <!-- Actions: two columns on phones, four would clip the labels (e.g. German) -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
      <button
        type="button"
        class="tns-btn-primary px-1! text-xs! gap-1!"
        @click="emit('replay', incident.id)"
      >
        <PlayCircleIcon class="h-4 w-4 shrink-0" />
        {{ k('replayButton') }}
      </button>
      <button
        type="button"
        class="tns-btn-secondary px-1! text-xs! gap-1!"
        :disabled="busy"
        :title="incident.kept ? k('releaseHint') : k('keepHint')"
        :aria-pressed="incident.kept === true"
        @click="toggleKeep"
      >
        <component
          :is="incident.kept ? BookmarkSlashIcon : BookmarkIcon"
          class="h-4 w-4 shrink-0"
        />
        {{ incident.kept ? k('release') : k('keep') }}
      </button>
      <button
        type="button"
        class="tns-btn-secondary px-1! text-xs! gap-1!"
        :disabled="!!downloading"
        :title="k('download')"
        @click="download(incident.id)"
      >
        <ArrowDownTrayIcon
          class="h-4 w-4 shrink-0"
          :class="{ 'animate-pulse': downloading === incident.id }"
        />
        {{ k('download') }}
      </button>
      <button
        type="button"
        class="tns-btn-danger px-1! text-xs! gap-1!"
        :class="confirmDelete ? 'bg-status-danger/15!' : ''"
        :disabled="busy"
        @click="remove"
      >
        <TrashIcon class="h-4 w-4 shrink-0" />
        {{ confirmDelete ? k('deleteConfirm') : k('delete') }}
      </button>
    </div>
  </li>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import {
  ArrowDownTrayIcon,
  BookmarkIcon,
  BookmarkSlashIcon,
  PlayCircleIcon,
  TrashIcon,
} from '@heroicons/vue/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/vue/24/solid';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import {
  formatBytes,
  formatIncidentDuration,
  incidentDurationSeconds,
} from '@/utils/nativeGuiderIncidents';
import { useIncidentDownload } from './useIncidentDownload';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  /** AdvancedIncidentSummary. */
  incident: { type: Object, required: true },
  /** This incident is being recorded again right now (an ongoing incident). */
  recording: { type: Boolean, default: false },
  /** It belongs to the current profile. */
  ownProfile: { type: Boolean, default: true },
});
const emit = defineEmits(['replay']);

const store = useNativeGuiderStore();
const { k, te, kinds, likely, dateTime, endReason } = useIncidentText();
const { downloading, download } = useIncidentDownload();

const confirmDelete = ref(false);
let confirmTimer = null;

const busy = computed(() => !!store.incidentPending);
const kindsText = computed(() => kinds(props.incident));
const duration = computed(() => formatIncidentDuration(incidentDurationSeconds(props.incident)));

const endReasonClass = computed(() => {
  switch (String(props.incident.endReason || '').toLowerCase()) {
    case 'recovered':
      return 'text-status-ok';
    case 'stopped':
    case 'cap':
      return 'text-status-warn';
    default:
      return '';
  }
});

const tags = computed(() => {
  const t = props.incident.tags || {};
  return [
    { key: 'profile', text: t.profileName },
    { key: 'camera', text: t.guideCamera },
    { key: 'mount', text: t.mount },
  ].filter((tag) => tag.text);
});

const framesOmittedText = computed(() => {
  const reason = props.incident.framesOmitted;
  const key = `components.guider.native.incidents.framesOmitted.${reason}`;
  return te(key) ? k(`framesOmitted.${reason}`) : reason;
});

async function toggleKeep() {
  await store.keepIncident(props.incident.id, !props.incident.kept, { title: k('actionFailed') });
}

async function remove() {
  if (!confirmDelete.value) {
    confirmDelete.value = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirmDelete.value = false), 4000);
    return;
  }
  clearTimeout(confirmTimer);
  confirmDelete.value = false;
  await store.deleteIncident(props.incident.id, { title: k('actionFailed') });
}

onBeforeUnmount(() => clearTimeout(confirmTimer));
</script>
