<template>
  <section v-if="store.isPINS" class="tns-card flex flex-col gap-3" :aria-busy="loading || saving">
    <h3 class="tns-section-title">{{ t('components.settings.swap.title') }}</h3>
    <p class="text-sm text-content-muted">{{ t('components.settings.swap.description') }}</p>
    <p v-if="loading" class="text-sm text-content-muted">
      {{ t('components.settings.swap.loading') }}
    </p>
    <template v-else-if="status?.supported">
      <p class="text-sm text-content-muted">
        {{ t('components.settings.swap.current', { size: status.activeSwapSizeMb / 1024 }) }}
      </p>
      <label class="flex flex-col gap-1">
        <span class="text-sm font-semibold text-content">{{
          t('components.settings.swap.size')
        }}</span>
        <select v-model.number="selected" class="tns-select" :disabled="saving">
          <option disabled :value="0">{{ t('components.settings.swap.choose') }}</option>
          <option v-for="size in [2, 4, 8]" :key="size" :value="size">
            {{
              size === 2
                ? t('components.settings.swap.defaultSize')
                : size === 8
                  ? t('components.settings.swap.recommendedSize')
                  : `${size} GB`
            }}
          </option>
        </select>
      </label>
      <p class="text-sm text-content-muted">
        {{
          t('components.settings.swap.freeSpace', {
            size: (status.availableBytes / 1073741824).toFixed(1),
          })
        }}
      </p>
      <p v-if="status.pendingReboot" role="status" class="text-sm text-status-warn">
        {{ t('components.settings.swap.pending', { size: status.configuredSizeMb / 1024 }) }}
      </p>
      <p v-if="saved" role="status" class="text-sm text-status-ok">
        {{ t('components.settings.swap.saved') }}
      </p>
      <button
        class="tns-btn-primary sm:w-auto!"
        :disabled="loading || saving || !dirty"
        @click="save"
      >
        {{ t(saving ? 'components.settings.swap.saving' : 'components.settings.swap.save') }}
      </button>
    </template>
    <p v-else-if="status" class="text-sm text-content-muted">
      {{ t('components.settings.swap.unsupported') }}
    </p>
    <p v-if="errorMessage" role="alert" class="text-sm text-status-danger break-words">
      {{ errorMessage }}
    </p>
    <button
      class="min-h-touch self-start text-accent hover:text-content transition-colors disabled:opacity-50"
      :disabled="loading || saving"
      @click="load"
    >
      {{ t('components.settings.swap.refresh') }}
    </button>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import {
  parseJobIdFromResponse,
  pollJobUntilFinished,
} from '@/components/pins/composables/pinsJobPolling';

const { t } = useI18n();
const store = apiStore();
const status = ref(null);
const selected = ref(2);
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const errorMessage = ref('');
const dirty = computed(
  () =>
    status.value?.supported &&
    [2, 4, 8].includes(selected.value) &&
    (selected.value * 1024 !== status.value.configuredSizeMb ||
      (status.value.backend === 'rpi-swap' && status.value.mechanism !== 'swapfile'))
);

function messageFrom(error) {
  return error?.response?.data?.detail || error?.message || String(error);
}

async function load() {
  if (!store.isPINS || loading.value) return false;
  loading.value = true;
  errorMessage.value = '';
  try {
    status.value = await apiPinsService.getPinsSystemSwap();
    if (!status.value || status.value.activeSwapSizeMb == null) {
      throw new Error(t('components.settings.swap.unavailable'));
    }
    const size = status.value.configuredSizeMb / 1024;
    selected.value = [2, 4, 8].includes(size) ? size : 0;
    return true;
  } catch (error) {
    status.value = null;
    errorMessage.value =
      error?.response?.status === 404
        ? t('components.settings.swap.unavailable')
        : t('components.settings.swap.loadError', { message: messageFrom(error) });
    return false;
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!store.isPINS || saving.value || !dirty.value) return;
  saving.value = true;
  saved.value = false;
  errorMessage.value = '';
  try {
    const response = await apiPinsService.updatePinsSystemSwap(selected.value);
    const jobId = parseJobIdFromResponse(response);
    if (!jobId) throw new Error(t('components.settings.swap.missingJob'));
    const job = await pollJobUntilFinished(jobId);
    if (!job.success) throw new Error(job.result?.errorMessage || job.result?.status || 'failed');
    saved.value = await load();
  } catch (error) {
    errorMessage.value = t('components.settings.swap.saveError', { message: messageFrom(error) });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>
