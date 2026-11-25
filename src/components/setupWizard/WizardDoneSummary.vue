<template>
  <ul class="flex flex-col gap-1">
    <li v-for="item in items" :key="item.id">
      <!-- Every row leads back to its step, so a gap can be closed right away -->
      <button
        type="button"
        class="w-full flex items-center gap-3 rounded-control px-2 py-2 min-h-touch text-left hover:bg-surface-2"
        data-haptic="none"
        @click="$emit('go', item.stepId)"
      >
        <CheckCircleIcon v-if="item.status === 'ok'" class="w-5 h-5 shrink-0 text-status-ok" />
        <ExclamationTriangleIcon
          v-else-if="item.status === 'warn'"
          class="w-5 h-5 shrink-0 text-status-warn"
        />
        <MinusCircleIcon v-else class="w-5 h-5 shrink-0 text-content-faint" />
        <span class="flex-1 min-w-0">
          <span class="block text-sm text-content">
            {{ t(`components.setupWizard.steps.${item.id}`) }}
          </span>
          <span class="block text-xs" :class="statusClass(item.status)">
            {{ t(`components.setupWizard.done.status.${item.status}.${item.id}`) }}
          </span>
        </span>
        <ChevronRightIcon class="w-4 h-4 shrink-0 text-content-faint" />
      </button>
    </li>
  </ul>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CheckCircleIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
} from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useAstapDatabases } from '@/composables/useAstapDatabases';
import { wizardSummary } from '@/utils/setupWizardSummary';

defineEmits(['go']);

const { t } = useI18n();
const store = apiStore();
const astap = useAstapDatabases();

const items = computed(() =>
  wizardSummary({
    profileInfo: store.profileInfo,
    isPINS: store.isPINS,
    databaseInstalled: astap.usesAstap.value ? astap.hasInstalled.value : null,
  })
);

function statusClass(status) {
  if (status === 'ok') return 'text-status-ok';
  if (status === 'warn') return 'text-status-warn';
  return 'text-content-faint';
}

onMounted(() => {
  store.fetchProfilInfos();
  if (store.isPINS) astap.refresh().catch(() => {});
});
</script>
