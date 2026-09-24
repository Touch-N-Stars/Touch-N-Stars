<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ExposureProgressBar from './ExposureProgressBar.vue';
import { targetSchedulerApi } from '../services/targetSchedulerApi';
import {
  formatRa,
  formatDec,
  autoAcceptStatus,
  exposureDurationsByFilter,
  computeTargetIntegration,
} from '../calculations';

const props = defineProps({
  target: { type: Object, required: true },
});

const { t } = useI18n();

const showStats = ref(false);
const stats = ref(null);
const statsLoading = ref(false);
const statsError = ref('');

const autoAccept = autoAcceptStatus;

const exposureByFilter = computed(() => exposureDurationsByFilter(props.target.ExposurePlan));

const integration = computed(() => computeTargetIntegration(props.target));

const activeClass = computed(() => (props.target.Active ? 'bg-status-ok' : 'bg-status-warn'));

function autoAcceptTitle(below) {
  return below
    ? t('plugins.targetSchedulerViewer.targetCard.belowAutoAccept')
    : t('plugins.targetSchedulerViewer.targetCard.aboveAutoAccept');
}

function autoAcceptClass(below) {
  return below ? 'text-status-ok' : 'text-status-warn';
}

async function toggleStats() {
  showStats.value = !showStats.value;
  if (showStats.value && !stats.value) {
    statsLoading.value = true;
    statsError.value = '';
    try {
      stats.value = await targetSchedulerApi.getStatistics(props.target.Id);
    } catch (e) {
      statsError.value = e.message;
    } finally {
      statsLoading.value = false;
    }
  }
}
</script>

<template>
  <div class="rounded-md bg-ground p-3">
    <div class="flex items-start justify-between gap-2">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <span
          class="tns-dot"
          :class="activeClass"
          :title="
            target.Active
              ? t('plugins.targetSchedulerViewer.targetCard.active')
              : t('plugins.targetSchedulerViewer.targetCard.inactive')
          "
        />
        <span class="break-words font-semibold">{{ target.Name }}</span>
      </div>
      <button
        class="flex shrink-0 items-center gap-1 rounded bg-surface-3 px-2 py-1 text-[11px] text-content-muted transition-colors hover:brightness-125"
        @click="toggleStats"
      >
        <svg
          class="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 3v18h18M8 17V9m4 8V5m4 12v-6"
          />
        </svg>
        {{
          showStats
            ? t('plugins.targetSchedulerViewer.targetCard.hide')
            : t('plugins.targetSchedulerViewer.targetCard.stats')
        }}
      </button>
    </div>

    <div class="mt-0.5 text-[11px] text-content-faint">
      RA {{ formatRa(target.RA) }} &middot; Dec {{ formatDec(target.Dec) }} &middot; rotation
      {{ target.Rotation }}° &middot; {{ target.Epoch }} &middot; ROI {{ target.ROI }}%
      <span v-if="integration.integrationSeconds > 0">
        &middot;
        {{
          t('plugins.targetSchedulerViewer.targetCard.integratedOf', {
            time: integration.integrationTime,
            expected: integration.expectedIntegrationTime,
          })
        }}
      </span>
      <span v-if="integration.remainingIntegrationSeconds > 0">
        &middot;
        {{
          t('plugins.targetSchedulerViewer.targetCard.remaining', {
            time: integration.remainingIntegrationTime,
          })
        }}
      </span>
    </div>

    <div class="mt-2 space-y-1.5">
      <ExposureProgressBar
        v-for="plan in target.ExposurePlan"
        :key="plan.FilterName"
        :plan="plan"
      />
    </div>

    <div v-if="showStats" class="mt-2 border-t border-line pt-2 text-[11px]">
      <div v-if="statsLoading" class="text-content-faint">
        {{ t('plugins.targetSchedulerViewer.targetCard.loadingStats') }}
      </div>
      <div v-else-if="statsError" class="text-status-danger">{{ statsError }}</div>
      <div v-else-if="stats && stats.length" class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="text-content-faint">
            <tr>
              <th class="pr-2 font-normal">
                {{ t('plugins.targetSchedulerViewer.targetCard.colFilter') }}
              </th>
              <th class="pr-2 font-normal">
                {{ t('plugins.targetSchedulerViewer.targetCard.colExp') }}
              </th>
              <th class="pr-2 font-normal">
                {{ t('plugins.targetSchedulerViewer.targetCard.colHfr') }}
              </th>
              <th class="pr-2 font-normal">
                {{ t('plugins.targetSchedulerViewer.targetCard.colFwhm') }}
              </th>
              <th class="font-normal">
                {{ t('plugins.targetSchedulerViewer.targetCard.colEcc') }}
              </th>
            </tr>
          </thead>
          <tbody class="tabular-nums">
            <tr v-for="s in stats" :key="s.FilterName">
              <td class="whitespace-nowrap pr-2 py-0.5">{{ s.FilterName }}</td>
              <td class="pr-2 text-content-faint">
                {{
                  exposureByFilter.get(s.FilterName)
                    ? exposureByFilter.get(s.FilterName) + 's'
                    : '—'
                }}
              </td>
              <td class="whitespace-nowrap pr-2">
                {{ s.HFRMean.toFixed(2) }} ± {{ s.HFRStdDev.toFixed(2) }}
                <span
                  v-if="autoAccept(s.HFRBelowAutoAcceptLevel) !== null"
                  class="ml-1"
                  :class="autoAcceptClass(autoAccept(s.HFRBelowAutoAcceptLevel))"
                  :title="autoAcceptTitle(autoAccept(s.HFRBelowAutoAcceptLevel))"
                  >{{ autoAccept(s.HFRBelowAutoAcceptLevel) ? '✓' : '✕' }}</span
                >
              </td>
              <td class="whitespace-nowrap pr-2">
                {{ s.FWHMMean.toFixed(2) }} ± {{ s.FWHMStdDev.toFixed(2) }}
                <span
                  v-if="autoAccept(s.FWHMBelowAutoAcceptLevel) !== null"
                  class="ml-1"
                  :class="autoAcceptClass(autoAccept(s.FWHMBelowAutoAcceptLevel))"
                  :title="autoAcceptTitle(autoAccept(s.FWHMBelowAutoAcceptLevel))"
                  >{{ autoAccept(s.FWHMBelowAutoAcceptLevel) ? '✓' : '✕' }}</span
                >
              </td>
              <td class="whitespace-nowrap">
                {{ s.EccentricityMean.toFixed(2) }} ± {{ s.EccentricityStdDev.toFixed(2) }}
                <span
                  v-if="autoAccept(s.EccentricityBelowAutoAcceptLevel) !== null"
                  class="ml-1"
                  :class="autoAcceptClass(autoAccept(s.EccentricityBelowAutoAcceptLevel))"
                  :title="autoAcceptTitle(autoAccept(s.EccentricityBelowAutoAcceptLevel))"
                  >{{ autoAccept(s.EccentricityBelowAutoAcceptLevel) ? '✓' : '✕' }}</span
                >
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-content-faint">
        {{ t('plugins.targetSchedulerViewer.targetCard.noAcceptedFrames') }}
      </div>
    </div>
  </div>
</template>
