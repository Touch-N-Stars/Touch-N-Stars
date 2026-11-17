<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ comparatorLabel }} {{ item.TargetAltitude }}°
      </span>
      <span
        v-if="item.ExpectedTime && item.ExpectedTime !== '00:00'"
        class="text-xs text-amber-400/80 font-mono"
        >⏱ {{ item.ExpectedTime }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- TargetAltitude -->
      <NumberInputPicker
        :modelValue="item.TargetAltitude ?? 0"
        :label="$t('components.sequence.items.altitudeCondition.altitude')"
        labelKey="orb-target-alt"
        :min="-90"
        :max="90"
        :step="1"
        :decimalPlaces="1"
        @change="save('TargetAltitude', $event)"
      />

      <!-- Read-only status -->
      <div v-if="item.NextTargetName" class="text-xs text-content-faint">
        {{ $t('components.sequence.items.orbuculum.nextTarget') }}
        <span class="text-content">{{ item.NextTargetName }}</span>
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

const comparatorLabel = computed(() => {
  const value = normalizeComparator(props.item.Data?.Comparator ?? props.item.Comparator);
  return value === 1
    ? t('components.sequence.items.moonAltitude.below')
    : t('components.sequence.items.moonAltitude.above');
});
</script>
