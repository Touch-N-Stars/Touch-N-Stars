<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.Position }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Position"
        :label="$t('components.sequence.items.moveFocuserAbsolute.position')"
        labelKey="movefocuserabsolute-position"
        :min="0"
        :max="999999"
        :step="1"
        :decimalPlaces="0"
        @change="save('Position', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

defineProps({ item: { type: Object, required: true } });
</script>
