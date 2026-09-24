<template>
  <button
    @click="toggleControls"
    class="celestia-atlas-icon-button celestia-atlas-header-button"
    :class="{ 'is-active': settingsVisible }"
    type="button"
    :title="$t('components.celestiaAtlas.settings.title')"
    :aria-label="$t('components.celestiaAtlas.settings.title')"
  >
    <Cog6ToothIcon class="h-6 w-6" />
  </button>

  <Modal :show="settingsVisible" @close="settingsVisible = false" zIndex="z-40">
    <template #header>
      <h3>{{ $t('components.celestiaAtlas.settings.title') }}</h3>
    </template>
    <template #body>
      <!-- self-start: the modal body is a stretching flex row; a stretched wrapper would be
           capped at the body height and squeeze the grid rows, collapsing the tab strip. -->
      <div class="grid w-full gap-4 self-start">
        <!-- One tab per topic; the strip stays visible while the tab content scrolls. -->
        <div class="atlas-settings-tabs" role="tablist">
          <button
            v-for="tab in tabs"
            :key="tab"
            class="atlas-settings-tab"
            :class="{ 'is-active': activeTab === tab }"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab"
            @click="activeTab = tab"
          >
            {{ $t(`components.celestiaAtlas.settings.section_${tab}`) }}
          </button>
        </div>

        <div v-if="activeTab === 'display'" class="atlas-settings-list" role="tabpanel">
          <div v-for="row in displayToggles" :key="row.key" class="atlas-settings-row">
            <span class="atlas-settings-label">
              {{ $t(`components.celestiaAtlas.settings.${row.label}`) }}
            </span>
            <toggleButton
              @click="settingsStore.celestiaAtlas[row.key] = !settingsStore.celestiaAtlas[row.key]"
              :status-value="Boolean(settingsStore.celestiaAtlas[row.key])"
            />
          </div>
          <div class="atlas-settings-row">
            <span class="atlas-settings-label">
              {{ $t('components.celestiaAtlas.settings.hide_below_horizon') }}
            </span>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.hideBelowHorizon =
                  settingsStore.celestiaAtlas.hideBelowHorizon === false
              "
              :status-value="settingsStore.celestiaAtlas.hideBelowHorizon !== false"
            />
          </div>
        </div>

        <div v-else-if="activeTab === 'landscape'" class="grid gap-3" role="tabpanel">
          <div class="atlas-settings-list">
            <div class="atlas-settings-row">
              <span class="atlas-settings-label">
                {{ $t('components.celestiaAtlas.settings.landscapes_visible') }}
              </span>
              <toggleButton
                @click="showLandscape"
                :status-value="settingsStore.celestiaAtlas.landscapesVisible"
              />
            </div>
          </div>
          <div class="grid gap-2" v-if="settingsStore.celestiaAtlas.landscapesVisible">
            <label for="landscapeSourceMode" class="text-gray-400 block mb-1">
              {{ $t('components.celestiaAtlas.settings.landscape_source_mode') }}
            </label>
            <select
              id="landscapeSourceMode"
              v-model="landscapeSourceSelection"
              class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
            >
              <option value="default">
                {{ $t('components.celestiaAtlas.settings.landscape_source_default') }}
              </option>
              <option value="guereins">
                {{ $t('components.celestiaAtlas.settings.landscape_source_guereins') }}
              </option>
              <option value="neutral">
                {{ $t('components.celestiaAtlas.settings.landscape_source_neutral') }}
              </option>
              <option
                v-for="landscapeOption in listedLandscapeOptions"
                :key="landscapeOption.value"
                :value="landscapeOption.value"
              >
                {{
                  $t('components.celestiaAtlas.settings.landscape_option_label', {
                    title: landscapeOption.title,
                  })
                }}
              </option>
              <option value="custom">
                {{ $t('components.celestiaAtlas.settings.landscape_source_custom') }}
              </option>
            </select>

            <div
              v-if="settingsStore.celestiaAtlas.landscapeSourceMode === 'custom'"
              class="mt-2 grid gap-2"
            >
              <div>
                <label for="customLandscapeUrl" class="text-gray-400 block mb-1 text-sm">
                  {{ $t('components.celestiaAtlas.settings.custom_landscape_url') }}
                </label>
                <input
                  id="customLandscapeUrl"
                  v-model="settingsStore.celestiaAtlas.customLandscapeUrl"
                  type="text"
                  class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                  :placeholder="
                    $t('components.celestiaAtlas.settings.custom_landscape_url_placeholder')
                  "
                />
              </div>

              <div>
                <label for="customLandscapeKey" class="text-gray-400 block mb-1 text-sm">
                  {{ $t('components.celestiaAtlas.settings.custom_landscape_key') }}
                </label>
                <input
                  id="customLandscapeKey"
                  v-model="settingsStore.celestiaAtlas.customLandscapeKey"
                  type="text"
                  class="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
                  :placeholder="
                    $t('components.celestiaAtlas.settings.custom_landscape_key_placeholder')
                  "
                />
              </div>
            </div>

            <div class="mt-3 flex justify-end">
              <button
                class="px-3 py-1 rounded bg-cyan-700 hover:bg-cyan-600 text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                :disabled="!landscapeSourceDirty"
                @click="saveLandscapeSourceSettings"
              >
                {{ $t('general.save') }}
              </button>
            </div>

            <div class="mt-3 border border-gray-600 rounded-lg p-2 bg-gray-800/40">
              <div class="flex items-center justify-between gap-2">
                <p class="text-gray-300 text-sm font-medium">
                  {{ $t('components.celestiaAtlas.settings.available_landscapes') }}
                </p>
                <button
                  type="button"
                  class="px-2 py-1 rounded border border-gray-500 bg-gray-700 hover:bg-gray-600 text-xs text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="landscapeListLoading"
                  @click="fetchAvailableLandscapes"
                >
                  {{ $t('common.refresh') }}
                </button>
              </div>

              <div class="mt-2 text-sm">
                <p v-if="landscapeListLoading" class="text-gray-400">
                  {{ $t('common.loading') }}
                </p>
                <p v-else-if="landscapeListError" class="text-red-400">
                  {{ landscapeListError }}
                </p>
                <p
                  v-else-if="landscapeListLoaded && availableLandscapes.length === 0"
                  class="text-gray-400"
                >
                  {{ $t('components.celestiaAtlas.settings.no_landscapes_available') }}
                </p>

                <ul v-else class="space-y-2 max-h-52 overflow-y-auto pr-1">
                  <li
                    v-for="(landscape, index) in availableLandscapes"
                    :key="`${landscape.folderName || 'unknown'}-${landscape.serviceUrl || index}`"
                    class="rounded border border-gray-700 bg-gray-900/60 p-2"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <p class="text-gray-100 font-medium truncate">
                        {{
                          landscape.title ||
                          landscape.folderName ||
                          $t('components.celestiaAtlas.settings.untitled_landscape')
                        }}
                      </p>
                      <span
                        class="text-[10px] px-2 py-0.5 rounded-full"
                        :class="
                          landscape.hasAllsky
                            ? 'bg-green-900 text-green-200'
                            : 'bg-yellow-900 text-yellow-200'
                        "
                      >
                        {{
                          landscape.hasAllsky
                            ? $t('components.celestiaAtlas.settings.has_allsky')
                            : $t('components.celestiaAtlas.settings.no_allsky')
                        }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1 break-all">
                      {{ $t('components.celestiaAtlas.settings.folder_name_label') }}:
                      {{ landscape.folderName || '—' }}
                    </p>
                    <p class="text-xs text-gray-400 mt-1 break-all">
                      {{ $t('components.celestiaAtlas.settings.service_url_label') }}:
                      {{ landscape.serviceUrl || '—' }}
                    </p>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="activeTab === 'survey'" class="grid gap-3" role="tabpanel">
          <div
            class="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-line pb-3"
          >
            <div class="min-w-0 max-w-full">
              <label
                for="skySurveyVisible"
                class="block break-words whitespace-normal text-gray-300"
              >
                {{ $t('components.celestiaAtlas.settings.sky_survey_visible') }}
              </label>
              <p
                class="mt-1 max-w-full break-words whitespace-normal text-xs leading-5 text-gray-400"
              >
                {{ $t('components.celestiaAtlas.settings.sky_survey_hint') }}
              </p>
            </div>
            <div class="shrink-0">
              <toggleButton
                @click="
                  settingsStore.celestiaAtlas.skySurveyVisible =
                    settingsStore.celestiaAtlas.skySurveyVisible === false
                "
                :status-value="settingsStore.celestiaAtlas.skySurveyVisible !== false"
              />
            </div>
          </div>
          <div class="grid gap-3" data-testid="atlas-survey-download">
            <div>
              <p class="text-gray-200 font-medium">
                {{ $t('components.celestiaAtlas.survey.title') }}
              </p>
              <p class="text-xs text-gray-400">
                {{ $t('components.celestiaAtlas.survey.hint') }}
              </p>
            </div>

            <p v-if="surveyStore.supported === false" class="text-sm text-yellow-300">
              {{ $t('components.celestiaAtlas.survey.plugin_update_required') }}
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

                <label class="grid gap-1" for="dssSurveyTargetOrder">
                  <span class="text-sm text-gray-300">
                    {{ $t('components.celestiaAtlas.survey.target_order') }}
                  </span>
                  <select
                    id="dssSurveyTargetOrder"
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
                  <label class="grid gap-1" for="dssSurveyDeleteTarget">
                    <span class="text-sm text-gray-300">
                      {{ $t('components.celestiaAtlas.survey.delete_target') }}
                    </span>
                    <select id="dssSurveyDeleteTarget" v-model="deleteKeepOrder" class="tns-select">
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
                {{ $t('components.celestiaAtlas.survey.terms') }}
                <a
                  class="text-cyan-500 hover:underline"
                  href="https://archive.stsci.edu/dss/copyright.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ $t('components.celestiaAtlas.survey.terms_link') }}
                </a>
              </p>
            </template>
          </div>
        </div>

        <div v-else-if="activeTab === 'catalogs'" class="grid gap-3" role="tabpanel">
          <div class="atlas-settings-list">
            <div class="atlas-settings-row">
              <span class="atlas-settings-label">
                {{ $t('components.celestiaAtlas.settings.dsos_visible') }}
              </span>
              <toggleButton
                @click="
                  settingsStore.celestiaAtlas.dsosVisible = !settingsStore.celestiaAtlas.dsosVisible
                "
                :status-value="settingsStore.celestiaAtlas.dsosVisible"
              />
            </div>
          </div>
          <AtlasCatalogFilters
            :object-types="catalogObjectTypes"
            :catalogue-groups="catalogueGroups"
            :star-catalogue-groups="starCatalogueGroups"
            :disabled="!settingsStore.celestiaAtlas.dsosVisible"
          />
          <div class="grid gap-3">
            <div>
              <p class="text-gray-200 font-medium">
                {{ $t('components.celestiaAtlas.settings.brightness_filters') }}
              </p>
              <p class="text-xs text-gray-400">
                {{ $t('components.celestiaAtlas.settings.magnitude_limit_hint') }}
              </p>
            </div>

            <label class="grid gap-1" for="starMagnitudeLimit">
              <span class="flex justify-between gap-2 text-sm text-gray-300">
                <span>{{ $t('components.celestiaAtlas.settings.star_magnitude_limit') }}</span>
                <output>{{ formatMagnitudeLimit(starMagnitudeLimit) }}</output>
              </span>
              <input
                id="starMagnitudeLimit"
                v-model.number="starMagnitudeLimit"
                type="range"
                min="-2"
                max="20"
                step="0.1"
                class="w-full h-11 accent-cyan-500"
              />
            </label>

            <label class="grid gap-1" for="galaxyMagnitudeLimit">
              <span class="flex justify-between gap-2 text-sm text-gray-300">
                <span>{{ $t('components.celestiaAtlas.settings.galaxy_magnitude_limit') }}</span>
                <output>{{ formatMagnitudeLimit(galaxyMagnitudeLimit) }}</output>
              </span>
              <input
                id="galaxyMagnitudeLimit"
                v-model.number="galaxyMagnitudeLimit"
                type="range"
                min="-2"
                max="30"
                step="0.5"
                class="w-full h-11 accent-cyan-500"
              />
            </label>

            <label class="grid gap-1" for="deepSkyMagnitudeLimit">
              <span class="flex justify-between gap-2 text-sm text-gray-300">
                <span>{{ $t('components.celestiaAtlas.settings.dso_magnitude_limit') }}</span>
                <output>{{ formatMagnitudeLimit(deepSkyMagnitudeLimit) }}</output>
              </span>
              <input
                id="deepSkyMagnitudeLimit"
                v-model.number="deepSkyMagnitudeLimit"
                type="range"
                min="-2"
                max="30"
                step="0.5"
                class="w-full h-11 accent-cyan-500"
              />
            </label>
          </div>
          <div
            class="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line pt-3"
          >
            <div class="min-w-0 max-w-full">
              <div class="block break-words whitespace-normal text-gray-300">
                {{ $t('components.celestiaAtlas.settings.comet_data_title') }}
              </div>
              <p class="mt-1 max-w-full break-words whitespace-normal text-xs text-gray-400">
                <template v-if="cometRefreshState === 'success'">
                  {{
                    $t('components.celestiaAtlas.settings.comet_data_updated', {
                      count: cometRefreshCount,
                    })
                  }}
                </template>
                <template v-else-if="cometRefreshState === 'error'">
                  {{
                    $t('components.celestiaAtlas.settings.comet_data_failed', {
                      message: cometRefreshError,
                    })
                  }}
                </template>
                <template v-else>
                  {{ $t('components.celestiaAtlas.settings.comet_data_hint') }}
                </template>
              </p>
            </div>
            <button
              class="tns-btn-primary min-h-11 shrink-0 disabled:opacity-60"
              type="button"
              :disabled="cometRefreshState === 'loading'"
              @click="$emit('refresh-comets')"
            >
              {{
                $t(
                  cometRefreshState === 'loading'
                    ? 'components.celestiaAtlas.settings.refreshing_comet_data'
                    : 'components.celestiaAtlas.settings.refresh_comet_data'
                )
              }}
            </button>
          </div>
        </div>

        <CelestiaAtlasAbout v-else-if="activeTab === 'about'" role="tabpanel" />
      </div>
    </template>
  </Modal>

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
import { useSettingsStore } from '@/store/settingsStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { watch, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Cog6ToothIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';
import Modal from '@/components/helpers/Modal.vue';
import apiService from '@/services/apiService';
import AtlasCatalogFilters from '@/components/celestiaAtlas/AtlasCatalogFilters.vue';
import CelestiaAtlasAbout from '@/components/celestiaAtlas/CelestiaAtlasAbout.vue';
import {
  BUNDLED_LANDSCAPE_KEYS,
  canonicalizeCelestiaAtlasDataUrl,
} from '@/store/utils/celestiaAtlasSettingsMigration';
import { useCelestiaAtlasSurveyStore } from '@/store/celestiaAtlasSurveyStore';
import { formatSurveyBytes } from '@/utils/formatSurveyBytes';

defineProps({
  starCatalogueGroups: {
    type: Array,
    default: () => [],
  },
  catalogObjectTypes: {
    type: Array,
    default: () => [],
  },
  catalogueGroups: {
    type: Array,
    default: () => [],
  },
  cometRefreshState: {
    type: String,
    default: 'idle',
  },
  cometRefreshCount: {
    type: Number,
    default: 0,
  },
  cometRefreshError: {
    type: String,
    default: '',
  },
});
defineEmits(['refresh-comets']);
const { t } = useI18n();
const settingsStore = useSettingsStore();
const surveyStore = useCelestiaAtlasSurveyStore();
const settingsVisible = ref(false);
const landscapeSourceDirty = ref(false);
const availableLandscapes = ref([]);
const landscapeListLoading = ref(false);
const landscapeListLoaded = ref(false);
const landscapeListError = ref('');

function normalizeLandscapePath(path) {
  return String(path || '')
    .trim()
    .replace(/\/+$/g, '')
    .toLowerCase();
}

const listedLandscapeOptions = computed(() => {
  return availableLandscapes.value
    .filter((item) => {
      const folder = String(item?.folderName || '').toLowerCase();
      return Boolean(folder) && !BUNDLED_LANDSCAPE_KEYS.has(folder);
    })
    .map((item) => {
      const folderName = item.folderName;
      const title = item.title || folderName;
      return {
        value: `listed:${folderName}`,
        title,
        folderName,
        serviceUrl: canonicalizeCelestiaAtlasDataUrl(item.serviceUrl),
      };
    });
});

function applyListedLandscapeSelection(folderName) {
  const selected = listedLandscapeOptions.value.find((option) => option.folderName === folderName);
  if (!selected) return;

  settingsStore.celestiaAtlas.landscapeSourceMode = 'custom';
  settingsStore.celestiaAtlas.customLandscapeUrl =
    selected.serviceUrl || `landscapes/${folderName}`;
  settingsStore.celestiaAtlas.customLandscapeKey = folderName || 'custom';
}

const landscapeSourceSelection = computed({
  get() {
    const mode = settingsStore.celestiaAtlas.landscapeSourceMode;
    if (mode === 'default' || mode === 'guereins' || mode === 'neutral') {
      return mode;
    }

    if (mode === 'custom') {
      const customUrl = normalizeLandscapePath(settingsStore.celestiaAtlas.customLandscapeUrl);
      const customKey = String(settingsStore.celestiaAtlas.customLandscapeKey || '')
        .trim()
        .toLowerCase();

      const listedMatch = listedLandscapeOptions.value.find((option) => {
        const optionUrl = normalizeLandscapePath(option.serviceUrl);
        const optionFolder = String(option.folderName || '')
          .trim()
          .toLowerCase();

        return (
          (customUrl && optionUrl && customUrl === optionUrl) ||
          (customKey && optionFolder && customKey === optionFolder)
        );
      });

      if (listedMatch) {
        return listedMatch.value;
      }

      return 'custom';
    }

    return 'default';
  },
  set(value) {
    if (value === 'default' || value === 'guereins' || value === 'neutral' || value === 'custom') {
      settingsStore.celestiaAtlas.landscapeSourceMode = value;
      return;
    }

    if (typeof value === 'string' && value.startsWith('listed:')) {
      const folderName = value.slice('listed:'.length);
      applyListedLandscapeSelection(folderName);
    }
  },
});

function toggleControls() {
  const opening = !settingsVisible.value;
  settingsVisible.value = opening;
  if (opening && !landscapeListLoaded.value && !landscapeListLoading.value) {
    void fetchAvailableLandscapes();
  }
  if (opening) {
    void surveyStore.refresh();
  }
}

// --- DSS survey download -------------------------------------------------------------
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

function saveLandscapeSourceSettings() {
  landscapeSourceDirty.value = false;
}

function showLandscape() {
  settingsStore.celestiaAtlas.landscapesVisible = !settingsStore.celestiaAtlas.landscapesVisible;
}

async function fetchAvailableLandscapes() {
  landscapeListLoading.value = true;
  landscapeListError.value = '';

  try {
    const response = await apiService.listStellariumLandscapes();
    if (response?.success === true) {
      const rawItems = Array.isArray(response.landscapes) ? response.landscapes : [];
      availableLandscapes.value = rawItems.map((item) => ({
        folderName: item?.folderName ?? item?.FolderName ?? '',
        title: item?.title ?? item?.Title ?? '',
        serviceUrl: canonicalizeCelestiaAtlasDataUrl(item?.serviceUrl ?? item?.ServiceUrl ?? ''),
        hasAllsky: item?.hasAllsky ?? item?.HasAllsky ?? false,
      }));
    } else {
      availableLandscapes.value = [];
      landscapeListError.value =
        response?.message || t('components.celestiaAtlas.settings.landscape_list_load_failed');
    }
  } catch (error) {
    const responseMessage = error?.response?.data?.message || error?.response?.data?.error;
    landscapeListError.value =
      responseMessage ||
      error?.message ||
      t('components.celestiaAtlas.settings.landscape_list_load_failed');
    availableLandscapes.value = [];
  } finally {
    landscapeListLoading.value = false;
    landscapeListLoaded.value = true;
  }
}

// Tabs of the dialog; the last one opened stays selected while the dialog is closed.
const tabs = ['display', 'landscape', 'survey', 'catalogs', 'about'];
const activeTab = ref('display');

// Plain on/off display toggles; hideBelowHorizon is inverted and has its own row.
const displayToggles = [
  { key: 'compassVisible', label: 'compass_visible' },
  { key: 'constellationsLinesVisible', label: 'constellations_lines_visible' },
  { key: 'equatorialLinesVisible', label: 'equatorial_lines_visible' },
  { key: 'azimuthalLinesVisible', label: 'azimuthal_lines_visible' },
  { key: 'meridianLinesVisible', label: 'meridian_lines_visible' },
  { key: 'eclipticLinesVisible', label: 'ecliptic_lines_visible' },
  { key: 'atmosphereVisible', label: 'atmosphere_visible' },
];

function formatMagnitudeLimit(value) {
  return value === 30
    ? t('components.celestiaAtlas.settings.magnitude_limit_auto')
    : value.toFixed(1);
}

function createMagnitudeModel(key, fallback, minimum, maximum) {
  return computed({
    get() {
      const value = Number(settingsStore.celestiaAtlas[key]);
      return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
    },
    set(value) {
      settingsStore.celestiaAtlas[key] = Math.max(minimum, Math.min(maximum, Number(value)));
    },
  });
}

const starMagnitudeLimit = createMagnitudeModel('starMagnitudeLimit', 6.5, -2, 20);
const galaxyMagnitudeLimit = createMagnitudeModel('galaxyMagnitudeLimit', 30, -2, 30);
const deepSkyMagnitudeLimit = createMagnitudeModel('deepSkyMagnitudeLimit', 30, -2, 30);

watch(
  () => [
    settingsStore.celestiaAtlas.landscapeSourceMode,
    settingsStore.celestiaAtlas.customLandscapeUrl,
    settingsStore.celestiaAtlas.customLandscapeKey,
  ],
  () => {
    landscapeSourceDirty.value = true;
  }
);
</script>
<style scoped>
.atlas-settings-tabs {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  min-height: var(--spacing-touch);
  gap: 0.25rem;
  overflow-x: auto;
  scrollbar-width: none;
  background: var(--color-surface-1);
  border-bottom: 1px solid var(--color-line);
}
.atlas-settings-tabs::-webkit-scrollbar {
  display: none;
}
.atlas-settings-tab {
  flex: 0 0 auto;
  min-height: var(--spacing-touch);
  padding: 0 0.75rem;
  font-size: 0.875rem;
  white-space: nowrap;
  color: var(--color-content-muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.atlas-settings-tab.is-active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
.atlas-settings-list {
  display: grid;
}
.atlas-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: var(--spacing-touch);
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--color-line);
}
.atlas-settings-row:last-child {
  border-bottom: 0;
}
.atlas-settings-label {
  font-size: 0.875rem;
  color: var(--color-content);
}
</style>
