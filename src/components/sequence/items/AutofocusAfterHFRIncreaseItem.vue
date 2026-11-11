<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        +{{ item.Amount }}% /
        {{ $t('components.sequence.items.autofocus.samples', { n: item.SampleSize }) }}
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Amount"
        :label="$t('components.sequence.items.autofocus.hfrIncrease')"
        labelKey="af-hfr-amount"
        :min="1"
        :max="100"
        :step="1"
        :decimalPlaces="0"
        @change="save('Amount', $event)"
      />
      <NumberInputPicker
        :modelValue="item.SampleSize"
        :label="$t('components.sequence.items.autofocus.sampleSize')"
        labelKey="af-hfr-sample"
        :min="1"
        :max="100"
        :step="1"
        @change="save('SampleSize', $event)"
      />
      <div class="seq-field-row">
        <label class="tns-label">{{
          $t('components.sequence.items.autofocus.trendPerFilter')
        }}</label>
        <button
          class="ml-auto px-3 py-1 rounded text-xs font-medium border transition-colors"
          :class="
            item.TrendPerFilter
              ? 'bg-accent/20 text-accent border-accent/40 hover:bg-accent/30'
              : 'bg-surface-2 text-content-muted border-line-strong hover:bg-surface-3'
          "
          @click="save('TrendPerFilter', !item.TrendPerFilter)"
        >
          {{
            item.TrendPerFilter
              ? $t('components.sequence.items.on')
              : $t('components.sequence.items.off')
          }}
        </button>
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
