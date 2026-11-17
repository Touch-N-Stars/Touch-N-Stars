<template>
  <!-- Zoomed full-resolution crops of the primary and the strongest secondaries, one cell each of the parent's grid -->
  <div
    v-for="tile in tiles"
    :key="tile.key"
    class="relative aspect-square rounded-control overflow-hidden bg-black border"
    :class="tile.image.saturated ? 'border-status-danger' : 'border-line'"
    :title="tile.image.saturated ? t('components.guider.native.profile.saturated') : tile.label"
  >
    <!-- A crop clipped at the frame edge is letterboxed; the crosshair's viewBox the same way -->
    <canvas
      :ref="(el) => setCanvas(tile.key, el)"
      class="block w-full h-full object-contain"
      style="image-rendering: pixelated"
    ></canvas>
    <!-- Centroid, open in the middle so it doesn't hide the star -->
    <svg
      class="absolute inset-0 w-full h-full pointer-events-none"
      :viewBox="`0 0 ${tile.image.width} ${tile.image.height}`"
      :stroke="tile.color"
      stroke-width="1"
      stroke-opacity="0.8"
    >
      <line
        :x1="tile.cx"
        y1="0"
        :x2="tile.cx"
        :y2="tile.cy - tile.gap"
        vector-effect="non-scaling-stroke"
      />
      <line
        :x1="tile.cx"
        :y1="tile.cy + tile.gap"
        :x2="tile.cx"
        :y2="tile.image.height"
        vector-effect="non-scaling-stroke"
      />
      <line
        x1="0"
        :y1="tile.cy"
        :x2="tile.cx - tile.gap"
        :y2="tile.cy"
        vector-effect="non-scaling-stroke"
      />
      <line
        :x1="tile.cx + tile.gap"
        :y1="tile.cy"
        :x2="tile.image.width"
        :y2="tile.cy"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span
      class="absolute top-1 left-1 w-2.5 h-2.5 border-2"
      :class="tile.primary ? '' : 'rounded-full'"
      :style="{ borderColor: tile.color }"
    ></span>
    <span
      class="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/60 text-[10px] text-content-muted tabular-nums truncate"
    >
      SNR {{ fmt(tile.star.snr, 0) }} · HFD {{ fmt(tile.star.hfd, 1) }}
    </span>
  </div>
</template>

<script setup>
import { computed, nextTick, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fmt, starTileImage } from '@/utils/nativeGuider';

const props = defineProps({
  /** Raw crop { x0, y0, width, height, pixels } around the primary star. */
  primaryCrop: { type: Object, default: null },
  /** Primary star { x, y, snr, hfd }. */
  primaryStar: { type: Object, default: null },
  /** [{ star, crop }] of the strongest secondaries, highest SNR first. */
  secondaryCrops: { type: Array, default: () => [] },
  bitDepth: { type: Number, default: 16 },
});

const { t } = useI18n();
// Same colours as the star overlay of the frame view
const PRIMARY_COLOR = '#34d399';
const SECONDARY_COLOR = '#22d3ee';

function makeTile(key, crop, star, primary) {
  const image = starTileImage(crop, props.bitDepth);
  if (!image || !star) return null;
  return {
    key,
    image,
    star,
    primary,
    color: primary ? PRIMARY_COLOR : SECONDARY_COLOR,
    label: t(`components.guider.native.frame.${primary ? 'legendPrimary' : 'legendSecondary'}`),
    // Pixel i covers [i, i + 1) in the tile; star coordinates are pixel centres.
    cx: star.x - crop.x0 + 0.5,
    cy: star.y - crop.y0 + 0.5,
    // Half the gap of the crosshair, in crop pixels: clear of the star's core
    gap: Math.max(3, 1.5 * (Number(star.hfd) || 0)),
  };
}

const tiles = computed(() =>
  [
    makeTile('primary', props.primaryCrop, props.primaryStar, true),
    ...props.secondaryCrops.map((s, i) => makeTile(`secondary${i}`, s.crop, s.star, false)),
  ].filter(Boolean)
);

const canvases = new Map();

function setCanvas(key, el) {
  if (el) canvases.set(key, el);
  else canvases.delete(key);
}

function paint() {
  for (const tile of tiles.value) {
    const canvas = canvases.get(tile.key);
    if (!canvas) continue;
    const { width, height, rgba } = tile.image;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.putImageData(new ImageData(rgba, width, height), 0, 0);
  }
}

watch(tiles, () => nextTick(paint), { immediate: true });
</script>
