<template>
  <!-- Target Scheduler plans its targets itself and fills this container at runtime, so it
       gets no editor: its public properties are internal pause/sync switches. -->
  <ItemShell :item="item">
    <template v-if="currentTarget" #summary>
      <span class="text-xs text-slate-400 truncate">{{ currentTarget }}</span>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

// Set by the scheduler while it works on a target; empty between targets
const currentTarget = computed(() => {
  const target = props.item.Target;
  const name = typeof target === 'object' && target !== null ? target.TargetName : null;
  return typeof name === 'string' && name.trim() ? name : null;
});
</script>
