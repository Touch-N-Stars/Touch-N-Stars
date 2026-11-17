<template>
  <div v-if="!tppaStore.showTotalError" class="flex items-center justify-center gap-2 pb-3">
    <Spinner v-if="tppaStore.isRunning" size="sm" class="text-accent" />
    <p class="text-content-muted">
      {{
        tppaStore.isRunning
          ? $t('components.tppa.waiting_for_values')
          : $t('components.tppa.not_available')
      }}
    </p>
  </div>
</template>

<script setup>
import { useTppaStore } from '@/store/tppaStore';
import Spinner from '@/components/helpers/Spinner.vue';

const tppaStore = useTppaStore();
</script>
