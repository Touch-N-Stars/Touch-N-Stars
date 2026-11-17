<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ item.CurrentAzimuth?.toFixed(1) }}° → {{ item.TargetAzimuth?.toFixed(1) }}°
      </span>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
