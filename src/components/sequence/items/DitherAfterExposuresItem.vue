<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.AfterExposures }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.AfterExposures"
        :label="$t('components.sequence.items.dither.afterExposures')"
        labelKey="dither-afterExposures"
        :min="0"
        :max="999"
        :step="1"
        @change="save('AfterExposures', $event)"
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
