<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono"
        >{{ item.CompletedIterations }} / {{ item.Iterations }}</span
      >
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Iterations"
        :label="$t('components.sequence.items.loopCondition.iterations')"
        labelKey="loopCondition-iterations"
        :min="1"
        :max="99999"
        :step="1"
        @change="save('Iterations', $event)"
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
