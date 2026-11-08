<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.Time }}s</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Time"
        :label="$t('components.sequence.items.waitForTimeSpan.time')"
        labelKey="wait-timespan"
        :min="0"
        :max="86400"
        :step="1"
        :decimalPlaces="0"
        @change="save('Time', $event)"
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
