<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.SelectedDevice }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.reconnect.device')
        }}</label>
        <select
          :key="item.SelectedDevice"
          class="tns-select-compact ml-auto w-auto"
          @change="save('SelectedDevice', $event.target.value)"
        >
          <option v-for="d in devices" :key="d" :value="d" :selected="item.SelectedDevice === d">
            {{ d }}
          </option>
        </select>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';

defineProps({
  item: { type: Object, required: true },
});

const devices = [
  'Camera',
  'Filter Wheel',
  'Focuser',
  'Rotator',
  'Mount',
  'Guider',
  'Switch',
  'Flat Panel',
  'Weather',
  'Dome',
  'Safety Monitor',
];
</script>
