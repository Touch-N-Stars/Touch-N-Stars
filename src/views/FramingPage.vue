<template>
  <div class="framing-page relative">
    <div class="framing-stage-wrapper absolute inset-0 flex items-center justify-center">
      <Suspense>
        <template #default>
          <FramingAssitantImg :key="framingStore.framingReloadKey" />
        </template>
        <template #fallback>
          <div class="text-content p-4">{{ $t('common.loading') }}</div>
        </template>
      </Suspense>
    </div>

    <div
      v-if="hasMissingEquipmentSettings"
      class="missing-settings-warning absolute top-2 left-1/2 -translate-x-1/2 max-w-xl w-[min(100%,40rem)] bg-surface-1/95 border border-status-warn/50 text-content text-sm rounded-lg shadow-lg p-3 backdrop-blur-sm flex items-start gap-2"
    >
      <ExclamationTriangleIcon class="w-5 h-5 shrink-0 text-status-warn mt-0.5" />
      <span>{{ $t('components.framing.missingEquipmentSettings') }}</span>
    </div>

    <button
      v-if="!controlsVisible"
      class="controls-toggle absolute bottom-2 left-1/2 -translate-x-1/2 bg-surface-1/80 border border-line rounded-full shadow-lg p-2 backdrop-blur-sm hover:bg-surface-2"
      @click="controlsVisible = true"
    >
      <ChevronUpIcon class="w-5 h-5 text-content" />
    </button>

    <div
      v-show="controlsVisible"
      class="controls-overlay absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col w-[min(100%,22rem)] gap-1.5 bg-surface-1/85 border border-line rounded-lg shadow-lg p-2 backdrop-blur-sm max-h-[calc(100%-1rem)] overflow-y-auto"
      :class="{ 'controls-peek': rulerScrubbing }"
    >
      <!-- Row 1: Icon-Leiste -->
      <div class="flex items-center gap-1.5">
        <button
          class="p-1.5 rounded transition-colors"
          :class="searchVisible ? 'text-accent' : 'text-content-muted hover:text-white'"
          @click="searchVisible = !searchVisible"
        >
          <MagnifyingGlassIcon class="w-6 h-6" />
        </button>
        <button
          class="p-1.5 rounded transition-colors"
          :class="settingsOpen ? 'text-accent' : 'text-content-muted hover:text-white'"
          @click="settingsOpen = !settingsOpen"
        >
          <Cog6ToothIcon class="w-6 h-6" />
        </button>
        <button
          class="p-1.5 text-content-muted hover:text-white ml-auto"
          @click="controlsVisible = false"
        >
          <ChevronDownIcon class="w-4 h-4" />
        </button>
      </div>

      <!-- Suchzeile + Fav + Solve (einblendbar) -->
      <div v-show="searchVisible" class="flex items-center gap-1.5">
        <div class="relative flex-1">
          <input
            v-model="searchQuery"
            type="text"
            class="tns-input w-full text-sm"
            :placeholder="$t('components.framing.search.placeholder')"
            @input="fetchTargetSearch"
          />
          <ul
            v-if="Array.isArray(searchResults) && searchResults.length > 0"
            class="tns-select absolute left-0 right-0 top-full mt-1 max-h-64 overflow-y-auto z-10"
          >
            <li
              v-for="(item, index) in searchResults"
              :key="index"
              class="p-2 text-sm hover:bg-surface-3 cursor-pointer"
              @click="selectTarget(item)"
            >
              {{ item.Name }}
              <span v-if="item['Common names']"> ({{ item['Common names'] }})</span>
              <span v-if="item['M']"> (M {{ item['M'] }})</span>
            </li>
          </ul>
        </div>
        <FavTargets :showFramning="true" :showSeqTarget="false" :showBadgeLabel="true" />
        <FitsPlateSolve
          v-if="
            appStore.isPINS ||
            appStore.checkVersionNewerOrEqual(appStore.currentTnsPluginVersion, '1.2.7.0')
          "
          :showFraming="false"
          :showSeqTarget="false"
          :showBadgeLabel="true"
        />
      </div>

      <!-- Row 2: Slew -->
      <ButtonSlewCenterRotate
        class="w-full"
        :raAngle="framingStore.RAangle"
        :decAngle="framingStore.DECangle"
      />

      <!-- Row 3: Sekundäre Aktionen -->
      <div class="flex items-center gap-1.5">
        <setSequenceTarget v-if="!framingStore.isMosaicMode" class="flex-1" />
        <SaveFavTargets
          :class="{ 'flex-1': framingStore.isMosaicMode }"
          :show-label="framingStore.isMosaicMode"
          :name="framingStore.selectedItem?.Name ?? t('components.framing.customTarget')"
          :ra="framingStore.RAangle"
          :dec="framingStore.DECangle"
          :ra-string="framingStore.RAangleString"
          :dec-string="framingStore.DECangleString"
          :rotation="framingStore.rotationAngle"
          :mosaic-cols="framingStore.isMosaicMode ? framingStore.mosaicCols : null"
          :mosaic-rows="framingStore.isMosaicMode ? framingStore.mosaicRows : null"
          :mosaic-overlap="framingStore.isMosaicMode ? framingStore.mosaicOverlap : null"
          :mosaic-preserve-alignment="
            framingStore.isMosaicMode ? framingStore.mosaicPreserveAlignment : null
          "
        />
      </div>

      <!-- Rotation ruler + Determine Rotation (immer sichtbar) -->
      <RotationRuler @scrub="rulerScrubbing = $event" />
      <getImageRotation />

      <!-- Ausklappbare Einstellungen -->
      <div v-show="settingsOpen" class="pt-1.5 border-t border-line/60">
        <MosaicControls />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ChevronUpIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline';
import { useFramingStore } from '@/store/framingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { raDecToAltAz, degreesToHMS, degreesToDMS } from '@/utils/utils';
import getImageRotation from '@/components/framing/getImageRotation.vue';
import RotationRuler from '@/components/framing/RotationRuler.vue';
import ButtonSlewCenterRotate from '@/components/mount/ButtonSlewCenterRotate.vue';
import setSequenceTarget from '@/components/framing/setSequenceTarget.vue';
import MosaicControls from '@/components/framing/MosaicControls.vue';
import SaveFavTargets from '@/components/favTargets/SaveFavTargets.vue';
import FavTargets from '@/components/favTargets/FavTargets.vue';
import FitsPlateSolve from '@/components/fitsPlatesolve/FitsPlateSolve.vue';

const { t } = useI18n();
const framingStore = useFramingStore();
const settingsStore = useSettingsStore();
const appStore = apiStore();

const FramingAssitantImg = defineAsyncComponent(
  () => import('@/components/framing/FramingAssitantImg.vue')
);

const searchQuery = ref('');
const searchResults = ref([]);
const controlsVisible = ref(true);
// While the rotation ruler is dragged only the ruler stays visible, so the
// camera frame can be watched turning on small screens.
const rulerScrubbing = ref(false);
const settingsOpen = ref(false);
const searchVisible = ref(false);

const hasMissingEquipmentSettings = computed(() => {
  const focalLength = appStore.profileInfo?.TelescopeSettings?.FocalLength;
  const pixelSize = appStore.profileInfo?.CameraSettings?.PixelSize;
  return !focalLength || focalLength <= 0 || !pixelSize || pixelSize <= 0;
});

async function fetchTargetSearch() {
  if (searchQuery.value.trim() === '') {
    searchResults.value = [];
    return;
  }
  try {
    const data = await apiService.searchNGC(searchQuery.value, 50);
    searchResults.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching search suggestions:', error);
    searchResults.value = [];
  }
}

function selectTarget(item) {
  searchQuery.value = item.Name || '';
  searchResults.value = [];

  framingStore.selectedItem = item;
  framingStore.RAangle = item.RA;
  framingStore.DECangle = item.Dec;
  framingStore.RAangleString = degreesToHMS(item.RA);
  framingStore.DECangleString = degreesToDMS(item.Dec);

  const { altitude, azimuth } = raDecToAltAz(
    item.RA,
    item.Dec,
    appStore.profileInfo?.AstrometrySettings?.Latitude ?? 0,
    appStore.profileInfo?.AstrometrySettings?.Longitude ?? 0
  );
  framingStore.ALTangle = altitude;
  framingStore.AZangle = azimuth;
  framingStore.ALTangleString = altitude.toFixed(3);
  framingStore.AZangleString = azimuth.toFixed(3);

  // Bild neu laden mit neuen Koordinaten
  framingStore.framingReloadKey++;
}

watch(
  () => framingStore.fov,
  (newFov) => {
    const normalized = Math.max(1, Math.min(180, Math.round(newFov)));
    if (normalized !== newFov) framingStore.fov = normalized;
  }
);

// Cache-Toggle ändert die Bildquelle (NINA-Cache vs. HiPS) → Bild neu laden.
watch(
  () => settingsStore.framing.useNinaCache,
  () => {
    framingStore.framingReloadKey++;
  }
);
</script>

<style scoped>
.controls-peek {
  visibility: hidden;
}
.controls-peek :deep(.rotation-ruler) {
  visibility: visible;
  border-radius: 0.5rem;
  background: rgb(17 24 39 / 85%);
  box-shadow: 0 0 0 0.5rem rgb(17 24 39 / 85%);
}
.framing-page {
  /* Fullscreen: Page bricht aus dem `container mx-auto` der App aus und
     nutzt den gesamten Viewport zwischen Top-Navbar (Portrait) bzw.
     Side-Navbar (Landscape) und Status-Bar. Das Targetbild kann so die
     volle verfügbare Fläche rechteckig ausfüllen. */
  position: fixed;
  top: 82px;
  left: 0;
  right: 0;
  bottom: var(--above-statusbar);
  z-index: 10;
}

/* Controls-Panel über die Moveable-Handles legen — vue3-moveable rendert
   seine Drag-/Rotate-Griffe mit hohem z-index (bis ~3000). */
.controls-overlay,
.controls-toggle {
  z-index: 9999;
}

@media (orientation: landscape) {
  .framing-page {
    top: 0;
    left: var(--nav-width);
    right: 1rem;
    bottom: 4rem;
  }
}
</style>
