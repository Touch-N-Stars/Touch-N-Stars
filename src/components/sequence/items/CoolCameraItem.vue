<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ item.Temperature }}°C / {{ item.Duration }}min
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Temperature"
        :label="$t('components.sequence.items.coolCamera.temperature')"
        labelKey="cool-temp"
        :min="-50"
        :max="40"
        :step="1"
        :decimalPlaces="0"
        @change="save('Temperature', $event)"
      />
      <NumberInputPicker
        :modelValue="item.Duration"
        :label="$t('components.sequence.items.coolCamera.duration')"
        labelKey="cool-duration"
        :min="0"
        :max="999"
        :step="1"
        :decimalPlaces="0"
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
