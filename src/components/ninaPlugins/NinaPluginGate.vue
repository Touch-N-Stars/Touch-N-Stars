<template>
  <div v-if="state === 'checking'" class="flex flex-col items-center justify-center h-64">
    <span
      class="h-10 w-10 rounded-full border-4 border-line-strong border-t-transparent animate-spin"
      aria-hidden="true"
    ></span>
    <p class="text-content-faint mt-2">{{ $t('common.loading') }}</p>
  </div>

  <div v-else-if="state === 'missing'" class="max-w-xl mx-auto p-4">
    <div class="tns-card flex flex-col gap-4 p-6 text-center">
      <h2 class="text-xl font-bold text-white">{{ $t('components.ninaPluginGate.title') }}</h2>

      <template v-if="canInstall">
        <p class="text-content">
          {{
            pendingRestart
              ? $t('components.ninaPluginGate.pendingRestart', { name: requirement.displayName })
              : $t('components.ninaPluginGate.missing', { name: requirement.displayName })
          }}
        </p>
        <button class="tns-btn-primary" @click="openInstall">
          {{
            pendingRestart
              ? $t('components.ninaPluginInstall.restart')
              : $t('components.ninaPluginGate.install')
          }}
        </button>
      </template>

      <template v-else>
        <p class="text-content">
          {{ $t('components.ninaPluginGate.missing', { name: requirement.displayName }) }}
        </p>
        <p class="text-content-muted text-sm">
          {{ $t('components.ninaPluginGate.windowsHint', { name: requirement.displayName }) }}
        </p>
      </template>
    </div>
  </div>

  <slot v-else />
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiPinsService from '@/services/apiPinsService';
import { fetchLoadedNinaPlugins, useNinaPluginInstallStore } from '@/store/ninaPluginInstallStore';
import { isNinaPluginLoaded } from '@/utils/ninaPluginRequirement';

/**
 * Shows the plugin page only once NINA has loaded the NINA plugin it needs; otherwise a
 * "NINA plugin missing" state - with install/restart on PINS, a hint elsewhere.
 * If NINA cannot be asked, the page is shown and handles its own errors.
 */
const props = defineProps({
  // { name, pinsPackage } from the plugin's plugin.json (see utils/ninaPluginRequirement)
  requirement: { type: Object, required: true },
  pluginName: { type: String, required: true },
});

const store = apiStore();
const installStore = useNinaPluginInstallStore();

const state = ref('checking');
const pendingRestart = ref(false);

const canInstall = computed(() => store.isPINS && Boolean(props.requirement.pinsPackage));

async function check() {
  const loaded = await fetchLoadedNinaPlugins();
  if (loaded === null || isNinaPluginLoaded(loaded, props.requirement)) {
    state.value = 'available';
    return;
  }

  pendingRestart.value = false;
  if (canInstall.value) {
    try {
      const payload = await apiPinsService.getPinsPlugins();
      pendingRestart.value = Boolean(
        (payload?.plugins || []).find((p) => p?.packageName === props.requirement.pinsPackage)
          ?.installed
      );
    } catch {
      // Unknown package state: offer the install.
    }
  }
  state.value = 'missing';
}

function openInstall() {
  installStore.offer({ pluginName: props.pluginName, requirement: props.requirement });
}

onMounted(check);

// Re-check once the install dialog reports the plugin as loaded, and after a reconnect.
watch(() => installStore.completedCount, check);
watch(
  () => store.isBackendReachable,
  (reachable) => {
    if (reachable && state.value === 'missing') check();
  }
);
</script>
