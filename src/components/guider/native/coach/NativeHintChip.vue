<template>
  <div v-if="hint" class="flex flex-col gap-2" data-testid="native-hint">
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex min-h-9 min-w-0 flex-1 items-center gap-1.5 rounded-chip border px-2.5 py-1 text-left text-xs"
        :class="chipClasses"
        :aria-expanded="open"
        :aria-label="open ? k('hint.close') : k('hint.open')"
        @click="open = !open"
      >
        <LightBulbIcon class="h-4 w-4 shrink-0" />
        <span class="shrink-0 font-bold uppercase tracking-wide opacity-80">{{
          k('hint.label')
        }}</span>
        <span class="min-w-0 truncate font-semibold">{{ text.title }}</span>
        <ChevronDownIcon
          class="ml-auto h-4 w-4 shrink-0 transition-transform"
          :class="{ 'rotate-180': open }"
        />
      </button>
      <button
        type="button"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-muted hover:bg-surface-2"
        :aria-label="k('hint.dismiss')"
        :title="k('hint.dismiss')"
        @click="dismiss"
      >
        <XMarkIcon class="h-4 w-4" />
      </button>
    </div>

    <div v-if="open" class="flex flex-col gap-2 rounded-control bg-surface-2 p-3 text-sm">
      <p v-if="text.why" class="text-content-muted">{{ text.why }}</p>
      <p v-if="text.fix" class="text-content">{{ text.fix }}</p>
      <ul v-if="changes.length" class="flex flex-col gap-0.5 text-xs">
        <li
          v-for="change in changes"
          :key="change.name"
          class="flex flex-wrap items-baseline justify-between gap-x-3"
        >
          <span class="text-content-muted">{{ change.label }}</span>
          <span class="tabular-nums">
            <span class="text-content-faint">{{ change.from }}</span> →
            <span class="font-semibold text-content">{{ change.to }}</span>
            <span v-if="change.unit" class="ml-0.5 text-content-faint">{{ change.unit }}</span>
          </span>
        </li>
      </ul>
      <div v-if="changes.length" class="flex justify-end">
        <button
          type="button"
          class="tns-btn-primary w-auto! px-4!"
          :disabled="applying || applied"
          @click="apply"
        >
          <ArrowPathIcon v-if="applying" class="h-4 w-4 animate-spin" />
          <CheckIcon v-else-if="applied" class="h-4 w-4" />
          {{ applied ? k('hint.applied') : k('hint.apply') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  LightBulbIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useToastStore } from '@/store/toastStore';
import { findingTone } from '@/utils/nativeGuiderCoach';
import { useCoachText } from './useCoachText';

const store = useNativeGuiderStore();
const { k, finding: findingTextOf, settingChange } = useCoachText();

const open = ref(false);
const applying = ref(false);
const applied = ref(false);

/** One hint at a time: the most severe active one (store.currentHint). */
const hint = computed(() => store.currentHint);
const text = computed(() => (hint.value ? findingTextOf(hint.value) : { title: '' }));

// Setting labels for the diff (the settings sheet may not have been opened yet).
watch(open, (value) => {
  if (value && !store.settings.length && !store.settingsLoading) store.loadSettings();
});

// A different hint starts collapsed.
watch(
  () => hint.value?.id,
  () => {
    open.value = false;
    applied.value = false;
  }
);

const chipClasses = computed(
  () =>
    ({
      ok: 'border-status-ok/40 bg-status-ok/10 text-status-ok',
      info: 'border-accent/40 bg-accent/10 text-accent',
      warn: 'border-status-warn/40 bg-status-warn/10 text-status-warn',
      danger: 'border-status-danger/40 bg-status-danger/10 text-status-danger',
    })[findingTone(hint.value?.severity)]
);

const changes = computed(() =>
  (hint.value?.changes || []).map((change) => settingChange(change, store.settings))
);

function dismiss() {
  if (hint.value) store.dismissHint(hint.value);
}

/** Applies the hint's setting changes (coach/apply; the guider then retires the hint). */
async function apply() {
  const current = hint.value;
  if (!current || applying.value) return;
  applying.value = true;
  try {
    const ok = await store.applyHint(current, { title: k('hint.applyFailed') });
    if (ok) {
      applied.value = true;
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
