<template>
  <!-- When the plan may take pictures tonight, and what does not fit into that time -->
  <div v-if="lines.length" class="flex flex-col gap-1">
    <p
      v-for="line in lines"
      :key="line.key"
      class="text-xs"
      :class="line.warn ? 'text-status-warn' : 'text-content-muted'"
    >
      {{ line.text }}
    </p>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { formatClock } from '@/utils/sequenceSimple';

const props = defineProps({
  /** Both from usePlanSummary() */
  planSummary: { type: Object, required: true },
  planTimes: { type: Object, required: true },
});

const base = 'components.simpleMode.window';
const { t } = useI18n();

// Why not a single picture would be taken, with what helps
function nothingFits(target) {
  const by = props.planTimes.limitOf(target.container, target.startMs)?.by;
  if (by === 'light' && props.planTimes.darkMs) {
    return ['nothing.light', { time: formatClock(props.planTimes.darkMs) }, true];
  }
  return [by === 'low' ? 'nothing.low' : 'nothing.other', {}, true];
}

const lines = computed(() => {
  const { framesLeft, framesFit, targets } = props.planSummary;
  if (!framesLeft) return [];
  const list = [];
  const add = (key, values = {}, warn = false) =>
    list.push({ key, warn, text: t(`${base}.${key}`, values) });

  if (props.planTimes.noDarkness) add('noDarkness', {}, true);
  else if (props.planTimes.notBeforeMs) {
    add('waits', { time: formatClock(props.planTimes.notBeforeMs) });
  }
  const open = targets.filter((target) => target.framesLeft > 0);
  // The target that runs longest says when the plan ends at the latest, and why
  const last = open
    .filter((target) => target.limitMs > target.startMs)
    .reduce((a, b) => (a && a.limitMs >= b.limitMs ? a : b), null);
  if (last) {
    const { by } = props.planTimes.limitOf(last.container, last.startMs);
    add(`limit.${by}`, { time: formatClock(last.limitMs) });
  }
  if (framesFit === 0) add(...nothingFits(open[0]));
  else if (framesFit < framesLeft) add('tooMany', { fit: framesFit, left: framesLeft }, true);
  return list;
});
</script>
