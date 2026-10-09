<template>
  <div class="flex flex-col gap-3">
    <NativeCoachRun v-if="view === 'run'" />

    <NativeCoachReport v-else-if="view === 'report'" :status="coach" @new-session="newSession" />

    <template v-else>
      <!-- Outcome of the last session when it did not complete -->
      <div
        v-if="outcome"
        class="tns-card flex flex-col gap-2"
        :class="outcome.tone === 'danger' ? 'border-status-danger/50!' : 'border-status-warn/50!'"
        role="status"
      >
        <div class="flex items-start gap-2">
          <component
            :is="outcome.tone === 'danger' ? XCircleIcon : ExclamationTriangleIcon"
            class="mt-0.5 h-5 w-5 shrink-0"
            :class="outcome.tone === 'danger' ? 'text-status-danger' : 'text-status-warn'"
          />
          <div class="flex min-w-0 flex-col gap-1 text-sm">
            <span class="font-semibold text-content">{{ outcome.heading }}</span>
            <span v-if="outcome.title" class="text-content">{{ outcome.title }}</span>
            <span v-if="outcome.why" class="text-content-muted">{{ outcome.why }}</span>
            <span v-if="outcome.fix" class="text-content">{{ outcome.fix }}</span>
          </div>
        </div>
        <details v-if="outcomeFindings.length" class="group">
          <summary class="flex min-h-10 cursor-pointer items-center text-sm text-accent">
            {{ k('outcomeFindings') }} ({{ outcomeFindings.length }})
          </summary>
          <div class="mt-2 flex flex-col gap-2">
            <NativeCoachFinding v-for="f in outcomeFindings" :key="f.id" :finding="f" />
          </div>
        </details>
      </div>

      <NativeCoachStart />
    </template>

    <NativeCoachHistory v-if="view !== 'run'" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ExclamationTriangleIcon, XCircleIcon } from '@heroicons/vue/24/outline';
import { useNativeGuiderStore } from '@/store/nativeGuiderStore';
import { useBackgroundAwarePolling } from '@/utils/appLifecycle';
import NativeCoachFinding from './NativeCoachFinding.vue';
import NativeCoachHistory from './NativeCoachHistory.vue';
import NativeCoachReport from './NativeCoachReport.vue';
import NativeCoachRun from './NativeCoachRun.vue';
import NativeCoachStart from './NativeCoachStart.vue';
import { useCoachText } from './useCoachText';

const store = useNativeGuiderStore();
const { k, message } = useCoachText();

const coach = computed(() => store.coach || { phase: 'Idle' });

// "New session" on a finished report switches to the start screen until the next session.
const startRequestedFor = ref(null);

const view = computed(() => {
  if (store.coachRunning && coach.value.phase === 'Running') return 'run';
  if (
    coach.value.phase === 'Complete' &&
    coach.value.report &&
    startRequestedFor.value !== (coach.value.sessionId || 'last')
  ) {
    return 'report';
  }
  return 'start';
});

function newSession() {
  startRequestedFor.value = coach.value.sessionId || 'last';
}

const outcome = computed(() => {
  const phase = coach.value.phase;
  if (phase !== 'Failed' && phase !== 'Cancelled') return null;
  const text = coach.value.messageCode
    ? message(coach.value.messageCode, coach.value.message, coach.value.messageParameters)
    : { title: coach.value.message || '', why: '', fix: '' };
  return {
    tone: phase === 'Failed' ? 'danger' : 'warn',
    heading: k(`phases.${phase}`),
    title: text.title,
    why: text.why,
    fix: text.fix,
  };
});

const outcomeFindings = computed(() => (outcome.value ? coach.value.findings || [] : []));

// Poll fallback: every 2 s while a session runs without the live feed, every 10 s with it.
let lastPoll = 0;
async function poll() {
  if (!store.isAvailable) return;
  const running = store.coachRunning;
  if (!running) return;
  const interval = store.wsConnected ? 10000 : 2000;
  if (Date.now() - lastPoll < interval - 100) return;
  lastPoll = Date.now();
  await store.loadCoach();
}
const pollActive = ref(true);
useBackgroundAwarePolling(poll, 2000, pollActive);

// A guider that became available (or reconnected) gets a fresh coach status and history.
watch(
  () => store.isAvailable,
  (available) => {
    if (available) {
      store.loadCoach();
      store.loadCoachHistory();
    }
  }
);

onMounted(() => {
  store.loadCoach();
  store.loadCoachHistory();
  // Setting labels for the diffs of the recommendations.
  if (!store.settings.length) store.loadSettings();
});
</script>
