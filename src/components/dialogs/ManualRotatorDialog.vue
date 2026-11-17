<template>
  <div class="space-y-4">
    <!-- Current and Target Position -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Current Position -->
      <div class="bg-surface-2 p-4 rounded-lg text-center">
        <p class="text-content-muted text-sm mb-2">{{ view.currentLabel }}</p>
        <p class="text-4xl font-bold text-white">{{ view.currentText }}</p>
      </div>
      <!-- Target Position -->
      <div class="bg-surface-2 p-4 rounded-lg text-center">
        <p class="text-content-muted text-sm mb-2">{{ view.targetLabel }}</p>
        <p class="text-4xl font-bold text-white">{{ view.targetText }}</p>
      </div>
    </div>

    <!-- Rotation Visualization (Clock-style) -->
    <div class="bg-surface-2 p-6 rounded-lg flex flex-col items-center">
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
          class="fill-content-muted text-xs"
        >
          {{ angle }}°
        </text>

        <!-- Current Position (blue line) -->
        <line
          x1="100"
          y1="100"
          :x2="100 + Math.sin((view.currentAngle * Math.PI) / 180) * 60"
          :y2="100 - Math.cos((view.currentAngle * Math.PI) / 180) * 60"
          stroke="#3B82F6"
          stroke-width="3"
          stroke-linecap="round"
        />

        <!-- Target Position (green line) -->
        <line
          x1="100"
          y1="100"
          :x2="100 + Math.sin((view.targetAngle * Math.PI) / 180) * 60"
          :y2="100 - Math.cos((view.targetAngle * Math.PI) / 180) * 60"
          stroke="#10B981"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="5,5"
        />

        <!-- Rotation Arc -->
        <path
          :d="getRotationArc(view.currentAngle, view.targetAngle)"
          fill="none"
          stroke="#F59E0B"
          stroke-width="2"
          :marker-end="view.direction?.toLowerCase().includes('clock') ? 'url(#arrowhead)' : ''"
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
          <span class="text-content-muted">{{ view.currentLabel }}</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-3 h-3 border-2 border-green-500 border-dashed rounded-full"></div>
          <span class="text-content-muted">{{ view.targetLabel }}</span>
        </div>
      </div>

      <!-- Rotation Info -->
      <p class="text-2xl font-bold text-yellow-500 mb-1">{{ view.rotationText }}</p>
      <p class="text-content-muted text-sm">{{ view.direction }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { toManualRotatorView } from '@/utils/manualRotatorContent';

const props = defineProps({
  dialog: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();

// Try both PascalCase and lowercase; the SignalR payload may use either
const content = computed(
  () =>
    props.dialog?.Content ||
    props.dialog?.content ||
    props.dialog?.Parameters ||
    props.dialog?.parameters ||
    {}
);

const view = computed(() => toManualRotatorView(content.value, t));

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
