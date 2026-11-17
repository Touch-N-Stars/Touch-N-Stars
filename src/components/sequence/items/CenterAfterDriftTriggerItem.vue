<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ item.DistanceArcMinutes }}' / {{ item.AfterExposures }} exp
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.DistanceArcMinutes"
        :label="$t('components.sequence.items.centerAfterDrift.distance')"
        labelKey="cad-distance"
        :min="0.1"
        :max="999"
        :step="0.5"
        :decimalPlaces="1"
        @change="save('DistanceArcMinutes', $event)"
      />
      <NumberInputPicker
        :modelValue="item.AfterExposures"
        :label="$t('components.sequence.items.autofocus.afterExposures')"
        labelKey="cad-exposures"
        :min="1"
        :max="9999"
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
