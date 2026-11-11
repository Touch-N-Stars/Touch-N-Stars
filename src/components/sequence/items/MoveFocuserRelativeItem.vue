<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ item.RelativePosition > 0 ? '+' : '' }}{{ item.RelativePosition }}
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.RelativePosition"
        :label="$t('components.sequence.items.moveFocuserRelative.relativePosition')"
        labelKey="movefocuserrelative-position"
        :min="-999999"
        :max="999999"
        :step="1"
        :decimalPlaces="0"
        @change="save('RelativePosition', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

defineProps({ item: { type: Object, required: true } });
</script>
