<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  computeExposureBarFill,
  planIntegrationSeconds,
  formatIntegrationTime,
} from '../calculations';

const props = defineProps({
  plan: { type: Object, required: true },
});

const { t } = useI18n();

const fill = computed(() => computeExposureBarFill(props.plan));
const acceptedPct = computed(() => fill.value.acceptedPct);
const pendingPct = computed(() => fill.value.pendingPct);
const integrationSeconds = computed(() => planIntegrationSeconds(props.plan));
const integrationTime = computed(() => formatIntegrationTime(integrationSeconds.value));
</script>

<template>
  <div class="text-xs">
    <div class="flex items-center gap-2">
      <span class="w-28 shrink-0 break-words text-content-muted">
        <span class="font-medium">{{ plan.FilterName }}</span>
        <span class="tabular-nums text-content-faint"> · {{ plan.Exposure }}s</span>
      </span>
      <div
        class="flex h-2 flex-1 gap-[2px] overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        :aria-valuenow="plan.Accepted"
        :aria-valuemin="0"
        :aria-valuemax="plan.Desired"
        :aria-label="
          t('plugins.targetSchedulerViewer.exposureBar.ariaLabel', {
            filter: plan.FilterName,
            accepted: plan.Accepted,
            desired: plan.Desired,
          })
        "
      >
        <div
          v-if="acceptedPct > 0"
          class="h-full rounded-full bg-status-ok"
          :style="{ width: acceptedPct + '%' }"
        />
        <div
          v-if="pendingPct > 0"
          class="h-full rounded-full bg-status-warn"
          :style="{ width: pendingPct + '%' }"
        />
      </div>
      <span class="w-20 shrink-0 text-right tabular-nums text-content-muted">
        {{ plan.Accepted }}/{{ plan.Desired }}
      </span>
    </div>
    <p v-if="integrationSeconds > 0" class="mt-0.5 text-right text-[10px] text-content-faint">
      {{ t('plugins.targetSchedulerViewer.exposureBar.integrated', { time: integrationTime }) }}
    </p>
  </div>
</template>
