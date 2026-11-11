<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center justify-between">
      <span class="flex items-center gap-1">
        <span class="text-sm font-medium text-content">
          {{ $t('components.settings.plate_solver.Filter') }}
        </span>
        <InfoModal
          :title="$t('components.settings.plate_solver.Filter')"
          :message="$t('components.settings.plate_solver.FilterHint')"
          size="w-4 h-4"
        />
      </span>
      <select
        v-model="selectedValue"
        @change="updateSetting"
        :class="statusClass"
        class="tns-select w-40 ml-3 shrink-0"
      >
        <option value="null">
          {{ $t('components.settings.plate_solver.FilterCurrent') }}
        </option>
        <option v-if="currentMissing" :value="String(current.Position)">
          {{ current.Name }}
        </option>
        <option v-for="f in filters" :key="f.Position" :value="String(f.Position)">
          {{ f.Name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
import InfoModal from '@/components/helpers/infoModal.vue';

const store = apiStore();

const filters = computed(() => store.profileInfo?.FilterWheelSettings?.FilterWheelFilters ?? []);

const current = computed(() => {
  const f = store.profileInfo?.PlateSolveSettings?.Filter;
  if (f == null) return null;
  if (typeof f === 'object') {
    if (f.Position == null && !f.Name) return null;
    return { Name: f.Name ?? '', Position: f.Position ?? 0 };
  }
  const pos = Number(f);
  if (Number.isNaN(pos)) return null;
  return { Name: String(pos), Position: pos };
});

const currentMissing = computed(() => {
  if (!current.value) return false;
  return !filters.value.some((f) => f.Position === current.value.Position);
});

function readCurrent() {
  return current.value ? String(current.value.Position) : 'null';
}

// The select works on the filter position as a string, 'null' for none.
const {
  value: selectedValue,
  save: updateSetting,
  glowClass: statusClass,
} = useProfileSetting('PlateSolveSettings-Filter', { source: readCurrent });
</script>
