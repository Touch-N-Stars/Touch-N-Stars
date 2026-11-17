<template>
  <section class="tns-card flex flex-col gap-2 min-w-0" data-testid="guide-log-stats">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-content">
        {{ t('plugins.guideLogViewer.stats.title') }}
      </h3>
      <span class="inline-flex items-center gap-1.5">
        <label class="inline-flex min-h-touch items-center gap-2 text-xs text-content-muted">
          <input
            type="checkbox"
            class="h-4 w-4 accent-[var(--color-accent)]"
            :checked="excludeSettling"
            @change="emit('update:excludeSettling', $event.target.checked)"
          />
          {{ t('plugins.guideLogViewer.stats.excludeSettling') }}
        </label>
        <NativeHelpTip
          :title="t('plugins.guideLogViewer.stats.excludeSettling')"
          :text="hint('excludeSettling')"
        />
      </span>
    </div>
    <p class="text-[11px] tabular-nums text-content-muted -mt-1">
      {{ formatWall(view.t0) }} – {{ formatWall(view.t1) }} ·
      {{ t('plugins.guideLogViewer.stats.frames', { count: stats?.n ?? 0 }, stats?.n ?? 0) }}
    </p>

    <p v-if="!stats || stats.empty" class="text-xs text-content-muted py-4 text-center">
      {{ t('plugins.guideLogViewer.stats.empty') }}
    </p>
    <template v-else>
      <!-- RMS: the headline; each tile explains itself on tap -->
      <div class="grid grid-cols-3 gap-2">
        <NativeHelpTip
          v-for="tile in tiles"
          :key="tile.key"
          class="flex w-full flex-col rounded-card border border-line bg-surface-2 px-2 py-1.5 min-w-0 hover:border-line-strong"
          :title="tile.title"
          :text="hint(tile.key)"
        >
          <span class="tile-label" :style="tile.color ? { color: tile.color } : null">
            {{ tile.label }}
          </span>
          <span class="tile-value">{{ v(tile.value) }}</span>
        </NativeHelpTip>
      </div>

      <dl class="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-xs tabular-nums">
        <dt></dt>
        <dd class="col-head" :style="{ color: RA_COLOR }">
          {{ t('components.guider.native.graph.ra') }}
        </dd>
        <dd class="col-head" :style="{ color: DEC_COLOR }">
          {{ t('components.guider.native.graph.dec') }}
        </dd>
        <template v-for="row in axisRows" :key="row.key">
          <dt class="row-label">
            {{ t(`plugins.guideLogViewer.stats.${row.key}`) }}
            <NativeHelpTip
              :title="t(`plugins.guideLogViewer.stats.${row.key}`)"
              :text="hint(row.key)"
            />
          </dt>
          <dd :class="row.warnRa ? 'text-status-warn' : ''">{{ row.ra }}</dd>
          <dd :class="row.warnDec ? 'text-status-warn' : ''">{{ row.dec }}</dd>
        </template>
      </dl>

      <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums border-t border-line pt-2">
        <template v-for="row in rows" :key="row.key">
          <dt class="row-label">
            {{ t(`plugins.guideLogViewer.stats.${row.key}`) }}
            <NativeHelpTip
              :title="t(`plugins.guideLogViewer.stats.${row.key}`)"
              :text="hint(row.key)"
            />
          </dt>
          <dd :class="row.warn ? 'text-status-warn' : ''">{{ row.value }}</dd>
        </template>
      </dl>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { DEC_COLOR, RA_COLOR } from '@/components/guider/native/uplotTheme';
import NativeHelpTip from '@/components/guider/native/NativeHelpTip.vue';
import { formatWall } from '../utils/logView';

const props = defineProps({
  stats: { type: Object, default: null },
  unit: { type: String, default: 'arcsec' },
  view: { type: Object, required: true },
  excludeSettling: { type: Boolean, default: true },
});
const emit = defineEmits(['update:excludeSettling']);
const { t } = useI18n();

const suffix = computed(() => (props.unit === 'px' ? ' px' : '″'));

function v(arcsec) {
  if (!Number.isFinite(arcsec)) return '–';
  const scale = props.stats?.unitScale ?? 1;
  return `${(arcsec * scale).toFixed(2)}${suffix.value}`;
}

function rate(arcsecPerMin) {
  if (!Number.isFinite(arcsecPerMin)) return '–';
  const scale = props.stats?.unitScale ?? 1;
  return `${(arcsecPerMin * scale).toFixed(2)}${suffix.value}/min`;
}

function pct(value) {
  return Number.isFinite(value) ? `${Math.round(value)} %` : '–';
}

const polar = computed(() => {
  const e = props.stats?.polarError;
  return Number.isFinite(e) ? `≈ ${e.toFixed(1)}′` : t('plugins.guideLogViewer.stats.polarUnknown');
});

function hint(key) {
  return t(`plugins.guideLogViewer.stats.hints.${key}`);
}

const tiles = computed(() => {
  const s = props.stats;
  return [
    {
      key: 'total',
      label: t('plugins.guideLogViewer.stats.total'),
      title: t('plugins.guideLogViewer.stats.totalTitle'),
      value: s.rmsTotal,
    },
    {
      key: 'ra',
      label: t('components.guider.native.graph.ra'),
      title: t('plugins.guideLogViewer.stats.raTitle'),
      value: s.rmsRa,
      color: RA_COLOR,
    },
    {
      key: 'dec',
      label: t('components.guider.native.graph.dec'),
      title: t('plugins.guideLogViewer.stats.decTitle'),
      value: s.rmsDec,
      color: DEC_COLOR,
    },
  ];
});

const axisRows = computed(() => {
  const s = props.stats;
  return [
    { key: 'peak', ra: v(s.peakRa), dec: v(s.peakDec) },
    { key: 'mean', ra: v(s.meanRa), dec: v(s.meanDec) },
    { key: 'drift', ra: rate(s.raDrift), dec: rate(s.decDrift) },
    { key: 'pulses', ra: pct(s.raPulsePct), dec: pct(s.decPulsePct) },
    {
      key: 'limited',
      ra: s.raLimited,
      dec: s.decLimited,
      warnRa: s.raLimited > 0,
      warnDec: s.decLimited > 0,
    },
  ];
});

const rows = computed(() => {
  const s = props.stats;
  return [
    { key: 'polar', value: polar.value },
    {
      key: 'oscillation',
      value: Number.isFinite(s.raOscillation) ? s.raOscillation.toFixed(2) : '–',
      warn: s.raOscillation > 0.65,
    },
    { key: 'decReversals', value: s.decReversals },
    { key: 'starLost', value: s.drops, warn: s.drops > 0 },
    { key: 'settling', value: s.settlingFrames },
    { key: 'snr', value: Number.isFinite(s.snrMedian) ? s.snrMedian.toFixed(0) : '–' },
  ];
});
</script>

<style scoped>
@reference '../../../assets/tailwind.css';

.tile-label {
  @apply text-[10px] font-bold uppercase tracking-wider text-content-faint;
}

.tile-value {
  @apply text-base font-semibold tabular-nums text-content;
}

.col-head {
  @apply text-[10px] font-bold uppercase tracking-wider;
}

.row-label {
  @apply text-content-muted;
}

dd {
  @apply text-content;
}
</style>
