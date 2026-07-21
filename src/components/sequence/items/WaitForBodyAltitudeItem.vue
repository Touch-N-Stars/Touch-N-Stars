<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-slate-400 font-mono">{{ comparatorLabel }} {{ item.Offset }}°</span>
      <span v-if="item.CurrentAltitude !== undefined" class="text-xs text-slate-500 font-mono"
        >({{ item.CurrentAltitude?.toFixed(1) }}°)</span
      >
      <span v-if="item.ExpectedTime" class="text-xs text-amber-400/80 font-mono"
        >⏱ {{ item.ExpectedTime }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Comparator -->
      <div class="flex items-center gap-3">
        <label class="text-xs text-slate-400 shrink-0">{{
          $t('components.sequence.items.moonAltitude.comparator')
        }}</label>
        <select
          :key="comparatorValue"
          class="ml-auto w-36 md:w-40 bg-slate-700/60 border border-slate-600 rounded px-2 py-1 text-xs text-gray-200"
          @change="save('Data.Comparator', Number($event.target.value))"
        >
          <option value="3" :selected="comparatorValue === 3">
            {{ $t('components.sequence.items.moonAltitude.above') }}
          </option>
          <option value="1" :selected="comparatorValue === 1">
            {{ $t('components.sequence.items.moonAltitude.below') }}
          </option>
        </select>
      </div>

      <!-- Offset (altitude threshold) -->
      <NumberInputPicker
        :modelValue="item.Offset"
        :label="$t('components.sequence.items.altitudeCondition.altitude')"
        labelKey="waitbody-alt"
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { normalizeComparator } from '@/utils/sequenceUtils';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true },
});

const comparatorValue = computed(() =>
  normalizeComparator(props.item.Data?.Comparator ?? props.item.Comparator)
);

const comparatorLabel = computed(() =>
  comparatorValue.value === 3
    ? t('components.sequence.items.moonAltitude.above')
    : t('components.sequence.items.moonAltitude.below')
);
</script>
