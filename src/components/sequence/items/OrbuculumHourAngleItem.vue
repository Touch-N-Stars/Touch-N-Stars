<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ comparatorLabel }} {{ item.HourAngle }}h
      </span>
      <span v-if="item.ExpectedTimeStr" class="text-xs text-amber-400/80 font-mono"
        >⏱ {{ item.ExpectedTimeStr }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Comparator -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.moonAltitude.comparator')
        }}</label>
        <select
          :key="comparatorValue"
          class="tns-select-compact ml-auto w-auto"
          @change="save('Comparator', Number($event.target.value))"
        >
          <option value="1" :selected="comparatorValue === 1">
            {{ $t('components.sequence.items.moonAltitude.below') }}
          </option>
          <option value="3" :selected="comparatorValue === 3">
            {{ $t('components.sequence.items.moonAltitude.above') }}
          </option>
        </select>
      </div>

      <!-- HourAngle -->
      <NumberInputPicker
        :modelValue="item.HourAngle ?? 0"
        :label="$t('components.sequence.items.orbuculum.hourAngle')"
        labelKey="orb-ha"
        :min="-12"
        :max="12"
        :step="0.1"
        :decimalPlaces="2"
        @change="save('HourAngle', $event)"
      />

      <!-- Read-only current -->
      <div class="text-xs text-content-faint">
        {{ $t('components.sequence.items.orbuculum.current') }}
        <span class="text-content">{{ Number(item.CurrentHourAngle).toFixed(2) }}h</span>
      </div>
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

const props = defineProps({ item: { type: Object, required: true } });

const comparatorValue = computed(() =>
  normalizeComparator(props.item.Comparator ?? props.item.Data?.Comparator)
);

const comparatorLabel = computed(() =>
  comparatorValue.value === 1
    ? t('components.sequence.items.moonAltitude.below')
    : t('components.sequence.items.moonAltitude.above')
);
</script>
