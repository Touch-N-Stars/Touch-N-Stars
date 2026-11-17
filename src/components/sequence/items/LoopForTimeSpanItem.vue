<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ pad(item.Hours) }}:{{ pad(item.Minutes) }}:{{ pad(item.Seconds) }}
      </span>
      <span v-if="item.RemainingTime" class="text-xs text-amber-400/80 font-mono ml-2">
        ⏱ {{ formatRemaining(item.RemainingTime) }}
      </span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Hours"
        :label="$t('components.sequence.items.timeSpan.hours')"
        labelKey="timeSpan-hours"
        :min="0"
        :max="23"
        :step="1"
        @change="save('Hours', $event)"
      />
      <NumberInputPicker
        :modelValue="item.Minutes"
        :label="$t('components.sequence.items.timeSpan.minutes')"
        labelKey="timeSpan-minutes"
        :min="0"
        :max="59"
        :step="1"
        @change="save('Minutes', $event)"
      />
      <NumberInputPicker
        :modelValue="item.Seconds"
        :label="$t('components.sequence.items.timeSpan.seconds')"
        labelKey="timeSpan-seconds"
        :min="0"
        :max="59"
        :step="1"
        @change="save('Seconds', $event)"
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

function pad(v) {
  return String(v ?? 0).padStart(2, '0');
}

function formatRemaining(t) {
  return String(t).replace(/\.\d+$/, '');
}
</script>
