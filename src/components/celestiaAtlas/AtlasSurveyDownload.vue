<template>
  <div class="grid gap-3" :data-testid="`atlas-survey-download-${surveyId}`">
    <div>
      <p class="text-gray-200 font-medium">
        {{ $t('components.celestiaAtlas.survey.title') }}
      </p>
      <p class="text-xs text-gray-400">
        {{ $t(surveyKey('hint')) }}
      </p>
    </div>

    <p v-if="surveyStore.supported === false" class="text-sm text-yellow-300">
      {{ $t(surveyKey('plugin_update_required')) }}
    </p>
    <p v-else-if="!surveyStore.loaded" class="text-sm text-gray-400">
      {{ $t('common.loading') }}
    </p>
    <p v-else-if="surveyStore.error" class="text-sm text-red-400">
      {{ surveyStore.error }}
    </p>
    <template v-else>
      <dl class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
        <dt class="text-gray-400">
          {{ $t('components.celestiaAtlas.survey.installed') }}
        </dt>
        <dd class="text-gray-100 break-words">{{ installedSummary }}</dd>
        <dt class="text-gray-400">
          {{ $t('components.celestiaAtlas.survey.free_space') }}
        </dt>
        <dd class="text-gray-100">{{ formatSurveyBytes(surveyStore.freeBytes) }}</dd>
      </dl>

      <div v-if="surveyStore.isRunning" class="grid gap-2">
        <div class="h-2 overflow-hidden rounded-full bg-gray-700">
          <div
            class="h-full bg-cyan-500 transition-[width] duration-300"
            :style="{ width: `${surveyStore.progressFraction * 100}%` }"
          />
        </div>
        <p class="text-sm text-gray-200">
          {{
            $t('components.celestiaAtlas.survey.progress', {
              order: surveyStore.job.currentOrder,
              done: surveyStore.job.tilesDone,
              total: surveyStore.job.tilesTotal,
              size: formatSurveyBytes(surveyStore.job.bytesDownloaded),
            })
          }}
        </p>
        <button
          class="tns-btn-secondary w-auto! justify-self-start"
          type="button"
          :disabled="surveyStore.busy"
          @click="surveyStore.cancelDownload()"
        >
          {{ $t('common.cancel') }}
        </button>
      </div>

      <template v-else>
        <p v-if="jobOutcomeMessage" class="text-sm" :class="jobOutcomeClass">
          {{ jobOutcomeMessage }}
        </p>
        <p v-if="surveyStore.legacyFormat" class="text-sm text-yellow-300">
          {{ $t('components.celestiaAtlas.survey.legacy_format') }}
        </p>

        <label class="grid gap-1" :for="`${surveyId}SurveyTargetOrder`">
          <span class="text-sm text-gray-300">
            {{ $t('components.celestiaAtlas.survey.target_order') }}
          </span>
          <select
            :id="`${surveyId}SurveyTargetOrder`"
            v-model.number="selectedOrder"
            class="tns-select"
          >
            <option
              v-for="option in surveyStore.orderOptions"
              :key="option.order"
              :value="option.order"
              :disabled="option.installed"
            >
              {{ orderOptionLabel(option) }}
            </option>
          </select>
        </label>

        <p v-if="!hasEnoughSpace" class="text-xs text-red-300">
          {{
            $t('components.celestiaAtlas.survey.not_enough_space', {
              needed: formatSurveyBytes(selectedRequiredBytes),
              free: formatSurveyBytes(surveyStore.freeBytes),
            })
          }}
        </p>

        <div class="flex flex-wrap gap-2">
          <button
            class="tns-btn-primary w-auto!"
            type="button"
            :disabled="!canDownload"
            @click="startSurveyDownload"
          >
            {{ $t(downloadButtonKey) }}
          </button>
        </div>

        <div v-if="surveyStore.hasAnyData" class="grid gap-2 border-t border-gray-600 pt-3">
          <label class="grid gap-1" :for="`${surveyId}SurveyDeleteTarget`">
            <span class="text-sm text-gray-300">
              {{ $t('components.celestiaAtlas.survey.delete_target') }}
            </span>
            <select
              :id="`${surveyId}SurveyDeleteTarget`"
              v-model="deleteKeepOrder"
              class="tns-select"
            >
              <option
                v-for="option in deleteOptions"
                :key="String(option.keepOrder)"
                :value="option.keepOrder"
              >
                {{ option.label }}
              </option>
            </select>
          </label>
          <button
            class="tns-btn-danger w-auto! justify-self-start flex items-center gap-2"
            type="button"
            :disabled="surveyStore.busy"
            @click="showDeleteConfirm = true"
          >
            <ArrowPathIcon v-if="deleting" class="h-4 w-4 animate-spin" />
            {{ $t('common.delete') }}
          </button>
        </div>
      </template>

      <p v-if="surveyStore.actionError" class="text-xs text-red-300">
        {{ surveyStore.actionError }}
      </p>

      <p class="text-xs leading-5 text-gray-500">
        {{ $t(surveyKey('terms')) }}
        <a
          class="text-cyan-500 hover:underline"
          :href="termsUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ $t('components.celestiaAtlas.survey.terms_link') }}
        </a>
      </p>
    </template>
  </div>

  <Modal
    :show="showDeleteConfirm"
    zIndex="z-[75]"
    maxWidth="max-w-md"
    @close="showDeleteConfirm = false"
  >
    <template #header>
      <h2 class="text-lg font-bold text-red-500">
        {{ $t('components.celestiaAtlas.survey.delete_confirm_title') }}
      </h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-gray-300 text-sm">{{ deleteConfirmMessage }}</p>
        <div class="flex gap-3 justify-end">
          <button @click="showDeleteConfirm = false" class="tns-btn-secondary w-auto!">
            {{ $t('common.cancel') }}
          </button>
          <button @click="confirmDeleteSurvey" class="tns-btn-danger w-auto!">
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import { useCelestiaAtlasSurveyStore } from '@/store/celestiaAtlasSurveyStore';
import { formatSurveyBytes } from '@/utils/formatSurveyBytes';

// Download, progress and delete for one Atlas survey. The parent keys this component by
// survey id, so the store below never changes for the lifetime of an instance.
const props = defineProps({
  surveyId: {
    type: String,
    required: true,
  },
});

const { t } = useI18n();
const surveyStore = useCelestiaAtlasSurveyStore(props.surveyId);

// Usage terms per survey; DSS keeps its original locale keys, other surveys add a suffix.
const TERMS_URLS = {
  dss: 'https://archive.stsci.edu/dss/copyright.html',
  nsns: 'https://www.simg.de/nebulae3/dr0_2',
};
const termsUrl = TERMS_URLS[props.surveyId] ?? TERMS_URLS.dss;

function surveyKey(name) {
  const suffix = props.surveyId === 'dss' ? '' : `_${props.surveyId}`;
  return `components.celestiaAtlas.survey.${name}${suffix}`;
}

// The Atlas view owns the 2 s status poll; this section only reads the store and fires
// the actions, so a closed dialog changes nothing about a running download.
const selectedOrder = ref(null);

// Default to the next order above the installed one; re-evaluated whenever the installed
// order moves (download finished, survey deleted) so the selection never points at an
// order that is already there.
watch(
  () => [surveyStore.installedOrder, surveyStore.loaded],
  () => {
    selectedOrder.value =
      surveyStore.orderOptions.find((option) => !option.installed)?.order ?? null;
  },
  { immediate: true }
);

const installedSummary = computed(() => {
  const installed = surveyStore.installedOrder;
  const partial = surveyStore.status?.orders?.find(
    (order) => !order.complete && Number(order.tilesPresent) > 0
  );
  const parts = [];
  if (installed === null) {
    parts.push(t('components.celestiaAtlas.survey.not_installed'));
  } else {
    parts.push(
      t('components.celestiaAtlas.survey.installed_order', {
        order: installed,
        size: formatSurveyBytes(surveyStore.totalBytes),
      })
    );
  }
  if (partial) {
    parts.push(
      t('components.celestiaAtlas.survey.partial_order', {
        order: partial.order,
        percent: Math.round((partial.tilesPresent / partial.tileCount) * 100),
      })
    );
  }
  return parts.join(' · ');
});

const selectedRequiredBytes = computed(() =>
  selectedOrder.value === null ? 0 : surveyStore.estimateMissingBytes(selectedOrder.value)
);
const hasEnoughSpace = computed(
  () => selectedOrder.value === null || surveyStore.hasEnoughFreeSpace(selectedOrder.value)
);
const canDownload = computed(
  () => selectedOrder.value !== null && hasEnoughSpace.value && !surveyStore.busy
);

const downloadButtonKey = computed(() => {
  if (surveyStore.legacyFormat) return 'components.celestiaAtlas.survey.download_replace';
  return surveyStore.hasPartialOrder
    ? 'components.celestiaAtlas.survey.resume'
    : 'components.celestiaAtlas.survey.download';
});

const jobOutcomeMessage = computed(() => {
  const job = surveyStore.job;
  if (!job || job.state === 'running') return '';
  if (job.state === 'completed') {
    return t('components.celestiaAtlas.survey.job_completed', { order: job.targetOrder });
  }
  if (job.state === 'cancelled') return t('components.celestiaAtlas.survey.job_cancelled');
  if (job.state === 'failed') {
    return t('components.celestiaAtlas.survey.job_failed', { message: job.error || '' });
  }
  return '';
});
const jobOutcomeClass = computed(() =>
  surveyStore.job?.state === 'failed' ? 'text-red-300' : 'text-gray-300'
);

function orderName(order) {
  return order === surveyStore.baseOrder
    ? t('components.celestiaAtlas.survey.order_base', {
        min: surveyStore.minOrder,
        max: surveyStore.baseOrder,
      })
    : t('components.celestiaAtlas.survey.order_n', { order });
}

function orderOptionLabel(option) {
  const name = orderName(option.order);
  if (option.installed) return `${name} — ${t('components.celestiaAtlas.survey.option_installed')}`;
  return `${name} — ${t('components.celestiaAtlas.survey.option_size', { size: formatSurveyBytes(option.missingBytes) })}`;
}

function startSurveyDownload() {
  if (selectedOrder.value === null) return;
  void surveyStore.startDownload(selectedOrder.value);
}

// --- Delete: keep everything up to a chosen order, or wipe the survey entirely -----------
const deleteKeepOrder = ref(null);
const showDeleteConfirm = ref(false);

// Selectable "keep up to order X" choices between base and the order below the installed
// one, plus "delete everything"; reset whenever the installed order moves so a stale choice
// never lingers (e.g. picking "keep 4" after order 4 itself was just deleted).
watch(
  () => [surveyStore.installedOrder, surveyStore.baseOrder],
  () => {
    deleteKeepOrder.value = null;
  },
  { immediate: true }
);

const deleteOptions = computed(() => {
  const installed = surveyStore.installedOrder;
  const options = [];
  if (installed !== null) {
    for (let order = surveyStore.baseOrder; order < installed; order += 1) {
      options.push({
        keepOrder: order,
        label: t('components.celestiaAtlas.survey.delete_keep_option', { name: orderName(order) }),
      });
    }
  }
  options.push({
    keepOrder: null,
    label: t('components.celestiaAtlas.survey.delete_all_option'),
  });
  return options;
});

const deleteConfirmMessage = computed(() => {
  return deleteKeepOrder.value === null
    ? t('components.celestiaAtlas.survey.delete_confirm')
    : t('components.celestiaAtlas.survey.delete_confirm_keep', {
        name: orderName(deleteKeepOrder.value),
      });
});

const deleting = ref(false);

async function confirmDeleteSurvey() {
  showDeleteConfirm.value = false;
  deleting.value = true;
  try {
    await surveyStore.deleteSurvey(deleteKeepOrder.value);
  } finally {
    deleting.value = false;
  }
}
</script>
