import { isAppBackgrounded } from '@/utils/appLifecycle';

const SAVE_DEBOUNCE_MS = 800;
const REFRESH_INTERVAL_MS = 5000;

let stopSubscription = null;
let saveTimer = null;
let refreshTimer = null;

export function serializeRigSharedSettings(settingsStore) {
  return JSON.stringify({
    schemaVersion: 1,
    monitorViewSetting: settingsStore.monitorViewSetting,
    livestack: settingsStore.livestack,
    celestiaAtlas: settingsStore.celestiaAtlas,
  });
}

export function initializeRigSharedSettingsSync(settingsStore) {
  stopSubscription?.();
  if (saveTimer) clearTimeout(saveTimer);
  if (refreshTimer) clearInterval(refreshTimer);

  stopSubscription = settingsStore.$subscribe(() => {
    if (!settingsStore._sharedRigSettingsReady) return;

    const nextSnapshot = serializeRigSharedSettings(settingsStore);
    if (nextSnapshot === settingsStore._sharedRigSettingsSnapshot) return;

    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (serializeRigSharedSettings(settingsStore) === settingsStore._sharedRigSettingsSnapshot) {
        return;
      }
      void settingsStore.saveSharedRigUiSettings().catch((error) => {
        console.warn('[RigSharedSettings] save failed:', error?.message || error);
      });
    }, SAVE_DEBOUNCE_MS);
  });

  refreshTimer = setInterval(() => {
    if (isAppBackgrounded.value || !settingsStore._sharedRigSettingsReady || saveTimer) return;
    void settingsStore.loadSharedRigUiSettings().catch((error) => {
      console.warn('[RigSharedSettings] refresh failed:', error?.message || error);
    });
  }, REFRESH_INTERVAL_MS);

  return () => {
    stopSubscription?.();
    stopSubscription = null;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  };
}
