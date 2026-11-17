<template>
  <section class="tns-card space-y-4">
    <div class="flex items-center justify-between gap-3">
      <h3 class="tns-section-title min-w-0">{{ $t('plugins.pins.savedWifi.title') }}</h3>
      <button class="tns-btn-secondary w-auto! shrink-0" :disabled="busy || disabled" @click="load">
        {{ $t('common.refresh') }}
      </button>
    </div>
    <p class="text-sm text-content-muted">{{ $t('plugins.pins.savedWifi.description') }}</p>
    <p class="text-xs text-content-muted">{{ $t('plugins.pins.savedWifi.retryHint') }}</p>
    <button class="tns-btn-secondary" :disabled="busy || disabled" @click="$emit('retry')">
      {{ $t('plugins.pins.savedWifi.retry') }}
    </button>
    <p v-if="loading" class="flex items-center gap-2 text-content-muted">
      <Spinner size="sm" />
      {{ $t('common.loading') }}
    </p>
    <p v-if="error" role="alert" class="text-status-danger">{{ error }}</p>
    <p v-if="!loading && !error && !networks.length" class="text-content-muted">
      {{ $t('plugins.pins.savedWifi.empty') }}
    </p>
    <div
      v-for="network in networks"
      :key="network.uuid"
      class="border-t border-line pt-4 space-y-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <strong class="text-content break-all">{{ network.ssid }}</strong>
        <span v-if="network.connected" class="text-status-ok text-sm">
          {{ $t('plugins.pins.wifiConnectedAction') }}
        </span>
        <span v-if="!network.compatible" class="text-status-warn text-sm">
          {{ $t('plugins.pins.savedWifi.otherAdapter', { interface: network.interface }) }}
        </span>
      </div>
      <p v-if="network.name !== network.ssid" class="text-xs text-content-muted break-all">
        {{ network.name }}
      </p>
      <label class="flex items-center gap-2 min-h-touch text-sm text-content">
        <input
          v-model="network.editedAutoConnect"
          type="checkbox"
          class="h-5 w-5 accent-accent-action"
          :disabled="busy || disabled"
        />
        {{ $t('plugins.pins.autoConnect') }}
      </label>
      <!-- The picker has no disabled prop, so the fieldset locks it during an operation. -->
      <fieldset :disabled="busy || disabled" class="min-w-0">
        <NumberInputPicker
          v-model="network.editedPriority"
          :label="$t('plugins.pins.savedWifi.priority')"
          labelKey="plugins.pins.savedWifi.priority"
          :min="-999"
          :max="999"
          :step="1"
          :decimalPlaces="0"
          :useDefaultSentinel="false"
          :inputId="`pinsPriority-${network.uuid}`"
        />
      </fieldset>
      <div class="flex flex-wrap gap-2">
        <button class="tns-btn-secondary" :disabled="busy || disabled" @click="save(network)">
          {{ $t('general.save') }}
        </button>
        <button
          class="tns-btn-secondary"
          :disabled="busy || disabled || network.connected || !network.compatible"
          @click="$emit('connect', network)"
        >
          {{ $t('plugins.pins.wifiConnect') }}
        </button>
        <button
          class="tns-btn-danger"
          :disabled="busy || disabled || network.connected"
          @click="confirmForget = network.uuid"
        >
          {{ $t('plugins.pins.savedWifi.forget') }}
        </button>
      </div>
      <div v-if="confirmForget === network.uuid" class="space-y-2 text-sm text-content">
        <p>{{ $t('plugins.pins.savedWifi.forgetConfirm', { ssid: network.ssid }) }}</p>
        <button
          class="tns-btn-secondary mr-2"
          :disabled="busy || disabled"
          @click="forget(network)"
        >
          {{ $t('common.confirm') }}
        </button>
        <button class="tns-btn-secondary" :disabled="busy" @click="confirmForget = ''">
          {{ $t('common.cancel') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import apiPinsService from '@/services/apiPinsService';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import Spinner from '@/components/helpers/Spinner.vue';
import { savedNetworkSettings, waitForSavedNetworkJob } from './composables/savedWifiNetworks';

const props = defineProps({ disabled: Boolean, wifiStatus: { type: Object, default: null } });
const emit = defineEmits(['connect', 'retry', 'busy']);
const { t } = useI18n();
const networks = ref([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const confirmForget = ref('');
let disposed = false;

async function load() {
  if (disposed || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    const response = await apiPinsService.getPinsSavedWifiNetworks();
    if (!disposed) {
      networks.value = (response.networks || []).map((network) => ({
        ...network,
        editedPriority: network.priority,
        editedAutoConnect: network.auto_connect,
      }));
    }
  } catch (err) {
    if (!disposed) {
      error.value = t('plugins.pins.savedWifi.loadFailed');
    }
  } finally {
    loading.value = false;
  }
}

async function run(operation) {
  if (busy.value || props.disabled) return;
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    const job = await operation();
    await waitForSavedNetworkJob(job, (id) => apiPinsService.getPinsDaemonJob(id), {
      cancelled: () => disposed,
    });
    confirmForget.value = '';
    await load();
  } catch (err) {
    if (!disposed) error.value = t('plugins.pins.savedWifi.operationFailed');
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}

function save(network) {
  let settings;
  try {
    settings = savedNetworkSettings(network);
  } catch {
    error.value = t('plugins.pins.savedWifi.invalidPriority');
    return;
  }
  return run(() => apiPinsService.updatePinsSavedWifiNetwork(network.uuid, settings));
}

function forget(network) {
  return run(() => apiPinsService.forgetPinsSavedWifiNetwork(network.uuid));
}

watch(
  () => `${props.wifiStatus?.ssid || ''}:${props.wifiStatus?.observedMode || ''}`,
  () => {
    if (!busy.value) load();
  }
);
watch(
  () => props.disabled,
  (disabled) => {
    if (!disabled && !busy.value) load();
  }
);
onMounted(load);
onUnmounted(() => {
  disposed = true;
});
</script>
