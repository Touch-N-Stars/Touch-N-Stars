<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono"> {{ item.Amount }}°C </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Amount"
        :label="$t('components.sequence.items.autofocus.deltaT')"
        labelKey="af-temp-amount"
        :min="1"
        :max="9999"
        :step="1"
        @change="save('Amount', $event)"
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
