<template>
  <!-- When tonight's plan will flip, from the targets' imaging times and the flip timing -->
  <p v-if="text" class="text-xs text-content-muted">
    {{ text }}
    <router-link
      :to="{ path: '/settings', query: { tab: 'meridianFlip' } }"
      class="underline text-accent"
    >
      {{ $t(`${base}.flipSettings`) }}
    </router-link>
  </p>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { plannedMeridianFlip } from '@/utils/meridianFlipPresets';
import { formatClock } from '@/utils/sequenceSimple';
import {
  dsoContainerHasTarget,
  dsoContainerName,
  dsoContainerRaDegrees,
} from '@/utils/sequenceTargets';

const props = defineProps({
  /** summarizeTargets() of the loaded plan, with clock times */
  planSummary: { type: Object, required: true },
});

const base = 'components.simpleMode.steps.capture';
const { t } = useI18n();
const store = apiStore();

// Targets with pictures left, with the times the plan is expected to image them.
const targets = computed(() =>
  (props.planSummary?.targets ?? []).filter(
    (target) => target.remainingSeconds > 0 && dsoContainerHasTarget(target.container)
  )
);

const flip = computed(() =>
  plannedMeridianFlip(
    targets.value.map((target) => ({
      raDeg: dsoContainerRaDegrees(target.container),
      startMs: target.startMs,
      endMs: target.endMs,
    })),
    {
      lonDeg: store.profileInfo?.AstrometrySettings?.Longitude,
      settings: store.profileInfo?.MeridianFlipSettings,
    }
  )
);

const text = computed(() => {
  if (!targets.value.length) return '';
  const next = flip.value;
  if (!next) return t(`${base}.flipNone`);
  const values = {
    target: dsoContainerName(targets.value[next.index]?.container) || t(`${base}.flipYourTarget`),
    meridian: formatClock(next.meridianMs),
    earliest: formatClock(next.earliestMs),
    latest: formatClock(next.latestMs),
    pause: next.pauseMs === null ? '' : formatClock(next.pauseMs),
  };
  if (next.pauseMs !== null) return t(`${base}.flipPause`, values);
  if (next.earliestMs === next.latestMs) return t(`${base}.flipFixed`, values);
  return t(`${base}.flipWindow`, values);
});
</script>
