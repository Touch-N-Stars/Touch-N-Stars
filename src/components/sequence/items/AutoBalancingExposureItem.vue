<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        {{ item.ExposureItems?.length ?? 0 }} ×
      </span>
    </template>

    <template #editor="{ save }">
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead>
            <tr class="text-content-faint border-b border-line">
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.autoBalancingExposure.progress') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.autoBalancingExposure.ratio') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.autoBalancingExposure.timeSeconds') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.switchFilter.filter') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.autoBalancingExposure.bin') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.takeExposure.gain') }}
              </th>
              <th class="text-left pb-1 pr-2 font-normal">
                {{ $t('components.sequence.items.takeExposure.offset') }}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in localItems" :key="i" class="border-b border-line">
              <!-- Progress with -/+ buttons -->
              <td class="py-1 pr-2">
                <div class="flex items-center gap-0.5">
                  <button
                    class="px-1 py-0.5 bg-surface-2 border border-line-strong rounded text-content-muted hover:bg-surface-3 transition-colors"
                    @click="
                      row.Progress = Math.max(0, row.Progress - 1);
                      markDirty();
                    "
                  >
                    −
                  </button>
                  <span class="w-7 text-center text-content">{{ row.Progress }}</span>
                  <button
                    class="px-1 py-0.5 bg-surface-2 border border-line-strong rounded text-content-muted hover:bg-surface-3 transition-colors"
                    @click="
                      row.Progress++;
                      markDirty();
                    "
                  >
                    +
                  </button>
                </div>
              </td>
              <!-- Ratio -->
              <td class="py-1 pr-2">
                <input
                  type="number"
                  v-model.number="row.Ratio"
                  min="1"
                  step="1"
                  class="w-12 bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content outline-none focus:border-accent"
                  @input="markDirty"
                />
              </td>
              <!-- ExposureTime -->
              <td class="py-1 pr-2">
                <input
                  type="number"
                  v-model.number="row.ExposureTime"
                  min="0"
                  step="0.1"
                  class="w-16 bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content outline-none focus:border-accent"
                  @input="markDirty"
                />
              </td>
              <!-- Filter -->
              <td class="py-1 pr-2">
                <select
                  :value="row.Filter?._name ?? ''"
                  class="bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content"
                  @change="onFilterChange(row, $event.target.value)"
                >
                  <option value="">–</option>
                  <option v-for="filter in filterList" :key="filter.Name" :value="filter.Name">
                    {{ filter.Name }}
                  </option>
                </select>
              </td>
              <!-- Binning -->
              <td class="py-1 pr-2">
                <select
                  :value="row.Binning?.X ?? 1"
                  class="bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content"
                  @change="
                    row.Binning = {
                      X: Number($event.target.value),
                      Y: Number($event.target.value),
                    };
                    markDirty();
                  "
                >
                  <option value="1">1×1</option>
                  <option value="2">2×2</option>
                  <option value="3">3×3</option>
                  <option value="4">4×4</option>
                </select>
              </td>
              <!-- Gain -->
              <td class="py-1 pr-2">
                <input
                  type="number"
                  v-model.number="row.Gain"
                  min="-1"
                  class="w-16 bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content outline-none focus:border-accent"
                  :placeholder="row.Gain === -1 ? '(Camera)' : ''"
                  @input="markDirty"
                />
              </td>
              <!-- Offset -->
              <td class="py-1 pr-2">
                <input
                  type="number"
                  v-model.number="row.Offset"
                  min="-1"
                  class="w-16 bg-surface-2 border border-line-strong rounded px-1 py-0.5 text-content outline-none focus:border-accent"
                  :placeholder="row.Offset === -1 ? '(Camera)' : ''"
                  @input="markDirty"
                />
              </td>
              <td class="py-1">
                <button
                  class="text-status-danger hover:text-status-danger/70 p-0.5 transition-colors"
                  @click="removeRow(i)"
                >
                  <TrashIcon class="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
            <tr v-if="localItems.length === 0">
              <td colspan="8" class="py-2 text-center text-content-faint">
                {{ $t('components.sequence.items.autoBalancingExposure.noEntries') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between mt-2">
        <button
          class="flex items-center gap-1 text-xs text-content-muted hover:text-content px-2 py-1 rounded hover:bg-surface-3 transition-colors"
          @click="addRow"
        >
          <PlusIcon class="w-3.5 h-3.5" />
          {{ $t('components.sequence.items.autoBalancingExposure.addRow') }}
        </button>
        <button
          class="flex items-center gap-1 text-xs text-accent px-2 py-1 rounded hover:bg-accent/10 transition-colors"
          @click="saveAll(save)"
        >
          {{ $t('general.save') }}
        </button>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { TrashIcon, PlusIcon } from '@heroicons/vue/24/outline';
import ItemShell from './ItemShell.vue';
import { apiStore } from '@/store/store';

const store = apiStore();

const filterList = computed(() => store.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? []);

function onFilterChange(row, name) {
  if (!name) {
    row.Filter = null;
  } else {
    const f = filterList.value.find((f) => f.Name === name);
    row.Filter = { _name: name, _focusOffset: f?.FocusOffset ?? 0 };
  }
  markDirty();
}

const props = defineProps({ item: { type: Object, required: true } });

function cloneItems() {
  return (props.item.ExposureItems ?? []).map((r) => ({
    Filter: r.Filter
      ? { _name: r.Filter._name ?? r.Filter, _focusOffset: r.Filter._focusOffset ?? 0 }
      : null,
    Binning: { X: r.Binning?.X ?? 1, Y: r.Binning?.Y ?? 1 },
    ExposureTime: r.ExposureTime ?? 0,
    Gain: r.Gain ?? -1,
    Offset: r.Offset ?? -1,
    Ratio: r.Ratio ?? 1,
    Progress: r.Progress ?? 0,
  }));
}

const localItems = ref(cloneItems());
const dirty = ref(false);

watch(
  () => props.item.ExposureItems,
  () => {
    if (!dirty.value) {
      localItems.value = cloneItems();
    }
  },
  { deep: true }
);

function addRow() {
  dirty.value = true;
  localItems.value.push({
    Filter: null,
    Binning: { X: 1, Y: 1 },
    ExposureTime: 0,
    Gain: -1,
    Offset: -1,
    Ratio: 1,
    Progress: 0,
  });
}

function removeRow(i) {
  dirty.value = true;
  localItems.value.splice(i, 1);
}

function markDirty() {
  dirty.value = true;
}

async function saveAll(save) {
  await save('ExposureItems', JSON.stringify(localItems.value));
  dirty.value = false;
}
</script>
