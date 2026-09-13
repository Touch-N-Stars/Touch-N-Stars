<template>
  <!-- Rows are rendered as siblings (on/off ports first, then value ports) so the
       parent decides the layout: stacked on the switch page, a grid in the status
       bar panel. -->
  <template v-for="(WritableSwitche, index) in store.switchInfo.WritableSwitches" :key="index">
    <div
      v-if="WritableSwitche.Maximum === 1.0"
      class="flex flex-row items-center justify-between gap-3 w-full bg-surface-2 rounded-chip px-3 py-2 min-h-touch"
    >
      <div class="min-w-0">
        <p class="text-sm font-medium text-content truncate md:text-base">
          {{ WritableSwitche.Name }}
        </p>
        <p class="text-xs text-content-faint truncate mt-0.5">
          {{ WritableSwitche.Description }}
        </p>
      </div>
      <toggleButton
        @click="setBool(index, WritableSwitche.Value)"
        :status-value="WritableSwitche.TargetValue === 1"
      />
    </div>
  </template>
  <template v-for="(WritableSwitche, index) in store.switchInfo.WritableSwitches" :key="index">
    <div
      v-if="WritableSwitche.Maximum > 1.0"
      class="flex flex-row items-center justify-between gap-3 w-full bg-surface-2 rounded-chip px-3 py-2 min-h-touch"
    >
      <div class="min-w-0">
        <p class="text-sm font-medium text-content truncate md:text-base">
          {{ WritableSwitche.Name }}
        </p>
        <p class="text-xs text-content-faint truncate mt-0.5">
          {{ WritableSwitche.Description }}
        </p>
      </div>
      <SetValue
        @blur="setValue(index, $event, WritableSwitche.Minimum, WritableSwitche.Maximum)"
        :store-value="WritableSwitche.Value"
        :min="WritableSwitche.Minimum"
        :max="WritableSwitche.Maximum"
      />
    </div>
  </template>
</template>
<script setup>
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import toggleButton from '@/components/helpers/toggleButton.vue';
import SetValue from '@/components/switch/SetValue.vue';

const store = apiStore();

async function setBool(id, value) {
  try {
    console.log('id: ', id, 'value: ', value);
    if (value === 1.0) {
      await apiService.setSwitch(id, 0);
      console.log('Switch off ID: ', id);
    } else {
      await apiService.setSwitch(id, 1);
      console.log('Switch on ID: ', id);
    }
  } catch (error) {
    console.log('Error while setting the switch');
  }
}

async function setValue(id, value, valueMin, valueMax) {
  try {
    if (value < valueMin) {
      value = valueMin;
    }
    if (value > valueMax) {
      value = valueMax;
    }
    await apiService.setSwitch(id, value);
    console.log('Value set: ', value);
  } catch (error) {
    console.log('Error while setting the switch');
  }
}
</script>
