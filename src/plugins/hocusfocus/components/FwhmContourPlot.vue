<template>
  <div class="flex flex-col gap-3">
    <div ref="container" class="w-full">
      <canvas
        ref="canvas"
        class="block w-full rounded-lg"
        :style="{ aspectRatio: `${domainWidth} / ${domainHeight}` }"
        role="img"
        :aria-label="L('title')"
      ></canvas>
    </div>

    <!-- Colour scale: relative to this frame's FWHM range, as in HocusFocus -->
    <div class="flex items-center gap-2 text-xs text-gray-400">
      <span class="tabular-nums">{{ formatValue(data.Min) }}</span>
      <div class="h-2 flex-1 rounded" :style="{ background: rampCss }"></div>
      <span class="tabular-nums">{{ formatValue(data.Max) }} {{ unitLabel }}</span>
    </div>
    <p class="text-xs text-gray-400">{{ L('hint') }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  // Response of GET /hocusfocus/fwhm-contour with Available === true
  data: { type: Object, required: true },
});

const { t } = useI18n();
const L = (key) => t(`plugins.hocusfocus.fwhmContour.${key}`);

// Colour map, contour count and label format from HocusFocus' FWHMContourControl. Colours are relative:
// the frame's lowest FWHM maps to the first stop and its highest to the last.
const STOPS = [
  [0.0, [44, 25, 85]],
  [0.2, [35, 88, 166]],
  [0.4, [26, 156, 169]],
  [0.6, [94, 201, 97]],
  [0.8, [241, 196, 15]],
  [1.0, [210, 67, 54]],
];
const CONTOUR_COUNT = 9;
const CONTOUR_COLOR = 'rgba(255, 255, 255, 0.9)';
const POINT_COLOR = 'rgb(30, 144, 255)'; // DodgerBlue, HocusFocus' fallback point colour
// Width of the offscreen colour image the heat map is scaled up from.
const HEATMAP_MAX_WIDTH = 320;

const rampCss = `linear-gradient(to right, ${STOPS.map(
  ([p, [r, g, b]]) => `rgb(${r}, ${g}, ${b}) ${p * 100}%`
).join(', ')})`;

// The surface spans cell centre to cell centre, so the plot is (columns-1) x (rows-1) cells.
const domainWidth = computed(() => Math.max(1, props.data.Columns - 1));
const domainHeight = computed(() => Math.max(1, props.data.Rows - 1));
const unitLabel = computed(() => (props.data.Unit === 'arcsec' ? '″' : 'px'));

function formatValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : '--';
}

function colorAt(value, min, max) {
  const p = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
  for (let i = 0; i < STOPS.length - 1; i++) {
    const [p0, c0] = STOPS[i];
    const [p1, c1] = STOPS[i + 1];
    if (p <= p1) {
      const f = p1 > p0 ? (p - p0) / (p1 - p0) : 0;
      return c0.map((c, k) => Math.round(c + (c1[k] - c) * f));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

// Bilinear sample of the surface at fractional grid coordinates.
function sample(surface, gx, gy) {
  const h = surface.length;
  const w = surface[0].length;
  const x0 = Math.min(w - 2, Math.max(0, Math.floor(gx)));
  const y0 = Math.min(h - 2, Math.max(0, Math.floor(gy)));
  const fx = Math.min(1, Math.max(0, gx - x0));
  const fy = Math.min(1, Math.max(0, gy - y0));
  const top = surface[y0][x0] * (1 - fx) + surface[y0][x0 + 1] * fx;
  const bottom = surface[y0 + 1][x0] * (1 - fx) + surface[y0 + 1][x0 + 1] * fx;
  return top * (1 - fy) + bottom * fy;
}

// Marching squares, pairing edge crossings exactly as HocusFocus does: corners in order
// top-left, top-right, bottom-right, bottom-left; crossings paired (0,1) and (2,3).
function crossing(ax, ay, az, bx, by, bz, level) {
  const da = az - level;
  const db = bz - level;
  if ((da === 0 && db === 0) || (da < 0 && db < 0) || (da > 0 && db > 0)) return null;
  const denominator = bz - az;
  if (Math.abs(denominator) < 1e-12) return null;
  const tt = (level - az) / denominator;
  if (tt < 0 || tt > 1) return null;
  return [ax + (bx - ax) * tt, ay + (by - ay) * tt];
}

function contourSegments(surface, level) {
  const segments = [];
  for (let r = 0; r < surface.length - 1; r++) {
    for (let c = 0; c < surface[0].length - 1; c++) {
      const z = [surface[r][c], surface[r][c + 1], surface[r + 1][c + 1], surface[r + 1][c]];
      if (z.some((v) => !Number.isFinite(v))) continue;
      const corners = [
        [c, r, z[0]],
        [c + 1, r, z[1]],
        [c + 1, r + 1, z[2]],
        [c, r + 1, z[3]],
      ];
      const hits = [];
      for (let e = 0; e < 4; e++) {
        const [ax, ay, az] = corners[e];
        const [bx, by, bz] = corners[(e + 1) % 4];
        const hit = crossing(ax, ay, az, bx, by, bz, level);
        if (hit) hits.push(hit);
      }
      if (hits.length === 2) segments.push([hits[0], hits[1]]);
      else if (hits.length === 4) segments.push([hits[0], hits[1]], [hits[2], hits[3]]);
    }
  }
  return segments;
}

function labelBox(ctx, text, x, y, pad) {
  const w = ctx.measureText(text).width + pad * 2;
  const h = parseInt(ctx.font, 10) + pad * 2;
  return { x: x - w / 2, y: y - h / 2, w, h };
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function drawLabel(ctx, text, x, y) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, x, y);
}

const container = ref(null);
const canvas = ref(null);

function draw() {
  const el = canvas.value;
  const surface = props.data?.Surface;
  if (!el || !Array.isArray(surface) || surface.length < 2 || surface[0].length < 2) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = container.value?.clientWidth || 600;
  const cssHeight = (cssWidth * domainHeight.value) / domainWidth.value;
  const width = Math.round(cssWidth * dpr);
  const height = Math.round(cssHeight * dpr);
  el.width = width;
  el.height = height;
  const ctx = el.getContext('2d');

  const gridW = surface[0].length - 1;
  const gridH = surface.length - 1;
  const min = props.data.Min;
  const max = props.data.Max;

  // Heat map. The surface has only ~100 samples across, so colouring every screen pixel buys nothing:
  // colour a small offscreen image and let the browser scale it up smoothly. At 2x DPR on a tablet
  // that is ~40x fewer per-pixel evaluations, and the result looks the same.
  const heatWidth = Math.min(width, HEATMAP_MAX_WIDTH);
  const heatHeight = Math.max(2, Math.round((heatWidth * height) / width));
  const heat = document.createElement('canvas');
  heat.width = heatWidth;
  heat.height = heatHeight;
  const heatCtx = heat.getContext('2d');
  const image = heatCtx.createImageData(heatWidth, heatHeight);
  for (let py = 0; py < heatHeight; py++) {
    const gy = (py / (heatHeight - 1)) * gridH;
    for (let px = 0; px < heatWidth; px++) {
      const [r, g, b] = colorAt(sample(surface, (px / (heatWidth - 1)) * gridW, gy), min, max);
      const i = (py * heatWidth + px) * 4;
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  heatCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(heat, 0, 0, width, height);

  const sx = width / gridW;
  const sy = height / gridH;
  const fontPx = Math.round(11 * dpr);
  ctx.font = `${fontPx}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Nine contour levels evenly spaced strictly between the frame's min and max.
  const placed = [];
  if (max > min) {
    const interval = (max - min) / (CONTOUR_COUNT + 1);
    ctx.strokeStyle = CONTOUR_COLOR;
    ctx.lineWidth = Math.max(1, dpr);
    const labels = [];
    for (let i = 1; i <= CONTOUR_COUNT; i++) {
      const level = min + i * interval;
      const segments = contourSegments(surface, level);
      ctx.beginPath();
      for (const [[x1, y1], [x2, y2]] of segments) {
        ctx.moveTo(x1 * sx, y1 * sy);
        ctx.lineTo(x2 * sx, y2 * sy);
      }
      ctx.stroke();
      labels.push({ level, segments });
    }

    // One label per level, on the segment nearest the centre that does not collide with another.
    ctx.strokeStyle = CONTOUR_COLOR;
    for (const { level, segments } of labels) {
      const text = level.toFixed(1);
      const candidates = segments
        .map(([[x1, y1], [x2, y2]]) => [((x1 + x2) / 2) * sx, ((y1 + y2) / 2) * sy])
        .sort(
          (a, b) =>
            (a[0] - width / 2) ** 2 +
            (a[1] - height / 2) ** 2 -
            ((b[0] - width / 2) ** 2 + (b[1] - height / 2) ** 2)
        );
      for (const [x, y] of candidates) {
        const box = labelBox(ctx, text, x, y, 2 * dpr);
        if (placed.some((p) => overlaps(p, box))) continue;
        placed.push(box);
        drawLabel(ctx, text, x, y);
        break;
      }
    }
  }

  // Measured cells: a dot at each cell centre with its median FWHM. Samples are in cell units, while
  // sx/sy are per surface sample (many per cell), so they scale by the cell size in pixels instead.
  const cellX = width / domainWidth.value;
  const cellY = height / domainHeight.value;
  for (const s of props.data.Samples || []) {
    const x = s.Col * cellX;
    const y = s.Row * cellY;
    ctx.beginPath();
    ctx.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = POINT_COLOR;
    ctx.fill();
    ctx.lineWidth = dpr;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    const text = s.Value.toFixed(1);
    // Keep edge labels inside the canvas.
    const lx = Math.min(width - fontPx * 1.5, Math.max(fontPx * 1.5, x));
    const ly = y < fontPx * 2 ? y + fontPx : y - fontPx;
    drawLabel(ctx, text, lx, ly);
  }
}

let resizeObserver = null;
let frame = 0;
const scheduleDraw = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
};

onMounted(() => {
  scheduleDraw();
  if (typeof ResizeObserver !== 'undefined' && container.value) {
    resizeObserver = new ResizeObserver(scheduleDraw);
    resizeObserver.observe(container.value);
  }
});

watch(() => props.data, scheduleDraw);

onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  resizeObserver?.disconnect();
});
</script>
