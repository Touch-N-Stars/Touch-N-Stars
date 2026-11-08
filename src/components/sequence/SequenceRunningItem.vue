<template>
  <div v-if="sequenceStore.targetName" class="flex items-center gap-2 pb-2">
    <ViewfinderCircleIcon class="w-5 h-5 shrink-0 text-accent" />
    <span class="font-medium text-content truncate">{{ sequenceStore.targetName }}</span>
    <span v-if="sequenceStore.targetCount > 1" class="text-xs text-content-muted whitespace-nowrap">
      {{
        $t('components.sequence.targetOfTotal', {
          current: sequenceStore.runningTargetIndex + 1,
          total: sequenceStore.targetCount,
        })
      }}
    </span>
  </div>
  <div v-if="sequenceStore.runningItems[0]" class="flex items-center gap-2">
    <Spinner size="sm" class="text-accent" />
    {{ sequenceStore.runningItems[0] }}
    <p v-if="store.filterInfo.Connected && store.cameraInfo.IsExposing">
      {{ store.filterInfo.SelectedFilter.Name }}
    </p>
  </div>
  <div v-else class="text-content-faint italic">{{ $t('components.sequence.noRunningItems') }}</div>
</template>
<script setup>
import { ViewfinderCircleIcon } from '@heroicons/vue/24/outline';
import { useSequenceStore } from '@/store/sequenceStore';
import { apiStore } from '@/store/store';
import Spinner from '@/components/helpers/Spinner.vue';
const sequenceStore = useSequenceStore();
const store = apiStore();
</script>
