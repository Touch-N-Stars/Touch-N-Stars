<template>
  <section
    class="tns-card p-3! flex flex-col gap-2 min-w-0"
    :class="diagnosis?.cause && diagnosis.cause !== 'unclear' ? 'border-accent/40!' : ''"
  >
    <!-- "Likely: clouds" -->
    <button
      type="button"
      class="flex w-full items-start gap-2 text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <LightBulbIcon class="mt-0.5 h-5 w-5 shrink-0 text-accent" />
      <span class="flex min-w-0 flex-1 flex-col">
        <span class="text-base font-semibold text-content">{{ heading }}</span>
        <span v-if="!expanded && cause.why" class="text-xs text-content-muted truncate">
          {{ cause.why }}
        </span>
      </span>
      <ChevronDownIcon
        class="mt-1 h-4 w-4 shrink-0 text-content-muted transition-transform"
        :class="{ 'rotate-180': expanded }"
      />
    </button>

    <template v-if="expanded">
      <p v-if="!diagnosis" class="text-sm text-content-muted">{{ k('replay.diagnosisPending') }}</p>
      <p v-if="cause.why" class="text-sm text-content-muted">{{ cause.why }}</p>
      <div
        v-if="cause.fix"
        class="rounded-control border border-accent/30 bg-accent/5 p-2.5 flex flex-col gap-0.5"
      >
        <p class="text-[11px] font-bold uppercase tracking-wider text-accent">
          {{ t('components.guider.native.log.fix') }}
        </p>
        <p class="text-sm text-content">{{ cause.fix }}</p>
      </div>

      <!-- Evidence: items pointing at a frame jump there -->
      <div v-if="evidence.length" class="flex flex-col gap-1">
        <p class="text-[11px] font-bold uppercase tracking-wider text-content-faint">
          {{ k('replay.evidence') }}
        </p>
        <ul class="flex flex-col gap-1">
          <li v-for="(item, i) in evidence" :key="`${item.code}-${i}`">
            <button
              v-if="item.frame !== null"
              type="button"
              class="flex min-h-touch w-full items-center gap-2 rounded-control border border-line bg-surface-2 px-2.5 py-1.5 text-left text-sm text-content hover:bg-surface-3"
              :aria-label="`${item.text} – ${k('replay.showFrame')}`"
              @click="emit('jump', item.frame)"
            >
              <span class="min-w-0 flex-1">{{ item.text }}</span>
              <span class="flex shrink-0 items-center gap-1 text-xs text-accent tabular-nums">
                {{ k('replay.frame', { frame: item.frame }) }}
                <ArrowRightCircleIcon class="h-4 w-4" />
              </span>
            </button>
            <p v-else class="flex items-start gap-2 px-2.5 py-1 text-sm text-content">
              <span class="mt-2 h-1 w-1 shrink-0 rounded-full bg-content-muted"></span>
              <span>{{ item.text }}</span>
            </p>
          </li>
        </ul>
      </div>

      <!-- Triggers -->
      <div v-if="triggers.length" class="flex flex-col gap-1">
        <p class="text-[11px] font-bold uppercase tracking-wider text-content-faint">
          {{ k('replay.triggers') }}
        </p>
        <div class="flex flex-wrap gap-1.5">
          <button
            v-for="(trigger, i) in triggers"
            :key="`trigger-${i}`"
            type="button"
            class="flex min-h-touch items-center gap-1.5 rounded-chip border border-status-danger/40 bg-status-danger/10 px-2 text-xs text-content disabled:opacity-60"
            :disabled="trigger.frame === null"
            :title="trigger.message"
            @click="emit('jump', trigger.frame)"
          >
            <span class="font-semibold">{{ kind(trigger.kind) }}</span>
            <span class="text-content-muted tabular-nums">{{ clock(trigger.time) }}</span>
          </button>
        </div>
      </div>
    </template>

    <!-- The user's note of a manual mark -->
    <div
      v-if="incident?.note"
      class="flex items-start gap-2 rounded-control border border-line bg-surface-2 p-2.5"
    >
      <PencilSquareIcon class="mt-0.5 h-4 w-4 shrink-0 text-content-muted" />
      <div class="flex min-w-0 flex-col">
        <span class="text-[11px] font-bold uppercase tracking-wider text-content-faint">
          {{ k('replay.note') }}
        </span>
        <span class="text-sm text-content break-words">{{ incident.note }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  ArrowRightCircleIcon,
  ChevronDownIcon,
  LightBulbIcon,
  PencilSquareIcon,
} from '@heroicons/vue/24/outline';
import { useIncidentText } from './useIncidentText';

const props = defineProps({
  /** AdvancedIncident. */
  incident: { type: Object, default: null },
});
const emit = defineEmits(['jump']);

const { t, k, kind, clock, likely, cause: causeOf, evidence: evidenceOf } = useIncidentText();

const expanded = ref(true);

const diagnosis = computed(() => props.incident?.diagnosis || null);
const cause = computed(() =>
  diagnosis.value
    ? causeOf(diagnosis.value.cause, diagnosis.value.message)
    : { title: '', why: '', fix: '', known: false }
);
const heading = computed(() =>
  diagnosis.value?.cause
    ? likely(diagnosis.value.cause, diagnosis.value.message)
    : diagnosis.value?.message || k('analysing')
);

const evidence = computed(() =>
  (Array.isArray(diagnosis.value?.evidence) ? diagnosis.value.evidence : []).map((item) => ({
    code: item?.code,
    text: evidenceOf(item).text,
    frame: item?.frame ?? null,
  }))
);

const triggers = computed(() =>
  (Array.isArray(props.incident?.triggers) ? props.incident.triggers : []).map((trigger) => ({
    kind: trigger?.kind,
    time: trigger?.time,
    frame: trigger?.frame ?? null,
    message: [trigger?.message, trigger?.detail].filter(Boolean).join(' – '),
  }))
);
</script>
