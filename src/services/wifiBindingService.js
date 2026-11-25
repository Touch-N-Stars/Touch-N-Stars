import { watch } from 'vue';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { useSettingsStore } from '@/store/settingsStore';
import { WifiNetworkBinder } from '@/utils/wifiNetworkBinder';

let initialized = false;

async function applyBinding(settingsStore) {
  try {
    const ip = settingsStore.connection.ip;
    if (settingsStore.wifiBindingEnabled && ip) {
      const status = await WifiNetworkBinder.setTargetIp({ ip });
      console.log('[WifiBinding] target updated:', JSON.stringify(status));
    } else {
      await WifiNetworkBinder.disable();
      console.log('[WifiBinding] disabled');
    }
  } catch (error) {
    console.warn('[WifiBinding] failed to apply binding:', error);
  }
}

/** Resolves once the Wi-Fi is bound, or gives up: a first request needs a moment to see it. */
async function waitForBinding(firstStatus) {
  let status = firstStatus;
  for (let i = 0; i < 3 && !status?.bound; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    status = await WifiNetworkBinder.getStatus();
  }
}

/**
 * Runs `task` with the app bound to the Wi-Fi if the phone is in the network of `host`, then
 * goes back to the binding of the active instance. The native plugin only binds when the Wi-Fi's
 * own subnet contains the host, so nothing changes for a phone in another network. On iOS, in the
 * browser and with the binding switched off by the user it only runs the task.
 */
export async function withWifiBindingTo(host, task) {
  if (Capacitor.getPlatform() !== 'android') return task();
  const settingsStore = useSettingsStore();
  if (!settingsStore.wifiBindingEnabled || settingsStore.connection.ip === host) return task();
  try {
    await waitForBinding(await WifiNetworkBinder.setTargetIp({ ip: host }));
  } catch (error) {
    console.warn('[WifiBinding] failed to bind for the search:', error);
  }
  try {
    return await task();
  } finally {
    await applyBinding(settingsStore);
  }
}

/**
 * Android only: keeps the app process bound to the Wi-Fi network whenever the
 * active instance IP is inside its subnet, so the backend (e.g. PINS hotspot
 * without internet) stays reachable while mobile data is the default network.
 */
export function initWifiBinding() {
  if (initialized || Capacitor.getPlatform() !== 'android') return;
  initialized = true;

  const settingsStore = useSettingsStore();

  watch(
    () => [settingsStore.wifiBindingEnabled, settingsStore.connection.ip],
    () => applyBinding(settingsStore),
    { immediate: true }
  );

  // Android may drop the process binding while the app is paused; re-apply on resume
  CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) {
      applyBinding(settingsStore);
    }
  });
}
