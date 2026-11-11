<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="item.SelectedProvider" class="text-xs text-content font-mono">
        {{ item.SelectedProvider.Name }}
      </span>
      <span class="text-xs text-content-muted font-mono ml-2">
        {{ pad(item.Hours) }}:{{ pad(item.Minutes) }}:{{ pad(item.Seconds) }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <span class="text-xs text-content-muted">{{
          $t('components.sequence.items.timeCondition.provider')
        }}</span>
        <select
          class="tns-select-compact ml-auto w-48"
          :value="item.SelectedProvider?.FullTypeName"
          @change="save('SelectedProvider', $event.target.value)"
        >
          <option v-for="p in providers" :key="p.FullTypeName" :value="p.FullTypeName">
            {{ p.Name }}
          </option>
        </select>
      </div>
      <template v-if="isTimeProvider">
        <div class="text-xs text-content-muted font-medium">
          {{ $t('components.sequence.items.expressionVariable.time') }}
        </div>
        <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
          <NumberInputPicker
            :modelValue="item.Hours"
            label="h"
            labelKey="waittime-h"
            :min="0"
            :max="23"
            :step="1"
            labelPosition="top"
            wrapperClass="w-full"
            @change="save('Hours', $event)"
          />
          <NumberInputPicker
            :modelValue="item.Minutes"
            label="m"
            labelKey="waittime-m"
            :min="0"
            :max="59"
            :step="1"
            labelPosition="top"
            wrapperClass="w-full"
            @change="save('Minutes', $event)"
          />
          <NumberInputPicker
            :modelValue="item.Seconds"
            label="s"
            labelKey="waittime-s"
            :min="0"
            :max="59"
            :step="1"
            labelPosition="top"
            wrapperClass="w-full"
            @change="save('Seconds', $event)"
          />
        </div>
      </template>
      <template v-else>
        <div class="seq-field-row">
          <span class="text-xs text-content-muted">{{
            $t('components.sequence.items.timeCondition.calculatedTime')
          }}</span>
          <span class="ml-auto text-xs text-content font-mono">
            {{ pad(item.Hours) }}:{{ pad(item.Minutes) }}:{{ pad(item.Seconds) }}
          </span>
        </div>
        <NumberInputPicker
          :modelValue="item.MinutesOffset"
          :label="$t('components.sequence.items.expressionVariable.minutesOffset')"
          labelKey="waittime-offset"
          :min="-1440"
          :max="1440"
          :step="1"
          :decimalPlaces="0"
          @change="save('MinutesOffset', $event)"
        />
      </template>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import apiService from '@/services/apiService';

const props = defineProps({
  item: { type: Object, required: true },
});

// Only the Time provider lets the user pick a wall-clock time; every other provider computes
// Hours/Minutes/Seconds itself, so there only the offset is meaningful.
const TIME_PROVIDER = 'NINA.Sequencer.Utility.DateTimeProvider.TimeProvider';
const isTimeProvider = computed(() => props.item.SelectedProvider?.FullTypeName === TIME_PROVIDER);

const providers = ref([]);

onMounted(async () => {
  try {
    const response = await apiService.getDateTimeProviders();
    if (response?.Items) providers.value = response.Items;
  } catch {
    // ignore
  }
});

function pad(v) {
  return String(v ?? 0).padStart(2, '0');
}
</script>
