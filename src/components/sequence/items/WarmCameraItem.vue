<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.Duration }}min</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Duration"
        :label="$t('components.sequence.items.warmCamera.duration')"
        labelKey="warmCamera-duration"
        :min="0"
        :max="3600"
        :step="1"
        @change="save('Duration', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
