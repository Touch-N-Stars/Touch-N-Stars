<template>
  <div class="space-y-4">
    <!-- Current and Target Position -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Current Position -->
      <div class="bg-gray-800 p-4 rounded-lg text-center">
        <p class="text-gray-400 text-sm mb-2">Current position</p>
        <p class="text-4xl font-bold text-white">{{ currentPosition }}°</p>
      </div>
      <!-- Target Position -->
      <div class="bg-gray-800 p-4 rounded-lg text-center">
        <p class="text-gray-400 text-sm mb-2">Target position</p>
        <p class="text-4xl font-bold text-white">{{ targetPosition }}°</p>
      </div>
    </div>

    <!-- Rotation Visualization (Clock-style) -->
    <div class="bg-gray-800 p-6 rounded-lg flex flex-col items-center">
      <!-- Clock Display -->
      <svg width="200" height="200" viewBox="0 0 200 200" class="mb-4">
        <!-- Clock Circle -->
        <circle cx="100" cy="100" r="80" fill="none" stroke="#4B5563" stroke-width="2" />

        <!-- Degree Markers -->
        <text
          v-for="angle in [0, 90, 180, 270]"
          :key="angle"
          :x="100 + Math.sin((angle * Math.PI) / 180) * 70"
          :y="100 - Math.cos((angle * Math.PI) / 180) * 70"
          text-anchor="middle"
          dominant-baseline="middle"
          class="fill-gray-400 text-xs"
        >
          {{ angle }}°
        </text>

        <!-- Current Position (blue line) -->
        <line
          x1="100"
          y1="100"
          :x2="100 + Math.sin((currentAngle * Math.PI) / 180) * 60"
          :y2="100 - Math.cos((currentAngle * Math.PI) / 180) * 60"
          stroke="#3B82F6"
          stroke-width="3"
          stroke-linecap="round"
        />

        <!-- Target Position (green line) -->
        <line
          x1="100"
          y1="100"
          :x2="100 + Math.sin((targetAngle * Math.PI) / 180) * 60"
          :y2="100 - Math.cos((targetAngle * Math.PI) / 180) * 60"
          stroke="#10B981"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="5,5"
        />

        <!-- Rotation Arc -->
        <path
          :d="getRotationArc(currentAngle, targetAngle)"
          fill="none"
          stroke="#F59E0B"
          stroke-width="2"
          :marker-end="direction?.toLowerCase().includes('clock') ? 'url(#arrowhead)' : ''"
        />

        <!-- Arrow marker definition -->
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
            <polygon points="0,0 10,5 0,10" fill="#F59E0B" />
          </marker>
        </defs>

        <!-- Center dot -->
        <circle cx="100" cy="100" r="4" fill="white" />
      </svg>

      <!-- Legend -->
      <div class="flex gap-4 mb-3 text-xs">
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span class="text-gray-400">Current position</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 border-2 border-green-500 border-dashed rounded-full"></div>
          <span class="text-gray-400">Target position</span>
        </div>
      </div>

      <!-- Rotation Info -->
      <p class="text-2xl font-bold text-yellow-500 mb-1">{{ rotationAmount }}°</p>
      <p class="text-gray-400 text-sm">{{ direction }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  dialog: {
    type: Object,
    required: true,
  },
});

// Get content from dialog (try both PascalCase and lowercase)
const content = computed(() => {
  return (
    props.dialog?.Content ||
    props.dialog?.content ||
    props.dialog?.Parameters ||
    props.dialog?.parameters ||
    {}
  );
});

// Extract raw values from SignalR data
const currentPositionRaw = computed(() => {
  return content.value.Position || content.value.MechanicalPosition || '0';
});

const targetPositionRaw = computed(() => {
  return content.value.AbsTargetPosition ?? content.value.TargetPosition ?? '0';
});

const rotationAmountRaw = computed(() => {
  return content.value.Rotation || '0';
});

const direction = computed(() => {
  return content.value.Direction || 'Clockwise';
});

function parseCultureInvariantNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const raw = String(value).trim();
  if (!raw) {
    return 0;
  }

  // Keep sign and numeric separators, allowing values like "12,5°".
  const cleaned = raw.replace(/[^0-9.,+-]/g, '');
  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    // Use the rightmost separator as decimal separator.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Format numbers with 2 decimal places
const formatNumber = (val) => {
  const num = parseCultureInvariantNumber(val);
  return num.toFixed(2);
};

// NINA can send target positions outside 0–360° (e.g. 448°); WPF normalizes there.
const normalize360 = (val) => ((val % 360) + 360) % 360;

const currentAngle = computed(() => parseCultureInvariantNumber(currentPositionRaw.value));
const targetAngle = computed(() =>
  normalize360(parseCultureInvariantNumber(targetPositionRaw.value)),
);
const currentPosition = computed(() => formatNumber(currentPositionRaw.value));
const targetPosition = computed(() => targetAngle.value.toFixed(2));
const rotationAmount = computed(() => formatNumber(rotationAmountRaw.value));

function getRotationArc(currentAngle, targetAngle) {
  const cx = 100;
  const cy = 100;
  const radius = 50;

  const startRad = (currentAngle * Math.PI) / 180;
  const endRad = (targetAngle * Math.PI) / 180;

  const startX = cx + radius * Math.sin(startRad);
  const startY = cy - radius * Math.cos(startRad);
  const endX = cx + radius * Math.sin(endRad);
  const endY = cy - radius * Math.cos(endRad);

  let angleDiff = targetAngle - currentAngle;
  if (angleDiff > 180) angleDiff -= 360;
  if (angleDiff < -180) angleDiff += 360;

  const largeArc = Math.abs(angleDiff) > 180 ? 1 : 0;
  const sweepFlag = angleDiff > 0 ? 1 : 0;

  return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${endX} ${endY}`;
}
</script>
