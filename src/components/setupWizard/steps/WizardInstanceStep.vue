<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.instance.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.instance.description') }}
      </p>
    </div>

    <!-- The first thing ASIAIR users do: join the rig's Wi-Fi. Name and password are the
         PINS defaults (hotspot = rig name, password set by the pinsdaemon). -->
    <div class="flex flex-col gap-1 rounded-control bg-surface-2 p-3">
      <p class="text-sm text-content">{{ t('components.setupWizard.instance.hotspotHint') }}</p>
      <p class="text-xs text-content-muted">
        {{ t('components.setupWizard.instance.homeNetworkHint') }}
      </p>
    </div>

    <InstanceDetection v-model="instanceData" auto-detect beginner />

    <div
      v-if="isConnected"
      class="flex items-start gap-3 rounded-control border border-status-ok/40 bg-status-ok/10 p-3"
    >
      <span class="tns-dot bg-status-ok mt-1.5"></span>
      <p class="text-sm text-content">
        {{ t('components.setupWizard.instance.connected', { name: connectedName }) }}
      </p>
    </div>

    <button class="tns-btn-primary" :disabled="isSaving" @click="saveInstance">
      {{
        isSaving
          ? t('components.setupWizard.instance.connecting')
          : t('components.setupWizard.instance.connect')
      }}
    </button>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import InstanceDetection from '@/components/setup/InstanceDetection.vue';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { useLocationStore } from '@/utils/location';
import { wait } from '@/utils/utils';

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();
const locationStore = useLocationStore();

function initialInstanceData() {
  const selected = settingsStore.selectedInstanceId
    ? settingsStore.getInstance(settingsStore.selectedInstanceId)
    : null;

  if (selected?.ip && selected?.port) {
    return { name: selected.name || '', ip: selected.ip, port: selected.port };
  }
  return {
    name: '',
    ip: settingsStore.connection.ip || '',
    port: settingsStore.connection.port || 5000,
  };
}

const instanceData = ref(initialInstanceData());
const isSaving = ref(false);
const isConnected = ref(false);
const connectedName = ref('');
const errorMessage = ref('');

// The name is only a label in the instance list; a beginner should not have to invent one.
function instanceName() {
  const data = instanceData.value;
  return data.name?.trim() || data.rigId || String(data.ip ?? '').trim();
}

function validate() {
  if (!instanceData.value.ip) {
    return t('components.settings.errors.invalidIPFormat');
  }
  const port = Number.parseInt(instanceData.value.port, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    return t('components.settings.errors.invalidPortRange');
  }
  return '';
}

async function saveInstance() {
  if (isSaving.value) return;

  const validationError = validate();
  if (validationError) {
    errorMessage.value = validationError;
    return;
  }

  isSaving.value = true;
  errorMessage.value = '';
  isConnected.value = false;

  try {
    settingsStore.addInstance(
      {
        name: instanceName(),
        ip: instanceData.value.ip,
        port: instanceData.value.port,
        // Both come from the mDNS discovery in InstanceDetection and are what
        // lets the app find the rig again after it changes address.
        rigId: instanceData.value.rigId,
        candidateHosts: instanceData.value.candidateHosts,
      },
      // The wizard keeps its progress in component state, so an endpoint change
      // must not reload the page. settingsStore guards this too, but stating it
      // here keeps the exception greppable.
      { allowReload: false }
    );

    await wait(500);
    let reachable = await apiService.fetchTnsPluginVersion();
    if (!reachable) {
      await wait(1000);
      reachable = await apiService.fetchTnsPluginVersion();
    }
    if (!reachable) {
      errorMessage.value = t('components.settings.errors.invalidInstance');
      return;
    }

    store.startFetchingInfo();
    // ToastModal in App.vue stays silent until this flips, so backend errors
    // during the remaining steps would otherwise go unseen.
    store.setupCheckConnectionDone = true;
    await wait(2500);

    isConnected.value = true;
    connectedName.value = instanceName();

    await locationStore.loadFromAstrometrySettings();
    locationStore.loadMountCoords(); // fire-and-forget, mountCoordsLoading tracks it
  } catch (error) {
    console.error('[SetupWizard] Instance setup failed:', error);
    errorMessage.value = t('components.setupWizard.instance.connectFailed', {
      message: error.message,
    });
  } finally {
    isSaving.value = false;
  }
}
</script>
