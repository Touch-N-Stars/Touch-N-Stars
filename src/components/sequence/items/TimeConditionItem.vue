<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="item.SelectedProvider" class="text-xs text-content font-mono">
        {{ item.SelectedProvider.Name }}
      </span>
      <span class="text-xs text-content-muted font-mono ml-2">
        {{ pad(item.Hours) }}:{{ pad(item.Minutes) }}:{{ pad(item.Seconds) }}
      </span>
      <span v-if="item.RemainingTime" class="text-xs text-amber-400/80 font-mono ml-2">
        ⏱ {{ formatRemaining(item.RemainingTime) }}
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
          @change="saveProvider(save, $event.target.value)"
        >
          <option v-for="p in providers" :key="p.FullTypeName" :value="p.FullTypeName">
            {{ p.Name }}
          </option>
        </select>
      </div>
      <template v-if="isTimeProvider">
        <NumberInputPicker
          :modelValue="item.Hours"
          :label="$t('components.sequence.items.timeSpan.hours')"
          labelKey="timeCond-hours"
          :min="0"
          :max="23"
          :step="1"
          @change="save('Hours', $event)"
        />
        <NumberInputPicker
          :modelValue="item.Minutes"
          :label="$t('components.sequence.items.timeSpan.minutes')"
          labelKey="timeCond-minutes"
          :min="0"
          :max="59"
          :step="1"
          @change="save('Minutes', $event)"
        />
        <NumberInputPicker
          :modelValue="item.Seconds"
          :label="$t('components.sequence.items.timeSpan.seconds')"
          labelKey="timeCond-seconds"
          :min="0"
          :max="59"
          :step="1"
          @change="save('Seconds', $event)"
        />
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
          :label="$t('components.sequence.items.timeSpan.minutesOffset')"
          labelKey="timeCond-minutesOffset"
          :min="-59"
          :max="59"
          :step="1"
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

function saveProvider(save, fullTypeName) {
  save('SelectedProvider', fullTypeName);
}

function pad(v) {
  return String(v ?? 0).padStart(2, '0');
}

function formatRemaining(t) {
  return String(t).replace(/\.\d+$/, '');
}
</script>
