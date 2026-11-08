<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.MechanicalPosition }}°</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.MechanicalPosition"
        :label="$t('components.sequence.items.moveRotatorMechanical.mechanicalPosition')"
        labelKey="rotator-mech-pos"
        :min="0"
        :max="360"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('MechanicalPosition', $event)"
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
