<template>
  <teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/60 px-3 py-4 sm:px-6 sm:py-8 flex items-start sm:items-center justify-center"
      :class="zIndex"
      @click="onBackdropClick"
    >
      <div
        class="w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden rounded-xl border border-gray-700 bg-gray-900 text-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pins-indi-registry-edit-title"
        @click.stop
      >
        <div
          class="flex items-center justify-between gap-3 border-b border-gray-700 px-4 py-3 sm:px-5"
        >
          <div>
            <h2 id="pins-indi-registry-edit-title" class="text-lg sm:text-xl font-semibold">
              {{ t('plugins.pins.indiRegistryModalTitle') }}
            </h2>
            <p class="text-xs sm:text-sm text-gray-400 mt-1">
              {{ t('plugins.pins.indiRegistryModalDescription') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded px-3 py-2 text-xs sm:text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
              :disabled="loading || disabled || anySaving"
              @click="loadRegistry"
            >
              {{
                loading
                  ? t('plugins.pins.indiRegistryModalLoading')
                  : t('plugins.pins.indiRegistryModalReload')
              }}
            </button>
            <button
              type="button"
              class="rounded p-1 text-gray-300 hover:text-white hover:bg-gray-800 disabled:opacity-50"
              :disabled="anySaving"
              @click="closeModal"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fill-rule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="px-4 py-4 sm:px-5 sm:py-5 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-gray-300">
            <p>
              {{ t('plugins.pins.indiRegistryModalUpdatedAt') }}:
              {{ registryUpdatedAtLabel }}
            </p>
            <p>
              {{ t('plugins.pins.indiRegistryModalTotalEntries') }}:
              {{ registryTotalEntries }}
            </p>
          </div>

          <p
            v-if="globalInfo"
            class="rounded-md border border-emerald-700/70 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-300"
          >
            {{ globalInfo }}
          </p>

          <p
            v-if="loadError"
            class="rounded-md border border-red-800/60 bg-red-900/20 px-3 py-2 text-sm text-red-300"
          >
            {{ loadError }}
          </p>

          <div v-if="loading" class="text-blue-400 text-sm">
            {{ t('plugins.pins.indiRegistryModalLoading') }}
          </div>

          <div
            v-else-if="rows.length === 0"
            class="rounded-lg border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-300"
          >
            {{ t('plugins.pins.indiRegistryModalEmpty') }}
          </div>

          <div v-else>
            <div class="space-y-3 md:hidden">
              <div
                v-for="row in rows"
                :key="row.originalName"
                class="rounded-lg border border-gray-700 bg-gray-800/40 p-3 space-y-3"
              >
                <div>
                  <label
                    class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-300"
                  >
                    {{ t('plugins.pins.indiRegistryModalName') }}
                  </label>
                  <input
                    v-model="row.name"
                    type="text"
                    maxlength="200"
                    class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    :disabled="isRowSaving(row) || disabled"
                    autocomplete="off"
                  />
                  <div class="mt-1 text-xs text-gray-400">{{ getTrimmedLength(row.name) }}/200</div>
                </div>

                <div>
                  <label
                    class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-300"
                  >
                    {{ t('plugins.pins.indiRegistryModalLabel') }}
                  </label>
                  <input
                    v-model="row.label"
                    type="text"
                    maxlength="200"
                    class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    :disabled="isRowSaving(row) || disabled"
                    autocomplete="off"
                  />
                  <div class="mt-1 text-xs text-gray-400">
                    {{ getTrimmedLength(row.label) }}/200
                  </div>
                </div>

                <div>
                  <label
                    class="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-300"
                  >
                    {{ t('plugins.pins.indiRegistryModalType') }}
                  </label>
                  <select
                    v-model="row.type"
                    class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                    :disabled="isRowSaving(row) || disabled"
                  >
                    <option v-for="type in TYPE_OPTIONS" :key="type" :value="type">
                      {{ type }}
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  class="tns-btn-primary w-full inline-flex items-center justify-center disabled:opacity-50"
                  :disabled="isRowSaving(row) || disabled || !canSaveRow(row)"
                  @click="saveRow(row)"
                >
                  <span v-if="isRowSaving(row)">{{
                    t('plugins.pins.indiRegistryModalSaving')
                  }}</span>
                  <span v-else>{{ t('plugins.pins.indiRegistryModalSave') }}</span>
                </button>

                <p
                  v-if="rowMessages[row.originalName]"
                  :class="[
                    'rounded-md px-3 py-2 text-xs',
                    rowMessages[row.originalName].type === 'error'
                      ? 'border border-red-800/60 bg-red-900/20 text-red-300'
                      : 'border border-emerald-700/70 bg-emerald-900/20 text-emerald-300',
                  ]"
                >
                  {{ rowMessages[row.originalName].text }}
                </p>
              </div>
            </div>

            <div
              class="hidden md:block max-h-[58vh] overflow-auto border border-gray-700 rounded-lg"
            >
              <table class="w-full min-w-[840px] text-sm">
                <thead class="bg-gray-900 text-gray-300 sticky top-0 z-10">
                  <tr>
                    <th class="px-3 py-3 text-left font-semibold">
                      {{ t('plugins.pins.indiRegistryModalName') }}
                    </th>
                    <th class="px-3 py-3 text-left font-semibold">
                      {{ t('plugins.pins.indiRegistryModalLabel') }}
                    </th>
                    <th class="px-3 py-3 text-left font-semibold w-48">
                      {{ t('plugins.pins.indiRegistryModalType') }}
                    </th>
                    <th class="px-3 py-3 text-right font-semibold w-40">
                      {{ t('plugins.pins.indiRegistryModalActions') }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <template v-for="row in rows" :key="row.originalName">
                    <tr class="border-t border-gray-700 align-top">
                      <td class="px-3 py-3">
                        <input
                          v-model="row.name"
                          type="text"
                          maxlength="200"
                          class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                          :disabled="isRowSaving(row) || disabled"
                          autocomplete="off"
                        />
                        <div class="mt-1 text-xs text-gray-400">
                          {{ getTrimmedLength(row.name) }}/200
                        </div>
                      </td>
                      <td class="px-3 py-3">
                        <input
                          v-model="row.label"
                          type="text"
                          maxlength="200"
                          class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                          :disabled="isRowSaving(row) || disabled"
                          autocomplete="off"
                        />
                        <div class="mt-1 text-xs text-gray-400">
                          {{ getTrimmedLength(row.label) }}/200
                        </div>
                      </td>
                      <td class="px-3 py-3">
                        <select
                          v-model="row.type"
                          class="w-full rounded-md border border-gray-600 bg-gray-800 px-2.5 py-2 text-white outline-none focus:border-blue-500 disabled:opacity-60"
                          :disabled="isRowSaving(row) || disabled"
                        >
                          <option v-for="type in TYPE_OPTIONS" :key="type" :value="type">
                            {{ type }}
                          </option>
                        </select>
                      </td>
                      <td class="px-3 py-3 text-right">
                        <button
                          type="button"
                          class="tns-btn-primary inline-flex min-w-[112px] items-center justify-center disabled:opacity-50"
                          :disabled="isRowSaving(row) || disabled || !canSaveRow(row)"
                          @click="saveRow(row)"
                        >
                          <span v-if="isRowSaving(row)">{{
                            t('plugins.pins.indiRegistryModalSaving')
                          }}</span>
                          <span v-else>{{ t('plugins.pins.indiRegistryModalSave') }}</span>
                        </button>
                      </td>
                    </tr>
                    <tr v-if="rowMessages[row.originalName]" class="border-t border-gray-800">
                      <td colspan="4" class="px-3 py-2">
                        <p
                          :class="[
                            'rounded-md px-3 py-2 text-xs sm:text-sm',
                            rowMessages[row.originalName].type === 'error'
                              ? 'border border-red-800/60 bg-red-900/20 text-red-300'
                              : 'border border-emerald-700/70 bg-emerald-900/20 text-emerald-300',
                          ]"
                        >
                          {{ rowMessages[row.originalName].text }}
                        </p>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-700 px-4 py-3 sm:px-5">
          <div class="flex justify-end">
            <button
              type="button"
              class="tns-btn-secondary w-full sm:w-auto"
              :disabled="anySaving"
              @click="closeModal"
            >
              {{ t('common.cancel') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';

const TYPE_OPTIONS = Object.freeze([
  'camera',
  'filterwheel',
  'flatpanel',
  'focuser',
  'rotator',
  'switches',
  'telescope',
  'weather',
]);

const TYPE_ALIASES = Object.freeze({
  cameras: 'camera',
  ccd: 'camera',
  ccds: 'camera',
});

const { t } = useI18n();

const props = defineProps({
  show: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  // Callers rendering this from inside a full-screen overlay (the PINS setup
  // wizard sits at z-overlay) must raise this, or the dialog opens behind them.
  zIndex: {
    type: String,
    default: 'z-50',
  },
});

const emit = defineEmits(['close']);

const loading = ref(false);
const loadError = ref('');
const globalInfo = ref('');
const registry = ref(null);
const rows = ref([]);
const savingByEntryName = ref({});
const rowMessages = ref({});

const anySaving = computed(() => {
  return Object.values(savingByEntryName.value).some(Boolean);
});

const registryUpdatedAtLabel = computed(() => {
  const value = registry.value?.updatedAt;
  return value ? new Date(value).toLocaleString() : '-';
});

const registryTotalEntries = computed(() => {
  const total = Number(registry.value?.totalEntries);
  if (Number.isFinite(total) && total >= 0) {
    return total;
  }
  return rows.value.length;
});

function normalizeType(type) {
  const raw = String(type || '')
    .trim()
    .toLowerCase();

  if (!raw) {
    return 'switches';
  }

  const alias = TYPE_ALIASES[raw] || raw;
  if (TYPE_OPTIONS.includes(alias)) {
    return alias;
  }

  return 'switches';
}

function normalizeInput(value) {
  return String(value || '').trim();
}

function getTrimmedLength(value) {
  return normalizeInput(value).length;
}

function hasUnsavedChanges(row) {
  if (!row || typeof row !== 'object') {
    return false;
  }

  return (
    normalizeInput(row.name) !== row.originalName ||
    normalizeInput(row.label) !== row.originalLabel ||
    normalizeType(row.type) !== row.originalType
  );
}

function flattenRegistryPayload(
  payload,
  existingRows = [],
  { skipPreserveForOriginalName = '' } = {}
) {
  const entriesByType = payload?.entriesByType;
  if (!entriesByType || typeof entriesByType !== 'object') {
    return [];
  }

  const flattenedRows = [];
  const existingMap = new Map(
    Array.isArray(existingRows) ? existingRows.map((row) => [row.originalName, row]) : []
  );

  for (const [bucketType, entries] of Object.entries(entriesByType)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      const originalName = normalizeInput(entry?.Name);
      if (!originalName) {
        continue;
      }

      const normalizedType = normalizeType(entry?.Type || bucketType);
      const originalLabel = normalizeInput(entry?.Label);
      const existingRow = existingMap.get(originalName);

      let rowName = originalName;
      let rowLabel = originalLabel;
      let rowType = normalizedType;

      if (
        existingRow &&
        originalName !== skipPreserveForOriginalName &&
        hasUnsavedChanges(existingRow)
      ) {
        rowName = normalizeInput(existingRow.name);
        rowLabel = normalizeInput(existingRow.label);
        rowType = normalizeType(existingRow.type);
      }

      flattenedRows.push({
        originalName,
        originalLabel,
        originalType: normalizedType,
        name: rowName,
        label: rowLabel,
        type: rowType,
      });
    }
  }

  return flattenedRows.sort((a, b) => a.originalName.localeCompare(b.originalName));
}

function clearRowMessage(entryName) {
  const nextMessages = { ...rowMessages.value };
  delete nextMessages[entryName];
  rowMessages.value = nextMessages;
}

function setRowMessage(entryName, text, type = 'error') {
  rowMessages.value = {
    ...rowMessages.value,
    [entryName]: { text, type },
  };
}

async function loadRegistry() {
  if (loading.value) {
    return;
  }

  loading.value = true;
  loadError.value = '';
  globalInfo.value = '';
  rowMessages.value = {};

  try {
    const response = await apiPinsService.getPinsIndi3rdpartyRegistry();
    registry.value = response;
    rows.value = flattenRegistryPayload(response, rows.value);
  } catch (error) {
    const detail = extractErrorDetail(error);
    loadError.value = t('plugins.pins.indiRegistryModalErrorLoad', { message: detail });
  } finally {
    loading.value = false;
  }
}

function buildPatchPayload(row) {
  const normalizedName = normalizeInput(row.name);
  const normalizedLabel = normalizeInput(row.label);
  const normalizedType = normalizeType(row.type);

  const payload = {};
  if (normalizedName !== row.originalName) {
    payload.Name = normalizedName;
  }
  if (normalizedLabel !== row.originalLabel) {
    payload.Label = normalizedLabel;
  }
  if (normalizedType !== row.originalType) {
    payload.Type = normalizedType;
  }

  return {
    payload,
    normalizedName,
    normalizedLabel,
    normalizedType,
  };
}

function validateRow(row) {
  const normalizedName = normalizeInput(row.name);
  const normalizedLabel = normalizeInput(row.label);
  const normalizedType = normalizeType(row.type);

  if (!normalizedName) {
    return {
      isValid: false,
      message: t('plugins.pins.indiRegistryModalNameRequired'),
    };
  }

  if (normalizedName.length > 200) {
    return {
      isValid: false,
      message: t('plugins.pins.indiRegistryModalNameLength'),
    };
  }

  if (normalizedLabel.length > 200) {
    return {
      isValid: false,
      message: t('plugins.pins.indiRegistryModalLabelLength'),
    };
  }

  if (!TYPE_OPTIONS.includes(normalizedType)) {
    return {
      isValid: false,
      message: t('plugins.pins.indiRegistryModalTypeInvalid'),
    };
  }

  const duplicateName = rows.value.some((candidate) => {
    if (candidate.originalName === row.originalName) {
      return false;
    }

    return normalizeInput(candidate.name).toLowerCase() === normalizedName.toLowerCase();
  });

  if (duplicateName) {
    return {
      isValid: false,
      message: t('plugins.pins.indiRegistryModalNameDuplicate'),
    };
  }

  return {
    isValid: true,
    message: '',
  };
}

function canSaveRow(row) {
  const validation = validateRow(row);
  if (!validation.isValid) {
    return false;
  }

  const { payload } = buildPatchPayload(row);
  return Object.keys(payload).length > 0;
}

function isRowSaving(row) {
  return Boolean(savingByEntryName.value[row.originalName]);
}

function extractErrorDetail(error) {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData.trim();
  }

  if (responseData && typeof responseData === 'object') {
    if (typeof responseData.detail === 'string' && responseData.detail.trim()) {
      return responseData.detail.trim();
    }

    if (typeof responseData.message === 'string' && responseData.message.trim()) {
      return responseData.message.trim();
    }

    try {
      return JSON.stringify(responseData);
    } catch {
      return '';
    }
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return '';
}

function resolvePatchErrorMessage(error) {
  const status = Number(error?.response?.status);
  const detail = extractErrorDetail(error) || t('plugins.pins.indiRegistryModalErrorUnknown');

  if (status === 404) {
    return t('plugins.pins.indiRegistryModalErrorNotFound');
  }

  if (status === 409) {
    return t('plugins.pins.indiRegistryModalErrorConflict');
  }

  if (status === 400 || status === 422) {
    return t('plugins.pins.indiRegistryModalErrorValidation', { message: detail });
  }

  return t('plugins.pins.indiRegistryModalErrorGeneric', { message: detail });
}

async function saveRow(row) {
  if (props.disabled) {
    return;
  }

  const validation = validateRow(row);
  if (!validation.isValid) {
    setRowMessage(row.originalName, validation.message, 'error');
    return;
  }

  const { payload } = buildPatchPayload(row);
  if (!Object.keys(payload).length) {
    setRowMessage(row.originalName, t('plugins.pins.indiRegistryModalNoChanges'), 'success');
    return;
  }

  clearRowMessage(row.originalName);

  savingByEntryName.value = {
    ...savingByEntryName.value,
    [row.originalName]: true,
  };

  try {
    const response = await apiPinsService.updatePinsIndi3rdpartyRegistryEntry(
      row.originalName,
      payload
    );
    registry.value = response;
    rows.value = flattenRegistryPayload(response, rows.value, {
      skipPreserveForOriginalName: row.originalName,
    });
    rowMessages.value = {};
    globalInfo.value = t('plugins.pins.indiRegistryModalSaved');
  } catch (error) {
    const message = resolvePatchErrorMessage(error);
    setRowMessage(row.originalName, message, 'error');
  } finally {
    const nextState = { ...savingByEntryName.value };
    delete nextState[row.originalName];
    savingByEntryName.value = nextState;
  }
}

function closeModal() {
  if (!anySaving.value) {
    emit('close');
  }
}

function onBackdropClick() {
  closeModal();
}

watch(
  () => props.show,
  async (visible) => {
    if (!visible) {
      document.body.style.overflow = '';
      loadError.value = '';
      globalInfo.value = '';
      rowMessages.value = {};
      rows.value = [];
      return;
    }

    document.body.style.overflow = 'hidden';
    await loadRegistry();
  }
);

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>
