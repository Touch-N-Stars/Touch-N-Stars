<template>
  <section class="tns-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="font-semibold text-content">
        {{
          result.mode === 'manual'
            ? $t('plugins.coneError.result.daytimeTitle')
            : $t('plugins.coneError.result.title')
        }}
      </h2>
      <span class="rounded-chip px-2 py-1 text-xs font-semibold" :class="qualityClass">
        {{ $t(`plugins.coneError.result.quality.${result.quality}`) }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('plugins.coneError.result.cone') }}</span>
        <span class="tns-stat-value">{{ signedArcmin(result.coneArcmin) }}′</span>
        <span v-if="result.stdDevArcmin != null" class="text-xs text-content-muted">
          {{
            $t('plugins.coneError.result.spread', {
              sd: result.stdDevArcmin.toFixed(2),
              se: (result.stdErrorArcmin ?? 0).toFixed(2),
            })
          }}
        </span>
      </div>
      <div class="tns-stat-tile">
        <span class="tns-stat-label">{{ $t('plugins.coneError.result.shim') }}</span>
        <span class="tns-stat-value">{{ shimText }}</span>
        <span class="text-xs text-content-muted">
          {{ $t('plugins.coneError.result.dovetail', { mm: result.dovetailMm ?? '—' }) }}
        </span>
      </div>
    </div>

    <p
      class="text-sm font-semibold"
      :class="result.shimEnd === 'None' ? 'text-content' : 'text-status-warn'"
    >
      {{ advice }}
    </p>
    <ShimDiagram v-if="result.shimEnd !== 'None'" :end="result.shimEnd" :shimMm="result.shimMm" />

    <p v-if="result.mode !== 'manual'" class="text-xs text-content-muted">
      {{
        $t('plugins.coneError.result.pairs', {
          used: result.pairsUsed,
          total: result.pairsTotal,
          dec: result.declinationDegrees.toFixed(0),
        })
      }}
    </p>
    <p v-if="result.parallaxArcmin != null" class="text-xs text-content-muted">
      {{ $t('plugins.coneError.result.parallax', { arcmin: result.parallaxArcmin.toFixed(2) }) }}
    </p>
    <PairTable v-if="result.pairs?.length" :pairs="result.pairs" />

    <!-- before / after: the sanity check after shimming -->
    <div v-if="previous" class="rounded-control border border-line p-3 space-y-1 text-sm">
      <p class="text-content">
        {{
          $t('plugins.coneError.result.beforeAfter', {
            before: signedArcmin(previous.coneArcmin),
            after: signedArcmin(result.coneArcmin),
            date: new Date(previous.timestampUtc).toLocaleDateString(),
          })
        }}
      </p>
      <p :class="comparison.class">{{ comparison.text }}</p>
    </div>

    <p class="text-xs text-content-faint">{{ $t('plugins.coneError.result.limitation') }}</p>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { shimMm, signedArcmin } from '../format';
import PairTable from './PairTable.vue';
import ShimDiagram from './ShimDiagram.vue';

const props = defineProps({
  result: { type: Object, required: true },
  previous: { type: Object, default: null },
});

const { t } = useI18n();

const shimText = computed(() =>
  typeof props.result.shimMm === 'number' && props.result.shimEnd !== 'None'
    ? `${shimMm(props.result.shimMm)} mm`
    : '—'
);

const advice = computed(() => {
  if (props.result.shimEnd === 'None') {
    return props.result.significant === false
      ? t('plugins.coneError.result.notSignificant')
      : t('plugins.coneError.result.shimNone');
  }
  return t(`plugins.coneError.result.shim${props.result.shimEnd}`, { mm: shimText.value });
});

const qualityClass = computed(() => {
  switch (props.result.quality) {
    case 'Good':
      return 'bg-status-ok/15 text-status-ok';
    case 'Fair':
      return 'bg-status-warn/15 text-status-warn';
    case 'DaytimeEstimate':
    case 'Single':
      return 'bg-surface-3 text-content-muted';
    default:
      return 'bg-status-danger/15 text-status-danger';
  }
});

// Smaller is better. Larger after shimming means the shim may sit at the wrong end.
const comparison = computed(() => {
  const before = Math.abs(props.previous?.coneArcmin ?? 0);
  const after = Math.abs(props.result.coneArcmin ?? 0);
  const se = Math.max(props.result.stdErrorArcmin ?? 0, 0.1);
  if (after + se < before) {
    return { class: 'text-status-ok', text: t('plugins.coneError.result.improved') };
  }
  if (after > before + se) {
    return { class: 'text-status-danger font-semibold', text: t('plugins.coneError.result.worse') };
  }
  return { class: 'text-content-muted', text: t('plugins.coneError.result.same') };
});
</script>
