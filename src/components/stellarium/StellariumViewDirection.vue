<template>
  <!-- Crosshair in the center -->
  <div class="framing-container">
    <!-- Vertical line -->
    <div class="crosshair-line vertical"></div>
    <!-- Horizontal line -->
    <div class="crosshair-line horizontal"></div>
    <!-- Center dot -->
    <div class="crosshair-dot"></div>
  </div>

  <!-- Coordinates below crosshair -->
  <div class="coordinates-display">
    <p class="coordinate-text">{{ formattedRA }}</p>
    <p class="coordinate-text">{{ formattedDec }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useStellariumStore } from '@/store/stellariumStore';
import { degreesToHMS, degreesToDMS, rad2deg } from '@/utils/utils';

const stellariumStore = useStellariumStore();
const formattedRA = ref('--:--:--');
const formattedDec = ref('+--:--:--');

let animationFrameId = null;

function updateViewDirection() {
  if (!stellariumStore.stel) return;

  try {
    const stel = stellariumStore.stel;
    const obs = stel.observer;
    const viewVec = [0, 0, -1];
    const cirsVec = stel.convertFrame(obs, 'VIEW', 'ICRF', viewVec);
    const radec = stel.c2s(cirsVec);

    let raDeg = rad2deg(radec[0]);
    const decDeg = rad2deg(radec[1]);
    raDeg = ((raDeg % 360) + 360) % 360;

    formattedRA.value = degreesToHMS(raDeg);
    formattedDec.value = degreesToDMS(decDeg);
  } catch (error) {
    console.error('Error updating view direction:', error);
  }

  animationFrameId = requestAnimationFrame(updateViewDirection);
}

onMounted(() => {
  updateViewDirection();
});

onBeforeUnmount(() => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
</script>

<style scoped>
.framing-container {
  position: fixed;
  top: calc(50% - 15px);
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: 100px;
  height: 100px;
  pointer-events: none;
}

.crosshair-line {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.6);
}

.crosshair-line.vertical {
  width: 2px;
  height: 20px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.crosshair-line.horizontal {
  width: 20px;
  height: 2px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.crosshair-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

@media (orientation: landscape) {
  .framing-container {
    left: calc(50% + 4rem);
  }
}

.coordinates-display {
  position: fixed;
  top: calc(50% + 20px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  text-align: center;
  pointer-events: none;
}

.coordinate-text {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.75rem;
  font-family: monospace;
  margin: 2px 0;
  line-height: 1.2;
}

@media (orientation: landscape) {
  .coordinates-display {
    left: calc(50% + 4rem);
  }
}
</style>
