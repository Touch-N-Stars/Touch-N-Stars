<template>
  <!-- Side view: the tube on two rings on the dovetail, the saddle below. The shim goes between
       the dovetail and the ring at the marked end. -->
  <svg viewBox="0 0 320 140" class="w-full max-w-[420px] mx-auto" role="img" :aria-label="label">
    <!-- tube: objective (front) on the left with the dew shield, focuser (rear) on the right -->
    <rect
      x="40"
      y="28"
      width="230"
      height="38"
      rx="6"
      fill="var(--color-surface-3)"
      stroke="var(--color-content-muted)"
      stroke-width="2"
    />
    <rect
      x="18"
      y="24"
      width="26"
      height="46"
      rx="4"
      fill="var(--color-surface-2)"
      stroke="var(--color-content-muted)"
      stroke-width="2"
    />
    <rect
      x="270"
      y="38"
      width="22"
      height="18"
      rx="3"
      fill="var(--color-surface-2)"
      stroke="var(--color-content-muted)"
      stroke-width="2"
    />
    <!-- rings -->
    <rect
      :x="FRONT_X - 6"
      y="22"
      width="12"
      height="62"
      rx="3"
      :fill="end === 'Front' ? 'var(--color-status-warn)' : 'var(--color-surface-2)'"
      stroke="var(--color-content-muted)"
      stroke-width="1.5"
    />
    <rect
      :x="REAR_X - 6"
      y="22"
      width="12"
      height="62"
      rx="3"
      :fill="end === 'Rear' ? 'var(--color-status-warn)' : 'var(--color-surface-2)'"
      stroke="var(--color-content-muted)"
      stroke-width="1.5"
    />
    <!-- shim wedge -->
    <rect
      v-if="shimX !== null"
      :x="shimX - 14"
      y="84"
      width="28"
      height="6"
      fill="var(--color-status-warn)"
    />
    <!-- dovetail and saddle -->
    <rect
      x="50"
      y="90"
      width="210"
      height="10"
      rx="2"
      fill="var(--color-surface-2)"
      stroke="var(--color-content-muted)"
      stroke-width="1.5"
    />
    <rect
      x="110"
      y="100"
      width="90"
      height="16"
      rx="2"
      fill="var(--color-surface-1)"
      stroke="var(--color-line-strong)"
      stroke-width="1.5"
    />
    <!-- labels -->
    <text x="31" y="16" text-anchor="middle" font-size="11" fill="var(--color-content-muted)">
      {{ $t('plugins.coneError.diagram.front') }}
    </text>
    <text x="281" y="30" text-anchor="middle" font-size="11" fill="var(--color-content-muted)">
      {{ $t('plugins.coneError.diagram.rear') }}
    </text>
    <text x="155" y="132" text-anchor="middle" font-size="10" fill="var(--color-content-faint)">
      {{ $t('plugins.coneError.diagram.saddle') }}
    </text>
    <text
      v-if="shimX !== null"
      :x="shimX"
      y="80"
      text-anchor="middle"
      font-size="11"
      font-weight="bold"
      fill="var(--color-status-warn)"
    >
      {{ thickness }}
    </text>
    <!-- L between the rings -->
    <line
      :x1="FRONT_X"
      y1="10"
      :x2="REAR_X"
      y2="10"
      stroke="var(--color-content-faint)"
      stroke-width="1"
    />
    <text
      :x="(FRONT_X + REAR_X) / 2"
      y="8"
      text-anchor="middle"
      font-size="10"
      fill="var(--color-content-faint)"
    >
      L
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { shimMm } from '../format';

const FRONT_X = 80;
const REAR_X = 230;

const props = defineProps({
  end: { type: String, default: 'None' },
  shimMm: { type: Number, default: null },
});

const { t } = useI18n();
const shimX = computed(() =>
  props.end === 'Front' ? FRONT_X : props.end === 'Rear' ? REAR_X : null
);
const thickness = computed(() =>
  typeof props.shimMm === 'number' ? `${shimMm(props.shimMm)} mm` : ''
);
const label = computed(() =>
  props.end === 'None'
    ? t('plugins.coneError.result.shimNone')
    : t(`plugins.coneError.result.shim${props.end}`, { mm: thickness.value })
);
</script>
