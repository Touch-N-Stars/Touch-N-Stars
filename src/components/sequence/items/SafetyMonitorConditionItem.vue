<template>
  <ItemShell :item="item">
    <template #summary>
      <span
        class="text-xs font-mono"
        :class="item.IsSafe ? 'text-status-ok' : 'text-status-danger'"
      >
        {{ item.IsSafe ? '✓ Safe' : '✗ Unsafe' }}
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
