<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted shrink-0">{{ currentFilter }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchFilter.filter')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="currentFilter"
          @change="saveFilter(save, $event.target.value)"
        >
          <option
            v-if="currentFilter && !filterNames.includes(currentFilter)"
            :value="currentFilter"
          >
            {{ currentFilter }}
          </option>
          <option v-for="(name, i) in filterNames" :key="i" :value="name">
            {{ name }}
          </option>
        </select>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import { apiStore } from '@/store/store';
import { switchFilterName, switchFilterUpdate } from '@/utils/sequenceFilter';

const props = defineProps({
  item: { type: Object, required: true },
});

const mainStore = apiStore();

const filterNames = computed(() => {
  if (props.item.FilterNames?.length) return props.item.FilterNames;
  return mainStore.filterInfo?.AvailableFilters?.map((f) => f.Name) ?? [];
});

const currentFilter = computed(() => switchFilterName(props.item));

function saveFilter(save, name) {
  const { property, value } = switchFilterUpdate(props.item, filterNames.value, name);
  save(property, value);
}
</script>
