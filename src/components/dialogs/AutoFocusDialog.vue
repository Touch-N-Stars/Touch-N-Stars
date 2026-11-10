<template>
  <div class="space-y-2">
    <!-- Autofocus Graph -->
    <div class="graph-container">
      <AfShowGraph />
    </div>

    <!-- Autofocus Status -->
    <div class="flex flex-col items-center p-3 bg-surface-2 rounded-lg border border-line">
      <AfStatus />
    </div>
  </div>
</template>

<script setup>
import AfShowGraph from '@/components/focuser/AfShowGraph.vue';
import AfStatus from '@/components/focuser/AfStatus.vue';
</script>

<style scoped>
/* Override the graph height for dialog display */
:deep(.h-72) {
  height: 12rem !important;
}

.graph-container {
  overflow: hidden;
}
</style>
