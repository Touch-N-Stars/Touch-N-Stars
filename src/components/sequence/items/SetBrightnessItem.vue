<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.Brightness }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Brightness"
        :label="$t('components.sequence.items.setBrightness.brightness')"
        labelKey="setbrightness-brightness"
        :min="0"
        :max="255"
        :step="1"
        :decimalPlaces="0"
        @change="save('Brightness', $event)"
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
