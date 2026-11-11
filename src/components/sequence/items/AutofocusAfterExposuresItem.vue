<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ $t('components.sequence.items.autofocus.everyN', { n: item.AfterExposures }) }}
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.AfterExposures"
        :label="$t('components.sequence.items.autofocus.afterExposures')"
        labelKey="af-exposures"
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
