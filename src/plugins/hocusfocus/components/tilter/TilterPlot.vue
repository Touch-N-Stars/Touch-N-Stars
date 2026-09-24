<template>
  <svg
    viewBox="0 0 340 340"
    class="mx-auto h-auto w-full max-w-[340px]"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
  >
    <!-- Tilter ring with its screws; the plate does not turn with the sensor -->
    <circle
      cx="170"
      cy="170"
      :r="RING"
      fill="none"
      stroke="#4b5563"
      stroke-width="18"
      opacity="0.5"
    />

    <!-- Sensor, clocked against the plate. Only the outline turns: the labels are placed at the
         turned corners but stay upright, so they read the right way round at any rotation. -->
    <g :transform="`rotate(${rotation} 170 170)`">
      <rect
        :x="170 - sensorW / 2"
        :y="170 - sensorH / 2"
        :width="sensorW"
        :height="sensorH"
        fill="#22d3ee"
        fill-opacity="0.08"
        stroke="#22d3ee"
        stroke-opacity="0.7"
        stroke-width="1.5"
      />
      <line x1="170" y1="160" x2="170" y2="180" stroke="#6b7280" stroke-dasharray="2" />
      <line x1="160" y1="170" x2="180" y2="170" stroke="#6b7280" stroke-dasharray="2" />
    </g>
    <g v-for="corner in corners" :key="corner.name">
      <text
        :x="corner.x"
        :y="corner.value === null ? corner.y + 4 : corner.y - 3"
        text-anchor="middle"
        fill="#d1d5db"
        font-weight="bold"
        font-size="12"
      >
        {{ corner.name }}
      </text>
      <text
        v-if="corner.value !== null"
        :x="corner.x"
        :y="corner.y + 11"
        text-anchor="middle"
        fill="#67e8f9"
        font-size="11"
      >
        {{ corner.value }}
      </text>
    </g>

    <g v-for="screw in screws" :key="screw.label">
      <circle
        :cx="screw.cx"
        :cy="screw.cy"
        r="11"
        :fill="screw.color"
        fill-opacity="0.2"
        :stroke="screw.color"
        stroke-width="2"
      />
      <circle :cx="screw.cx" :cy="screw.cy" r="2" :fill="screw.color" />
      <text
        :x="screw.labelX"
        :y="screw.labelY + 4"
        text-anchor="middle"
        :fill="screw.color"
        font-weight="bold"
        font-size="12"
      >
        {{ screw.label }}
      </text>
    </g>
  </svg>
</template>

<script setup>
import { computed } from 'vue';
import { SCREW_LAYOUTS } from './tilterGeometry';

// Top-down sketch of the tilter as seen from the back of the camera: the screw ring, and the
// sensor clocked against it. The image corners are mirrored in this view (image top-left sits
// top-right), exactly as TilterService lays them out on the backend.
const props = defineProps({
  // Clockwise, facing the back of the camera
  rotation: { type: Number, default: 0 },
  sensorWidth: { type: Number, default: 36 },
  sensorHeight: { type: Number, default: 24 },
  screwCount: { type: Number, default: 3 },
  // Optional text under each corner name, e.g. the ETA's current offset: { TL, TR, BL, BR }
  cornerValues: { type: Object, default: null },
});

const RING = 150;
const CENTER = 170;

const sensorW = computed(() => {
  const aspect =
    props.sensorHeight > 0 && props.sensorWidth > 0
      ? props.sensorHeight / props.sensorWidth
      : 2 / 3;
  return aspect > 1 ? 150 / aspect : 150;
});
const sensorH = computed(() => {
  const aspect =
    props.sensorHeight > 0 && props.sensorWidth > 0
      ? props.sensorHeight / props.sensorWidth
      : 2 / 3;
  return aspect > 1 ? 150 : 150 * aspect;
});

// Screen coordinates (y down); a positive angle turns clockwise, like the SVG rotate() above.
function turn(x, y) {
  const r = (props.rotation * Math.PI) / 180;
  return {
    x: CENTER + x * Math.cos(r) - y * Math.sin(r),
    y: CENTER + x * Math.sin(r) + y * Math.cos(r),
  };
}

const corners = computed(() => {
  // Labels sit a little inside each corner so they stay within the outline.
  const hx = (sensorW.value / 2) * 0.62;
  const hy = (sensorH.value / 2) * 0.55;
  const layout = [
    { name: 'TL', x: hx, y: -hy },
    { name: 'TR', x: -hx, y: -hy },
    { name: 'BL', x: hx, y: hy },
    { name: 'BR', x: -hx, y: hy },
  ];
  return layout.map((c) => ({
    name: c.name,
    ...turn(c.x, c.y),
    value: props.cornerValues ? (props.cornerValues[c.name] ?? '—') : null,
  }));
});

const screws = computed(() =>
  SCREW_LAYOUTS[props.screwCount === 4 ? 4 : 3].map((screw) => {
    const radians = (screw.angle * Math.PI) / 180;
    const cx = CENTER + RING * Math.cos(radians);
    const cy = CENTER + RING * Math.sin(radians);
    return {
      ...screw,
      cx,
      cy,
      // Pulled towards the centre so the label stays inside the view box
      labelX: cx - 26 * Math.cos(radians),
      labelY: cy - 26 * Math.sin(radians),
    };
  })
);
</script>
