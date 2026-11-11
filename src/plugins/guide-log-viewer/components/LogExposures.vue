<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="history-exposures">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.exposures.title') }}
      </h3>
      <SegToggle
        v-model="sort"
        :options="
          SORTS.map((s) => ({ value: s, label: t(`plugins.guideLogViewer.exposures.sorts.${s}`) }))
        "
        :label="t('plugins.guideLogViewer.exposures.sort')"
      />
    </div>
    <p class="text-[11px] text-content-muted -mt-1">
      {{ t('plugins.guideLogViewer.exposures.intro', { typical: typicalText }) }}
    </p>
    <div class="flex flex-wrap gap-1 text-[11px]">
      <span
        v-for="g in GRADES"
        :key="g"
        class="inline-flex items-center gap-1 rounded-chip border border-line bg-surface-2 px-2 py-0.5 text-content-muted"
      >
        <span class="h-2 w-2 rounded-full" :style="{ background: GRADE_COLORS[g] }"></span>
        {{ t(`plugins.guideLogViewer.grade.${g}`) }} {{ counts[g] }}
      </span>
    </div>
    <div class="max-h-[24rem] overflow-y-auto">
      <table class="w-full text-xs tabular-nums">
        <thead
          class="sticky top-0 bg-surface-1 text-[10px] uppercase tracking-wider text-content-faint"
        >
          <tr>
            <th class="py-1 text-left font-bold">
              {{ t('plugins.guideLogViewer.exposures.time') }}
            </th>
            <th class="py-1 text-left font-bold">
              {{ t('plugins.guideLogViewer.exposures.filter') }}
            </th>
            <th class="py-1 text-right font-bold">
              {{ t('plugins.guideLogViewer.exposures.rms') }}
            </th>
            <th class="py-1 text-right font-bold">
              {{ t('plugins.guideLogViewer.exposures.peak') }}
            </th>
            <th class="py-1 text-right font-bold">HFR</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sorted"
            :key="row.index"
            class="cursor-pointer border-t border-line hover:bg-surface-2"
            :class="{ 'bg-accent/10': selected?.key === `exp-${row.index}` }"
            tabindex="0"
            @click="emit('select', row)"
            @keydown.enter.prevent="emit('select', row)"
          >
            <td class="py-1.5">
              <span
                class="mr-1.5 inline-block h-2 w-2 rounded-full"
                :style="{ background: GRADE_COLORS[row.grade] }"
              ></span>
              {{ formatWall(row.start, false) }}
              <span class="text-content-faint">{{ row.seconds }}s</span>
            </td>
            <td class="py-1.5 text-content-muted">{{ row.filter || '–' }}</td>
            <td class="py-1.5 text-right">{{ v(row.stats.rmsTotal) }}</td>
            <td class="py-1.5 text-right text-content-muted">
              {{ v(Math.max(Math.abs(row.stats.peakRa), Math.abs(row.stats.peakDec))) }}
            </td>
            <td class="py-1.5 text-right text-content-muted">
              {{ row.hfr !== null ? row.hfr.toFixed(2) : '–' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { GRADE_COLORS, formatDistance, formatWall } from '../utils/logView';
import SegToggle from './SegToggle.vue';

const props = defineProps({
  exposures: { type: Object, required: true },
  unit: { type: String, default: 'arcsec' },
  model: { type: Object, required: true },
  /** The highlighted range of the viewer ({ key }), to mark the chosen frame. */
  selected: { type: Object, default: null },
});
const emit = defineEmits(['select']);
const { t } = useI18n();

const SORTS = ['time', 'worst'];
const GRADES = ['good', 'fair', 'poor', 'bad', 'lost'];
const sort = ref('time');

function v(arcsec) {
  return formatDistance(arcsec, props.unit, props.model.pixelScale);
}

const typicalText = computed(() => v(props.exposures.typical));

const counts = computed(() => {
  const c = { good: 0, fair: 0, poor: 0, bad: 0, lost: 0 };
  for (const r of props.exposures.rows) c[r.grade]++;
  return c;
});

const sorted = computed(() => {
  const rows = [...props.exposures.rows];
  if (sort.value === 'worst') {
    rows.sort(
      (a, b) => (b.stats.drops > 0) - (a.stats.drops > 0) || b.stats.rmsTotal - a.stats.rmsTotal
    );
  }
  return rows;
});
</script>
