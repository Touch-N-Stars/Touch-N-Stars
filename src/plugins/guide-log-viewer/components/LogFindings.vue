<template>
  <section
    class="tns-card flex flex-col gap-2 min-w-0 lg:h-[34rem]"
    data-testid="guide-log-findings"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.findings.title') }}
      </h3>
      <SegToggle
        :model-value="filter"
        :options="
          FILTERS.map((f) => ({
            value: f,
            label: t(`plugins.guideLogViewer.findings.filters.${f}`),
          }))
        "
        :label="t('plugins.guideLogViewer.findings.filter')"
        @update:model-value="setFilter"
      />
    </div>
    <p class="text-[11px] text-content-muted -mt-1">
      {{ t('plugins.guideLogViewer.findings.intro') }}
    </p>

    <!-- Counts per kind: tap to show only that kind -->
    <div v-if="kindCounts.length > 1" class="flex flex-wrap gap-1">
      <button
        v-for="k in kindCounts"
        :key="k.kind"
        type="button"
        class="chip"
        :class="{ 'chip-on': kindFilter === k.kind }"
        :aria-pressed="kindFilter === k.kind"
        @click="kindFilter = kindFilter === k.kind ? null : k.kind"
      >
        <span
          class="h-2 w-2 rounded-full"
          :style="{ background: SEVERITY_COLORS[k.severity] }"
        ></span>
        {{ t(`plugins.guideLogViewer.findings.kinds.${k.kind}`) }}
        <span class="text-content-faint">{{ k.count }}</span>
      </button>
    </div>

    <p v-if="!shown.length" class="py-6 text-center text-xs text-content-muted">
      {{
        filter === 'problems'
          ? t('plugins.guideLogViewer.findings.noProblems')
          : t('plugins.guideLogViewer.findings.none')
      }}
    </p>
    <ul
      v-else
      class="flex max-h-[28rem] min-h-0 flex-1 lg:max-h-none flex-col gap-1 overflow-y-auto pr-1"
    >
      <li v-for="f in shown" :key="keyOf(f)">
        <div
          role="button"
          tabindex="0"
          class="row"
          :class="{
            'row-selected': selected?.key === `${f.kind}-${f.t0}`,
            'row-visible': inView(f),
          }"
          @click="emit('select', f)"
          @keydown.enter.prevent="emit('select', f)"
        >
          <span
            class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
            :style="{ background: SEVERITY_COLORS[f.severity] }"
          ></span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-baseline gap-x-2">
              <span class="text-xs font-semibold text-content">{{ title(f) }}</span>
              <span v-if="f.count > 1" class="text-[11px] text-content-faint">
                {{ t('plugins.guideLogViewer.findings.times', { count: f.count }) }}
              </span>
              <span class="ml-auto text-[11px] tabular-nums text-content-muted">
                {{ formatWall(f.t0, true)
                }}<template v-if="f.t1 - f.t0 >= 1"> · {{ formatDuration(f.t1 - f.t0) }}</template>
              </span>
            </div>
            <p class="text-[11px] text-content-muted">{{ detail(f) }}</p>
          </div>
          <button
            v-if="f.kind === 'incident'"
            type="button"
            class="shrink-0 rounded-chip border border-line-strong px-2 min-h-touch text-xs font-semibold text-accent"
            @click.stop="emit('replay', f.params.id)"
          >
            {{ t('components.guider.native.incidents.replayButton') }}
          </button>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { readStored, writeStored } from '@/utils/safeStorage';
import { FINDING_KINDS } from '../utils/analyzeGuideLog';
import { SEVERITY_COLORS, formatDuration, formatWall } from '../utils/logView';
import { useFindingText } from './useFindingText';
import SegToggle from './SegToggle.vue';

const props = defineProps({
  findings: { type: Array, default: () => [] },
  view: { type: Object, required: true },
  selected: { type: Object, default: null },
  unit: { type: String, default: 'arcsec' },
  /** arcsec per px of the night, for distances in px */
  pixelScale: { type: Number, default: NaN },
});
const emit = defineEmits(['select', 'replay']);
const { t } = useI18n();

const FILTERS = ['problems', 'all'];
const FILTER_KEY = 'guideLogViewer.findingsFilter';
const filter = ref(readStored(FILTER_KEY, 'problems') === 'all' ? 'all' : 'problems');
const kindFilter = ref(null);

function setFilter(f) {
  filter.value = f;
  kindFilter.value = null;
  writeStored(FILTER_KEY, f);
}

const base = computed(() =>
  filter.value === 'all' ? props.findings : props.findings.filter((f) => f.severity !== 'info')
);

const kindCounts = computed(() => {
  const order = [...FINDING_KINDS, 'incident'];
  const rank = { bad: 0, warn: 1, info: 2 };
  const map = new Map();
  for (const f of base.value) {
    const e = map.get(f.kind) ?? { kind: f.kind, count: 0, severity: 'info' };
    e.count++;
    if (rank[f.severity] < rank[e.severity]) e.severity = f.severity;
    map.set(f.kind, e);
  }
  return [...map.values()].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
});

const shown = computed(() =>
  kindFilter.value ? base.value.filter((f) => f.kind === kindFilter.value) : base.value
);

function keyOf(f) {
  return `${f.kind}-${f.t0}-${f.t1}`;
}

function inView(f) {
  return f.t1 >= props.view.t0 && f.t0 <= props.view.t1;
}

const { title, detail } = useFindingText(() => ({
  unit: props.unit,
  pixelScale: props.pixelScale,
}));
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.chip {
  @apply inline-flex min-h-touch items-center gap-1.5 rounded-chip border border-line bg-surface-2 px-2 text-[11px] text-content-muted;
}

.chip-on {
  @apply border-accent/50 bg-accent/15 text-accent;
}

.row {
  @apply flex cursor-pointer items-start gap-2 rounded-card border border-transparent px-2 py-1.5 hover:bg-surface-2;
}

.row-visible {
  @apply bg-surface-2/60;
}

.row-selected {
  @apply border-accent/50 bg-accent/10;
}
</style>
