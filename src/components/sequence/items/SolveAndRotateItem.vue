<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.PositionAngle }}°</span>
    </template>

    <template #editor="{ save }">
      <template v-if="!item.Inherited">
        <NumberInputPicker
          :modelValue="item.PositionAngle"
          :label="$t('components.sequence.items.solveAndRotate.positionAngle')"
          labelKey="solve-rotate-angle"
          :min="0"
          :max="360"
          :step="0.1"
          :decimalPlaces="1"
          @change="save('PositionAngle', $event)"
        />
      </template>
      <div v-else class="text-xs text-accent/80">
        {{ $t('components.sequence.items.center.inherited') }}
      </div>
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
