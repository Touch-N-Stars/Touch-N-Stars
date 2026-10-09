<template>
  <article
    class="flex flex-col gap-2 rounded-card border bg-surface-1 p-3"
    :class="borderClass"
    :data-code="finding.code"
  >
    <div class="flex items-start gap-2">
      <component :is="icon" class="mt-0.5 h-5 w-5 shrink-0" :class="TONE_TEXT[tone]" />
      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
        <h4 class="text-sm font-semibold leading-snug text-content break-words">
          <span v-if="rank" class="mr-1 text-content-faint tabular-nums">{{ rank }}.</span>
          {{ text.title }}
        </h4>
        <span v-if="impactText" class="text-xs font-semibold text-accent tabular-nums">
          {{ impactText }}
        </span>
      </div>
      <button
        v-if="hasExplanation"
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-control text-content-muted hover:bg-surface-2"
        :aria-expanded="open"
        :aria-label="open ? k('finding.less') : k('finding.more')"
        :title="open ? k('finding.less') : k('finding.more')"
        @click="open = !open"
      >
        <ChevronDownIcon class="h-5 w-5 transition-transform" :class="{ 'rotate-180': open }" />
      </button>
    </div>

    <div v-if="open && hasExplanation" class="flex flex-col gap-2 text-sm">
      <div v-if="text.why || text.notes.length" class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-content-faint">
          {{ k('finding.why') }}
        </span>
        <p v-if="text.why" class="text-content-muted">{{ text.why }}</p>
        <p v-for="note in text.notes" :key="note" class="text-content-muted italic">
          {{ note }}
        </p>
      </div>
      <div v-if="text.fix" class="flex flex-col gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wider text-content-faint">
          {{ k('finding.fix') }}
        </span>
        <p class="text-content">{{ text.fix }}</p>
      </div>
    </div>

    <div v-if="changes.length" class="flex flex-col gap-2">
      <ul
        class="flex flex-col gap-1 rounded-control bg-surface-2 px-3 py-2 text-xs"
        :aria-label="k('finding.changes')"
      >
        <li
          v-for="change in changes"
          :key="change.name"
          class="flex flex-wrap items-baseline justify-between gap-x-3"
        >
          <span class="text-content-muted">{{ change.label }}</span>
          <span class="tabular-nums text-content">
            <span class="text-content-faint">{{ change.from }}</span>
            →
            <span class="font-semibold">{{ change.to }}</span>
            <span v-if="change.unit" class="ml-0.5 text-content-faint">{{ change.unit }}</span>
          </span>
        </li>
      </ul>
      <div v-if="applicable" class="flex justify-end">
        <button
          type="button"
          class="w-auto! px-4!"
          :class="finding.applied ? 'tns-btn-secondary' : 'tns-btn-primary'"
          :disabled="finding.applied || applyDisabled || applying"
          @click="apply"
        >
          <CheckIcon v-if="finding.applied" class="h-4 w-4" />
          <ArrowPathIcon v-else-if="applying" class="h-4 w-4 animate-spin" />
          {{
            finding.applied
              ? k('finding.applied')
              : applying
                ? k('finding.applying')
                : k('finding.apply')
          }}
        </button>
      </div>
    </div>
  </article>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { TONE_TEXT } from '@/utils/nativeGuider';
import { findingTone, formatParameter } from '@/utils/nativeGuiderCoach';
import { useCoachText } from './useCoachText';

const props = defineProps({
  finding: { type: Object, required: true },
  /** Explanation expanded initially. */
  defaultOpen: { type: Boolean, default: false },
  /** Show the Apply button for findings with setting changes. */
  showApply: { type: Boolean, default: true },
  /** Apply is not possible right now (e.g. while a session runs). */
  applyDisabled: { type: Boolean, default: false },
  /** Position in the ranked action list (1-based), 0 = none. */
  rank: { type: Number, default: 0 },
});

const store = useNativeGuiderStore();
const { k, finding: findingTextOf, settingChange } = useCoachText();

const open = ref(props.defaultOpen);
const applying = ref(false);

const text = computed(() => findingTextOf(props.finding));
const tone = computed(() => findingTone(props.finding.severity));
const hasExplanation = computed(() =>
  Boolean(text.value.why || text.value.fix || text.value.notes.length)
);

const icon = computed(
  () =>
    ({
      ok: CheckCircleIcon,
      info: InformationCircleIcon,
      warn: ExclamationTriangleIcon,
      danger: XCircleIcon,
    })[tone.value] || InformationCircleIcon
);

const borderClass = computed(
  () =>
    ({
      ok: 'border-status-ok/30',
      info: 'border-line',
      warn: 'border-status-warn/40',
      danger: 'border-status-danger/50',
    })[tone.value]
);

const impactText = computed(() => {
  const value = props.finding.impactArcsec;
  if (!Number.isFinite(value) || value <= 0.005) return '';
  return k('finding.impact', { value: formatParameter('impactArcsec', value) });
});

const changes = computed(() =>
  (props.finding.changes || []).map((change) => settingChange(change, store.settings))
);

const applicable = computed(() => props.showApply && changes.value.length > 0);

async function apply() {
  if (applying.value || props.finding.applied) return;
  applying.value = true;
  try {
    const ok = await store.applyCoachActions([props.finding.id], {
      title: k('finding.applyFailed'),
    });
    if (ok) {
      useToastStore().showToast({
        type: 'success',
        title: k('finding.appliedToast', { title: text.value.title }),
      });
    }
  } finally {
    applying.value = false;
  }
}
</script>
