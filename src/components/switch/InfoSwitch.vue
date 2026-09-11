<template>
  <div
    v-for="(ReadonlySwitche, index) in store.switchInfo.ReadonlySwitches"
    :key="index"
    class="flex flex-row items-center justify-between gap-3 w-full bg-surface-2 rounded-chip px-3 py-2 min-h-11"
  >
    <div class="min-w-0">
      <p class="text-sm text-content truncate">{{ ReadonlySwitche.Name }}</p>
      <p class="text-xs text-content-faint truncate">{{ ReadonlySwitche.Description }}</p>
    </div>
    <span class="text-sm font-semibold tabular-nums text-content shrink-0">
      {{ ReadonlySwitche.Value }}
    </span>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';

const store = apiStore();
</script>
