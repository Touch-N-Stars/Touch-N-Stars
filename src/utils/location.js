import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { hasProfileLocation, syncDirectionForSelect } from '@/utils/profileLocation';

// Pure, so code without stores (and its tests) can use it too.
export {
  hasProfileLocation,
  mountSiteDiffers,
  syncDirectionForSelect,
} from '@/utils/profileLocation';

export const latitude = ref(0);
export const longitude = ref(0);
export const altitude = ref(0);
export const gpsError = ref(null);

// Sync direction: NOSYNC | TOAPPLICATION | TOTELESCOPE  (PROMPT is excluded)
export const syncDirection = ref('NOSYNC');

// Read-only snapshots of current stored values
export const ninaCoords = ref({ latitude: null, longitude: null, elevation: null });
export const mountCoords = ref({
  connected: false,
  siteLocationSupported: false,
  latitude: null,
  longitude: null,
  elevation: null,
});
export const mountCoordsLoading = ref(false);

/**
 * Formats a decimal degree value as "DD° MM' SS.S'' N/S/E/W (DD.DDD)"
 * type: 'lat' → N/S, 'lon' → E/W   (default: 'lat')
 * Returns null if the value is null/undefined.
 */
export function formatCoord(decimal, type = 'lat') {
  if (decimal === null || decimal === undefined) return null;
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFull = (abs - deg) * 60;
  const min = Math.floor(minFull);
  const sec = ((minFull - min) * 60).toFixed(1);
  const dir = type === 'lon' ? (decimal < 0 ? 'W' : 'E') : decimal < 0 ? 'S' : 'N';
  return `${deg}° ${min}' ${sec}'' ${dir} (${decimal.toFixed(3)})`;
}

// Numeric values expected by the NINA profileChangeValue API
const SYNC_DIRECTION_VALUES = {
  NOSYNC: 3,
  TOAPPLICATION: 1,
  TOTELESCOPE: 2,
};

export async function getCurrentLocation() {
  try {
    // Check for location permission
    if (Capacitor.getPlatform() !== 'web') {
      const result = await Geolocation.requestPermissions({
        permissions: ['location'],
      });
      if (result.location !== 'granted') {
        gpsError.value = 'Location permission not granted';
        return;
      }
    }
    // Get current position with high accuracy
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
    console.log(pos);
    latitude.value = pos.coords.latitude.toFixed(3);
    longitude.value = pos.coords.longitude.toFixed(3);
    altitude.value = pos.coords.altitude != null ? pos.coords.altitude.toFixed(1) : 0;
    gpsError.value = null;
    return pos;
  } catch (error) {
    gpsError.value = error.message || 'Failed to get GPS location';
  }
}

/** A coordinate field as a number (accepts a decimal comma), or null when it holds none. */
export function parseCoordinate(input) {
  if (typeof input === 'string') {
    const parsed = parseFloat(input.trim().replace(',', '.'));
    return Number.isNaN(parsed) ? null : parsed;
  }
  return Number.isFinite(input) ? input : null;
}

export function useLocationStore() {
  const store = apiStore();

  // Right after a save the store's polled mountInfo still predates the mount
  // reconnect, so read the mount info directly and use the store only as fallback.
  async function fetchMountInfo() {
    try {
      const response = await apiService.mountAction('info');
      if (response?.Success && response.Response) return response.Response;
    } catch (e) {
      console.warn('Could not fetch mount info, using polled state:', e);
    }
    return store.mountInfo;
  }

  function mountCoordsFromMountInfo(mountInfo) {
    const info = mountInfo ?? {};
    const connected = Boolean(info.Connected);
    return {
      connected,
      siteLocationSupported: connected && info.SiteLatitude != null,
      latitude: info.SiteLatitude ?? null,
      longitude: info.SiteLongitude ?? null,
      elevation: info.SiteElevation ?? null,
    };
  }

  return {
    /** Populate edit fields and syncDirection from the current NINA profile */
    async loadFromAstrometrySettings() {
      const settings = store.profileInfo?.AstrometrySettings;
      if (!settings) return;

      latitude.value = settings.Latitude ?? '';
      longitude.value = settings.Longitude ?? '';
      altitude.value = settings.Elevation ?? '';

      ninaCoords.value = {
        latitude: settings.Latitude ?? null,
        longitude: settings.Longitude ?? null,
        elevation: settings.Elevation ?? null,
      };

      const raw = store.profileInfo?.TelescopeSettings?.TelescopeLocationSyncDirection;
      syncDirection.value = syncDirectionForSelect(
        raw,
        store.isPINS,
        hasProfileLocation(store.profileInfo)
      );
    },

    /**
     * Fetch the live mount coordinates. The TNS plugin serves /api/location only on
     * PINS; on NINA (and as fallback) they come from the polled Advanced API mount info.
     */
    async loadMountCoords() {
      mountCoordsLoading.value = true;
      try {
        if (store.isPINS) {
          try {
            const response = await apiService.getTnsLocation();
            if (response?.mount) {
              mountCoords.value = response.mount;
              return;
            }
          } catch (e) {
            console.warn('Could not fetch mount location, using mount info:', e);
          }
        }
        mountCoords.value = mountCoordsFromMountInfo(await fetchMountInfo());
      } finally {
        mountCoordsLoading.value = false;
      }
    },

    /**
     * Save coordinates and sync direction to the NINA profile.
     * Always writes to the profile. When TOTELESCOPE is selected and the
     * mount is connected it also triggers a disconnect/reconnect so that
     * NINA pushes the new values to the mount on the next connect.
     */
    async saveCoordinates() {
      try {
        // When TOAPPLICATION: copy the live mount coordinates into the profile
        if (
          syncDirection.value === 'TOAPPLICATION' &&
          mountCoords.value.connected &&
          mountCoords.value.siteLocationSupported
        ) {
          latitude.value = mountCoords.value.latitude;
          longitude.value = mountCoords.value.longitude;
          altitude.value = mountCoords.value.elevation;
        }

        latitude.value = parseCoordinate(latitude.value);
        longitude.value = parseCoordinate(longitude.value);
        altitude.value = parseCoordinate(altitude.value);

        if (store.isBackendReachable) {
          // Always save coordinates to the profile
          await apiService.profileChangeValue('AstrometrySettings-Latitude', latitude.value);
          await apiService.profileChangeValue('AstrometrySettings-Longitude', longitude.value);
          await apiService.profileChangeValue('AstrometrySettings-Elevation', altitude.value);

          // Always save sync direction
          const dirValue =
            SYNC_DIRECTION_VALUES[syncDirection.value] ?? SYNC_DIRECTION_VALUES.NOSYNC;
          await apiService.profileChangeValue(
            'TelescopeSettings-TelescopeLocationSyncDirection',
            dirValue
          );

          // If TOTELESCOPE and mount connected: reconnect so NINA pushes coords to mount
          if (syncDirection.value === 'TOTELESCOPE' && store.mountInfo.Connected) {
            const guiderStore = useGuiderStore();
            const isPhd2 = store.guiderInfo?.DeviceId === 'PHD2_Single';
            const isPhd2EquipmentConnected = isPhd2 && guiderStore.phd2IsConnected;

            let phd2ProfileName = null;
            if (isPhd2EquipmentConnected) {
              try {
                const profileResponse = await apiService.getPhd2CurrentProfile();
                phd2ProfileName = profileResponse?.Response?.Profile?.name ?? null;
                if (phd2ProfileName) {
                  await apiService.disconnectPHD2Equipment();
                }
              } catch (e) {
                console.warn('Could not disconnect PHD2 equipment before mount reconnect:', e);
                phd2ProfileName = null;
              }
            }

            await apiService.mountAction('disconnect');
            await apiService.mountAction('connect');

            if (phd2ProfileName) {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              try {
                await apiService.connectPHD2Equipment(phd2ProfileName);
              } catch (e) {
                console.warn('Could not reconnect PHD2 equipment after mount reconnect:', e);
              }
            }
          }

          // Refresh the in-memory profile so UI reflects the saved values
          await store.fetchProfilInfos();
          console.log('Coordinates and sync direction saved');
        }
      } catch (error) {
        console.error('Failed to update backend coordinates:', error);
        throw error;
      }
    },
  };
}
