import { createApp } from 'vue';
import App from '@/App.vue';
import router from '@/router';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import './assets/tailwind.css';
import { createHead } from '@unhead/vue/client';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { EdgeToEdge } from '@capawesome/capacitor-android-edge-to-edge-support';
import i18n, { initializeI18n } from '@/i18n';
import { usePluginStore } from '@/store/pluginStore';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { timeSync } from '@/utils/timeSync';
import { setupErrorHandler, setupUnhandledRejectionLogging } from '@/utils/errorHandler';
import { ensureConsolePatched } from '@/utils/consoleCapture';
import { markAppReady } from '@/services/updateService';
import { initWifiBinding } from '@/services/wifiBindingService';
import { initSessionNotifications } from '@/services/sessionNotificationService';
import { installGlobalHaptics } from '@/services/globalHaptics';
import { useHaptics } from '@/composables/useHaptics';
import {
  initializeRigConnectionSupervisor,
  recoverRigConnection,
} from '@/services/rigConnectionSupervisor';
import { initializeRigSharedSettingsSync } from '@/services/rigSharedSettingsService';

const SYSTEM_BAR_COLOR = '#1F2937';

// Tooltip directive
const tooltipDirective = {
  mounted(el, binding, vnode) {
    // Check if this is a component instance (not a DOM element)
    if (vnode.component) {
      // Find the actual root element of the component
      const rootEl = vnode.component.subTree?.el;
      if (rootEl && typeof rootEl.setAttribute === 'function') {
        rootEl.setAttribute('title', binding.value);
        rootEl.style.cursor = 'pointer';
        return;
      }
    }

    // Handle regular DOM elements
    if (!el || typeof el.setAttribute !== 'function') {
      return; // Silently ignore invalid elements
    }
    el.setAttribute('title', binding.value);
    el.style.cursor = 'pointer';
  },
  updated(el, binding, vnode) {
    // Check if this is a component instance
    if (vnode.component) {
      const rootEl = vnode.component.subTree?.el;
      if (rootEl && typeof rootEl.setAttribute === 'function') {
        rootEl.setAttribute('title', binding.value);
        return;
      }
    }

    // Handle regular DOM elements
    if (!el || typeof el.setAttribute !== 'function') {
      return;
    }
    el.setAttribute('title', binding.value);
  },
};

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
const head = createHead();

// Setup global error handling
setupErrorHandler();
setupUnhandledRejectionLogging();

const app = createApp(App);
app.directive('tooltip', tooltipDirective);

// Start capturing console logs as early as possible
try {
  ensureConsolePatched();
} catch (e) {
  /* noop */
}

async function applyAndroidSystemBarColors() {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await EdgeToEdge.setStatusBarColor({ color: SYSTEM_BAR_COLOR });
    await EdgeToEdge.setNavigationBarColor({ color: SYSTEM_BAR_COLOR });
  } catch (error) {
    console.warn('EdgeToEdge color sync failed:', error);
  }
}

app.use(pinia).use(head).use(i18n).use(router);

// App-wide haptic feedback for every button, toggle and navigation entry.
// Registered on the document so lazily loaded plugin views are covered too.
installGlobalHaptics(document, useHaptics());

// Initialize plugin system
(async () => {
  const settingsStore = useSettingsStore(pinia);
  await initializeI18n(settingsStore);

  const pluginStore = usePluginStore(pinia);

  // Store references to app and router in plugin store
  pluginStore.initializeAppAndRouter(app, router);

  // Load and register all available plugins
  // Always refresh bundled metadata after an upgrade. The loader preserves each
  // plugin's enabled state while replacing stale names, descriptions and paths.
  await pluginStore.loadAndRegisterPlugins(true);

  // Initialize all enabled plugins
  await pluginStore.initializeEnabledPlugins();

  // Mount the app after plugins are initialized
  app.mount('#app');

  // Some Android builds/OEM skins can ignore static config and apply dynamic theme colors.
  // Re-applying at runtime keeps system bars aligned with the app theme.
  await applyAndroidSystemBarColors();

  // Keep the backend reachable on internet-less Wi-Fi (PINS hotspot) on Android
  initWifiBinding();
  // Rig notifications while the app is in the background (#1492)
  initSessionNotifications();
  initializeRigSharedSettingsSync(settingsStore);
  void initializeRigConnectionSupervisor({
    settingsStore,
    backendStore: apiStore(pinia),
  }).catch((error) => {
    console.warn('[RigConnectionSupervisor] initialization failed:', error?.message || error);
  });

  CapacitorApp.addListener('appStateChange', async ({ isActive }) => {
    if (isActive) {
      await applyAndroidSystemBarColors();
      void recoverRigConnection({ timeoutMs: 12000, includeFieldFallback: true }).catch(() => {});
    }
  });

  await markAppReady();

  // Initialize time synchronization after app is mounted and stores are ready
  setTimeout(async () => {
    try {
      await timeSync.initialize();
    } catch (error) {
      console.warn('Time sync initialization failed, will retry later:', error);
    }
  }, 1000);
})();
