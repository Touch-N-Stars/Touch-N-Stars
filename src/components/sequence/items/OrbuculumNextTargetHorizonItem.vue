<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ (item.Data?.Offset ?? 0) >= 0 ? '+' : '' }}{{ item.Data?.Offset ?? 0 }}°
      </span>
      <span
        v-if="item.ExpectedTime && item.ExpectedTime !== '00:00'"
        class="text-xs text-amber-400/80 font-mono"
        >⏱ {{ item.ExpectedTime }}</span
      >
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Data?.Offset ?? 0"
        :label="$t('components.sequence.items.altitudeCondition.horizonOffset')"
        labelKey="orb-horizon-offset"
        :min="-90"
        :max="90"
        :step="1"
        :decimalPlaces="1"
        @change="save('Data.Offset', $event)"
      />

      <div v-if="item.NextTargetName" class="text-xs text-content-faint">
        {{ $t('components.sequence.items.orbuculum.nextTarget') }}
        <span class="text-content">{{ item.NextTargetName }}</span>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

defineProps({ item: { type: Object, required: true } });
</script>
