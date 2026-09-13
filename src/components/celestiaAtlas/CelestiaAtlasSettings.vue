<template>
  <button
    @click="toggleControls"
    class="celestia-atlas-icon-button bg-gray-700 border border-cyan-600 rounded-full shadow-md"
    :class="{ 'bg-cyan-600': settingsVisible }"
    type="button"
    title="Atlas settings"
    aria-label="Atlas settings"
  >
    <Cog6ToothIcon class="w-7 h-7" />
  </button>

  <Modal :show="settingsVisible" @close="settingsVisible = false" zIndex="z-40">
    <template #header>
      <h3>{{ $t('components.celestiaAtlas.settings.title') }}</h3>
    </template>
    <template #body>
      <!-- Settings Container with conditional grid layout -->
      <div :class="settingsContainerClasses">
        <div
          class="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-500 p-3 col-span-full"
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

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="constellationsLinesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.constellations_lines_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.constellationsLinesVisible =
                  !settingsStore.celestiaAtlas.constellationsLinesVisible
              "
              :status-value="settingsStore.celestiaAtlas.constellationsLinesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="azimuthalLinesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.azimuthal_lines_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.azimuthalLinesVisible =
                  !settingsStore.celestiaAtlas.azimuthalLinesVisible
              "
              :status-value="settingsStore.celestiaAtlas.azimuthalLinesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="equatorialLinesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.equatorial_lines_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.equatorialLinesVisible =
                  !settingsStore.celestiaAtlas.equatorialLinesVisible
              "
              :status-value="settingsStore.celestiaAtlas.equatorialLinesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="meridianLinesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.meridian_lines_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.meridianLinesVisible =
                  !settingsStore.celestiaAtlas.meridianLinesVisible
              "
              :status-value="settingsStore.celestiaAtlas.meridianLinesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="eclipticLinesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.ecliptic_lines_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.eclipticLinesVisible =
                  !settingsStore.celestiaAtlas.eclipticLinesVisible
              "
              :status-value="settingsStore.celestiaAtlas.eclipticLinesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="atmosphereVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.atmosphere_visible') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.atmosphereVisible =
                  !settingsStore.celestiaAtlas.atmosphereVisible
              "
              :status-value="settingsStore.celestiaAtlas.atmosphereVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="landscapesVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.landscapes_visible') }}
          </label>
          <div>
            <toggleButton
              @click="showLandscape"
              :status-value="settingsStore.celestiaAtlas.landscapesVisible"
            />
          </div>
        </div>

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="hideBelowHorizon" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.hide_below_horizon') }}
          </label>
          <div>
            <toggleButton
              @click="
                settingsStore.celestiaAtlas.hideBelowHorizon =
                  settingsStore.celestiaAtlas.hideBelowHorizon === false
              "
              :status-value="settingsStore.celestiaAtlas.hideBelowHorizon !== false"
            />
          </div>
        </div>

        <div
          class="grid min-h-24 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-gray-500 p-3 col-span-full"
        >
          <div class="min-w-0 max-w-full">
            <label for="skySurveyVisible" class="block break-words whitespace-normal text-gray-300">
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

        <div
          v-if="settingsStore.celestiaAtlas.landscapesVisible"
          class="w-full border border-gray-500 p-2 rounded-lg col-span-full"
        >
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
              <p v-if="landscapeListLoading" class="text-gray-400">{{ $t('common.loading') }}</p>
              <p v-else-if="landscapeListError" class="text-red-400">{{ landscapeListError }}</p>
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

        <div
          class="flex flex-row items-center justify-between w-full border border-gray-500 p-2 rounded-lg"
        >
          <label for="dsosVisible" class="text-gray-400">
            {{ $t('components.celestiaAtlas.settings.dsos_visible') }}
          </label>
          <div>
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

        <div class="w-full border border-gray-500 p-3 rounded-lg col-span-full grid gap-3">
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
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { useSettingsStore } from '@/store/settingsStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import { watch, ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import { useOrientation } from '@/composables/useOrientation';
import Modal from '@/components/helpers/Modal.vue';
import apiService from '@/services/apiService';
import AtlasCatalogFilters from '@/components/celestiaAtlas/AtlasCatalogFilters.vue';
import { canonicalizeCelestiaAtlasDataUrl } from '@/store/utils/celestiaAtlasSettingsMigration';

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
      return Boolean(folder) && folder !== 'gray' && folder !== 'guereins';
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
    if (mode === 'default' || mode === 'neutral') {
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
    if (value === 'default' || value === 'neutral' || value === 'custom') {
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

// Check if in landscape mode
const { isLandscape } = useOrientation();

// Settings container classes for grid layout
const settingsContainerClasses = computed(() => ({
  // Portrait mode - single column
  'flex flex-col gap-1': !isLandscape.value,
  // Landscape mode - two columns
  'grid grid-cols-2 gap-2': isLandscape.value,
}));

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
/* Scrollbar styling for landscape mode */
@media screen and (orientation: landscape) {
  .overflow-y-auto::-webkit-scrollbar {
    width: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.3);
    border-radius: 2px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(6, 182, 212, 0.5);
    border-radius: 2px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(6, 182, 212, 0.7);
  }
}

/* Responsive adjustments */
@media screen and (orientation: landscape) and (max-height: 600px) {
  /* For very short landscape screens */
  .max-h-\[80vh\] {
    max-height: 90vh !important;
  }
}
</style>
