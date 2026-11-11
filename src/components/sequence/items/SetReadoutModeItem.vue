<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted shrink-0">{{ modeLabel }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.setReadoutMode.mode')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="item.Mode"
          @change="save('Mode', Number($event.target.value))"
        >
          <option v-for="(name, index) in readoutModes" :key="index" :value="index">
            {{ name }}
          </option>
        </select>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import ItemShell from './ItemShell.vue';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = apiStore();

const readoutModes = computed(() => store.cameraInfo?.ReadoutModes ?? []);

const modeLabel = computed(() => readoutModes.value[props.item.Mode] ?? `Mode ${props.item.Mode}`);
</script>
