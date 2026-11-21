<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.location.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.location.description') }}
      </p>
    </div>

    <!-- Current values: profile vs. mount -->
    <div v-if="showCoordCards" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div class="rounded-control bg-surface-2 p-3">
        <div class="flex items-center justify-between mb-2 gap-2">
          <p class="text-xs font-medium text-content-muted">
            {{ t('components.setupWizard.location.profileCoords') }}
          </p>
          <button
            class="text-content-faint hover:text-accent transition-colors"
            :title="t('common.refresh')"
            @click="locationStore.loadFromAstrometrySettings()"
          >
            <ArrowPathIcon class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs text-content">
          {{ t('setup.coordLat') }}: {{ formatCoord(ninaCoords.latitude, 'lat') ?? '—' }}
        </p>
        <p class="text-xs text-content">
          {{ t('setup.coordLon') }}: {{ formatCoord(ninaCoords.longitude, 'lon') ?? '—' }}
        </p>
        <p class="text-xs text-content">
          {{ t('setup.coordAlt') }}: {{ ninaCoords.elevation ?? '—' }} {{ t('setup.coordUnit') }}
        </p>
      </div>

      <div class="rounded-control bg-surface-2 p-3">
        <div class="flex items-center justify-between mb-2 gap-2">
          <p class="text-xs font-medium text-content-muted">
            {{ t('components.setupWizard.location.mountCoords') }}
          </p>
          <button
            class="text-content-faint hover:text-accent transition-colors"
            :class="{ 'animate-spin': mountCoordsLoading }"
            :title="t('common.refresh')"
            @click="locationStore.loadMountCoords()"
          >
            <ArrowPathIcon class="w-4 h-4" />
          </button>
        </div>
        <p v-if="mountCoordsLoading" class="text-xs text-content-faint">
          {{ t('setup.loadingCoords') }}
        </p>
        <p v-else-if="!mountCoords.connected" class="text-xs text-content-faint">
          {{ t('setup.mountNotConnected') }}
        </p>
        <p v-else-if="!mountCoords.siteLocationSupported" class="text-xs text-status-warn">
          {{ t('setup.coordsNotSupported') }}
        </p>
        <template v-else>
          <p class="text-xs text-content">
            {{ t('setup.coordLat') }}: {{ formatCoord(mountCoords.latitude, 'lat') ?? '—' }}
          </p>
          <p class="text-xs text-content">
            {{ t('setup.coordLon') }}: {{ formatCoord(mountCoords.longitude, 'lon') ?? '—' }}
          </p>
          <p class="text-xs text-content">
            {{ t('setup.coordAlt') }}: {{ mountCoords.elevation }} {{ t('setup.coordUnit') }}
          </p>
        </template>
      </div>
    </div>

    <p v-if="coordsMismatch" class="text-xs text-status-warn">
      {{ t('components.settings.coordsMismatchWarning') }}
    </p>

    <!-- Editable coordinates. Text inputs on purpose: getCurrentLocation() writes
         strings (toFixed), and saveCoordinates() sanitizes them (incl. decimal comma). -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.location.latitude') }}
        </span>
        <input v-model="latitude" type="text" inputmode="decimal" class="tns-input" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.location.longitude') }}
        </span>
        <input v-model="longitude" type="text" inputmode="decimal" class="tns-input" />
      </label>
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.location.altitude') }} ({{ t('setup.coordUnit') }})
        </span>
        <input v-model="altitude" type="text" inputmode="decimal" class="tns-input" />
      </label>
    </div>

    <button class="tns-btn-secondary" :disabled="isSaving" @click="useCurrentLocation">
      <MapPinIcon class="w-5 h-5" />
      {{ t('components.setupWizard.location.useCurrentLocation') }}
    </button>
    <p v-if="gpsError" class="text-sm text-status-danger break-words">{{ gpsError }}</p>

    <!-- Sync direction -->
    <template v-if="store.isPINS">
      <label class="flex flex-col gap-1">
        <span class="text-xs font-semibold uppercase text-content-muted">
          {{ t('components.setupWizard.location.syncDirection') }}
        </span>
        <select v-model="syncDirection" class="tns-select" :disabled="isSaving">
          <option value="NOSYNC">{{ t('setup.syncDirectionNosync') }}</option>
          <option value="TOAPPLICATION">{{ t('setup.syncDirectionToApplication') }}</option>
          <option value="TOTELESCOPE">{{ t('setup.syncDirectionToTelescope') }}</option>
        </select>
      </label>
    </template>
    <template v-else>
      <div
        v-if="
          store?.profileInfo?.TelescopeSettings?.TelescopeLocationSyncDirection !== 'TOTELESCOPE'
        "
      >
        <p class="text-sm text-status-warn">{{ t('components.settings.infoSetLocationSync') }}</p>
        <ButtonSetLocationSyncToMount class="mt-1" />
      </div>
    </template>

    <button class="tns-btn-primary" :disabled="isSaving" @click="save">
      {{
        isSaving
          ? t('components.setupWizard.location.saving')
          : t('components.setupWizard.location.save')
      }}
    </button>

    <!-- Whether the profile holds what the fields show. Leaving the step saves pending
         changes, so "Next" alone is enough - the hint says so. -->
    <p v-if="isDirty" class="text-xs text-content-faint">
      {{ t('components.setupWizard.location.unsavedHint') }}
    </p>
    <p v-else-if="hasLocation" class="flex items-center gap-2 text-xs text-status-ok">
      <span class="tns-dot bg-status-ok"></span>
      {{ t('components.setupWizard.location.savedHint') }}
    </p>
    <p v-else class="text-xs text-status-warn">
      {{ t('components.setupWizard.location.missingHint') }}
    </p>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowPathIcon, MapPinIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import ButtonSetLocationSyncToMount from '@/components/mount/ButtonSetLocationSyncToMount.vue';
import {
  latitude,
  longitude,
  altitude,
  gpsError,
  getCurrentLocation,
  useLocationStore,
  syncDirection,
  ninaCoords,
  mountCoords,
  mountCoordsLoading,
  formatCoord,
  hasProfileLocation,
  parseCoordinate,
} from '@/utils/location';

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();
const locationStore = useLocationStore();

// ~100 m, same threshold LocationSettingsPins.vue uses.
const COORD_TOLERANCE = 0.001;

const isSaving = ref(false);
const errorMessage = ref('');

// The mount-coordinate endpoint only exists on PINS / TNS plugin >= 1.2.8.0.
const showCoordCards = computed(
  () => store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.8.0')
);

const coordsMismatch = computed(() => {
  if (!mountCoords.value.connected || !mountCoords.value.siteLocationSupported) return false;
  const pairs = [
    [ninaCoords.value.latitude, mountCoords.value.latitude],
    [ninaCoords.value.longitude, mountCoords.value.longitude],
  ];
  return pairs.some(
    ([a, b]) => a !== null && b !== null && Math.abs(Number(a) - Number(b)) > COORD_TOLERANCE
  );
});

// The profile is the source of truth; the fields are only an edit buffer.
const hasLocation = computed(() => hasProfileLocation(store.profileInfo));

// Fields that differ from the profile, so leaving the step has something to save.
const isDirty = computed(() => {
  const pairs = [
    [latitude.value, ninaCoords.value.latitude],
    [longitude.value, ninaCoords.value.longitude],
    [altitude.value, ninaCoords.value.elevation],
  ];
  const fieldsDiffer = pairs.some(([field, saved]) => {
    const value = parseCoordinate(field);
    if (value === null) return false;
    return saved === null || Math.abs(value - Number(saved)) > COORD_TOLERANCE / 10;
  });
  const raw = store.profileInfo?.TelescopeSettings?.TelescopeLocationSyncDirection;
  const savedDirection = raw && raw !== 'PROMPT' ? raw : 'NOSYNC';
  return fieldsDiffer || (store.isPINS && syncDirection.value !== savedDirection);
});

// A user who just took the device's location expects it to be used - without a second tap
// on "Save location" it was silently lost before.
async function useCurrentLocation() {
  const position = await getCurrentLocation();
  if (position) await save();
}

async function save() {
  if (isSaving.value) return;
  isSaving.value = true;
  errorMessage.value = '';
  try {
    // With TOTELESCOPE this disconnects and reconnects the mount (and PHD2),
    // which takes several seconds - hence the disabled buttons above.
    await locationStore.saveCoordinates();
    await locationStore.loadFromAstrometrySettings();
    locationStore.loadMountCoords();
  } catch (error) {
    console.error('[PinsWizard] Saving coordinates failed:', error);
    errorMessage.value = t('components.setupWizard.location.saveFailed', {
      message: error.message,
    });
  } finally {
    isSaving.value = false;
  }
}

// "Next" without "Save location" used to drop the coordinates and leave the profile at 0/0,
// which only surfaced much later as a failing polar alignment. The step unmounts on
// Next/Back, so pending changes are written here; a failure still reaches the user.
onBeforeUnmount(() => {
  if (isSaving.value || !isDirty.value) return;
  locationStore.saveCoordinates().catch((error) => {
    console.error('[PinsWizard] Saving coordinates on leave failed:', error);
    toastStore.showToast({
      type: 'error',
      title: t('components.setupWizard.location.title'),
      message: t('components.setupWizard.location.saveFailed', { message: error.message }),
    });
  });
});

onMounted(async () => {
  // The refs in utils/location.js are module singletons shared with
  // the settings panel, so never trust whatever is left in them.
  await store.fetchProfilInfos();
  await locationStore.loadFromAstrometrySettings();
  if (showCoordCards.value) {
    locationStore.loadMountCoords();
  }
});
</script>
