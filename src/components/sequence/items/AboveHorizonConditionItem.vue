<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="item.CurrentAltitude !== undefined" class="text-xs text-content-muted font-mono">
        {{ item.CurrentAltitude?.toFixed(1) }}°
      </span>
      <span v-if="item.ExpectedTime" class="text-xs text-amber-400/80 font-mono ml-2">
        ⏱ {{ item.ExpectedTime }}
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Offset"
        :label="$t('components.sequence.items.altitudeCondition.altitude')"
        labelKey="horizonCond-offset"
        :min="-90"
        :max="90"
        :step="1"
        :decimalPlaces="1"
        @change="save('Offset', $event)"
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
