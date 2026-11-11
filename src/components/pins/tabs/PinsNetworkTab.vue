<template>
  <div class="flex flex-col space-y-6">
    <PinsWifiCard
      :stationary-mode="stationaryMode"
      :allow-concurrent-mode="allowConcurrentWifiAndHotspot"
      :is-scanning="isScanning"
      :wifi-list="wifiList"
      :wifi-status="wifiStatus"
      :wifi-mode="wifiMode"
      :connection-state="connectionState"
      :mobile-wifi-signal="mobileWifiSignal"
      :selected-ssid="selectedSsid"
      :wifi-password="wifiPassword"
      :selected-band="selectedBand"
      :auto-connect="autoConnect"
      :wifi-adapters="wifiAdapters"
      :interfaces-loading="isWifiAdaptersLoading"
      :interfaces-saving="isWifiInterfacesSaving"
      :selected-client-interface="selectedClientInterface"
      :selected-hotspot-interface="selectedHotspotInterface"
      :hotspot-configured="hotspotConfigured"
      :hotspot-password="hotspotPassword"
      :hotspot-band="hotspotBand"
      :hotspot-channel="hotspotChannel"
      :hotspot-source="hotspotSource"
      :hotspot-interface="hotspotInterface"
      :supported-channels="supportedChannels"
      :hotspot-save-result="hotspotSaveResult"
      :hotspot-can-save-with-session-password="Boolean(lastHotspotPassword)"
      :hotspot-loading="isHotspotLoading"
      :hotspot-saving="isHotspotSaving"
      :disabled="isBusy"
      @toggle-stationary="toggleStationary"
      @scan-wifi="scanWifi"
      @refresh-interfaces="loadWifiInterfaceConfig"
      @save-interfaces="saveWifiInterfaces"
      @connect-wifi="connectWifi()"
      @disconnect-wifi="requestDisableWifi"
      @set-network-mode="setNetworkMode"
      @retry-network-recovery="retryNetworkRecovery"
      @update:selected-ssid="selectedSsid = $event"
      @update:wifi-password="wifiPassword = $event"
      @update:selected-band="selectedBand = $event"
      @update:auto-connect="autoConnect = $event"
      @update:selected-client-interface="selectedClientInterface = $event"
      @update:selected-hotspot-interface="selectedHotspotInterface = $event"
      @update:hotspot-password="hotspotPassword = $event"
      @update:hotspot-band="hotspotBand = $event"
      @update:hotspot-channel="hotspotChannel = $event"
      @load-hotspot="loadHotspotSettings"
      @save-hotspot="saveHotspotSettings"
    />

    <PinsSavedNetworksCard
      :disabled="isBusy"
      :wifi-status="wifiStatus"
      @connect="connectWifi"
      @retry="setNetworkMode('auto')"
      @busy="setSavedNetworkBusy"
    />

    <PinsDhcpClientsCard
      v-if="!stationaryMode || allowConcurrentWifiAndHotspot"
      :clients="dhcpClients"
      :loading="isDhcpClientsLoading"
      @refresh="loadDhcpClients"
    />

    <Modal
      :show="showDisconnectWifiModal"
      @close="showDisconnectWifiModal = false"
      maxWidth="max-w-md"
    >
      <template #header>
        <h2 class="text-xl font-bold text-content">
          {{ $t('plugins.pins.disconnectConfirmTitle') }}
        </h2>
      </template>

      <template #body>
        <div class="w-full">
          <p class="text-content text-sm leading-relaxed mb-6">
            {{ $t('plugins.pins.disconnectConfirmMessage') }}
          </p>
          <div class="flex justify-end gap-3">
            <button @click="showDisconnectWifiModal = false" class="tns-btn-secondary w-auto!">
              {{ $t('common.cancel') }}
            </button>
            <button @click="confirmDisableWifi" class="tns-btn-danger w-auto!">
              {{ $t('common.confirm') }}
            </button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n';
import Modal from '@/components/helpers/Modal.vue';
import PinsWifiCard from '../PinsWifiCard.vue';
import PinsDhcpClientsCard from '../PinsDhcpClientsCard.vue';
import PinsSavedNetworksCard from '../PinsSavedNetworksCard.vue';
import { usePinsJobRunner } from '../composables/usePinsJobRunner';
import { usePinsWifi } from '../composables/usePinsWifi';
import { usePinsHotspot } from '../composables/usePinsHotspot';

const { t } = useI18n();
const runner = usePinsJobRunner({ t });
const { isBusy } = runner;

const {
  stationaryMode,
  wifiList,
  selectedSsid,
  wifiPassword,
  selectedBand,
  autoConnect,
  isScanning,
  wifiStatus,
  wifiMode,
  mobileWifiSignal,
  connectionState,
  dhcpClients,
  isDhcpClientsLoading,
  showDisconnectWifiModal,
  wifiAdapters,
  isWifiAdaptersLoading,
  isWifiInterfacesSaving,
  selectedClientInterface,
  selectedHotspotInterface,
  allowConcurrentWifiAndHotspot,
  loadWifiInterfaceConfig,
  saveWifiInterfaces,
  loadDhcpClients,
  scanWifi,
  toggleStationary,
  connectWifi,
  setNetworkMode,
  requestDisableWifi,
  confirmDisableWifi,
  retryNetworkRecovery,
  setSavedNetworkBusy,
} = usePinsWifi({ t, runner });

const {
  hotspotPassword,
  lastHotspotPassword,
  hotspotConfigured,
  hotspotBand,
  hotspotChannel,
  hotspotSource,
  hotspotInterface,
  supportedChannels,
  hotspotSaveResult,
  isHotspotLoading,
  isHotspotSaving,
  loadHotspotSettings,
  saveHotspotSettings,
} = usePinsHotspot({ t, runner });
</script>
