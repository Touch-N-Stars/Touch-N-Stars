<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        +{{ item.MinutesAfterMeridian }}min / max {{ item.MaxMinutesAfterMeridian }}min
      </span>
      <span class="text-xs text-amber-400/80 font-mono"> ⏱ {{ timeToFlip }} </span>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

const timeToFlip = computed(() => {
  const h = props.item.TimeToMeridianFlip;
  if (h == null || isNaN(h)) return '--';
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = String(totalMin % 60).padStart(2, '0');
  return `${hh}:${mm}h`;
});
</script>
