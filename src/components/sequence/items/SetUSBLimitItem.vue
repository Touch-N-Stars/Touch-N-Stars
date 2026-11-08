<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.USBLimit }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.USBLimit"
        :label="$t('components.sequence.items.setUSBLimit.limit')"
        labelKey="usb-limit"
        :min="0"
        :max="100"
        :step="1"
        @change="save('USBLimit', $event)"
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
