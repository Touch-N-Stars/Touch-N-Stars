<template>
  <div class="tns-card relative overflow-hidden flex flex-col gap-4">
    <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
      <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
        />
      </svg>
    </div>

    <div class="flex flex-row items-center justify-between gap-3 w-full relative z-10">
      <div class="min-w-0">
        <h3 class="tns-section-title mb-1">{{ $t('plugins.pins.wifiTitle') }}</h3>
        <p class="text-content-muted text-sm">{{ $t('plugins.pins.stationaryDescription') }}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <button
          v-if="stationaryMode || allowConcurrentMode"
          @click="$emit('scan-wifi')"
          class="min-h-touch min-w-touch flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
          :disabled="isScanning"
          :title="$t('plugins.pins.rescan')"
        >
          <svg
            class="w-5 h-5"
            :class="{ 'animate-spin': isScanning }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
        <toggleButton
          :status-value="stationaryMode"
          @update:status-value="$emit('toggle-stationary', $event)"
          :disabled="disabled"
        />
      </div>
    </div>

    <div
      class="w-full relative z-10 rounded-card border border-line bg-surface-2 p-4 flex flex-col gap-3"
    >
      <div>
        <h4 class="text-base font-semibold text-content">
          {{ $t('plugins.pins.networkMode.title') }}
        </h4>
        <p class="text-content-muted text-xs">
          {{ $t('plugins.pins.networkMode.description') }}
        </p>
      </div>

      <!-- Same segmented control as the other mode/tab switches in the app (AapaView,
           TenMicronView): the selected segment is filled with the accent color. -->
      <div
        class="grid grid-cols-2 gap-1 rounded-control bg-surface-1 border border-line p-1"
        role="radiogroup"
      >
        <button
          v-for="mode in networkModeOptions"
          :key="mode.value"
          role="radio"
          :aria-checked="desiredNetworkMode === mode.value"
          class="min-h-touch rounded-chip px-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :class="
            desiredNetworkMode === mode.value
              ? 'bg-accent-action text-white'
              : 'text-content-muted hover:bg-surface-2'
          "
          :disabled="disabled || networkTransitionActive"
          @click="$emit('set-network-mode', mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>
      <p class="text-xs text-content-muted">{{ selectedNetworkModeHint }}</p>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
        <span>{{
          $t('plugins.pins.networkMode.configured', { mode: networkModeName(desiredNetworkMode) })
        }}</span>
        <span>{{
          $t('plugins.pins.networkMode.active', { mode: networkModeName(observedNetworkMode) })
        }}</span>
        <span v-if="connectionState.activeHost">{{
          $t('plugins.pins.networkMode.endpoint', { host: connectionState.activeHost })
        }}</span>
      </div>

      <p v-if="!allowConcurrentMode" class="text-xs text-status-warn">
        {{ $t('plugins.pins.networkMode.singleRadioWarning') }}
      </p>

      <div
        v-if="networkTransitionActive || connectionState.phase === 'failed'"
        class="rounded-control border p-3 text-sm text-content"
        :class="
          connectionState.phase === 'failed'
            ? 'border-status-danger/40 bg-status-danger/10'
            : 'border-accent/40 bg-accent/10'
        "
      >
        <p class="font-semibold">
          {{
            connectionState.phase === 'failed'
              ? $t('plugins.pins.networkMode.notFound')
              : $t('plugins.pins.networkMode.searching')
          }}
        </p>
        <p v-if="connectionState.attemptedHosts?.length" class="text-xs mt-1 break-all opacity-80">
          {{
            $t('plugins.pins.networkMode.tried', {
              hosts: connectionState.attemptedHosts.join(', '),
            })
          }}
        </p>
        <p v-if="connectionState.error" class="text-xs mt-1 opacity-80">
          {{ connectionState.error }}
        </p>
        <button
          v-if="connectionState.phase === 'failed'"
          class="tns-btn-primary w-auto! mt-3"
          @click="$emit('retry-network-recovery')"
        >
          {{ $t('plugins.pins.networkMode.retry') }}
        </button>
      </div>
    </div>

    <div
      class="w-full relative z-10 rounded-card border border-line bg-surface-2 p-4 flex flex-col gap-3"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h4 class="text-base font-semibold text-content">
            {{ $t('plugins.pins.wifiAdaptersTitle') }}
          </h4>
          <p class="text-content-muted text-xs">{{ $t('plugins.pins.wifiAdaptersDescription') }}</p>
        </div>
        <button
          class="min-h-touch min-w-touch shrink-0 flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
          :disabled="interfacesLoading || interfacesSaving || disabled"
          :title="$t('plugins.pins.wifiAdapterRefresh')"
          @click="$emit('refresh-interfaces')"
        >
          <svg
            class="w-5 h-5"
            :class="{ 'animate-spin': interfacesLoading }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div v-if="wifiAdapters.length === 0" class="text-sm text-content-muted italic">
        {{ $t('plugins.pins.wifiNoAdapters') }}
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="flex flex-col gap-2">
          <label for="pinsClientInterface" class="tns-label">{{
            $t('plugins.pins.wifiClientInterface')
          }}</label>
          <select
            id="pinsClientInterface"
            :value="selectedClientInterface"
            @change="$emit('update:selectedClientInterface', $event.target.value)"
            class="tns-select"
            :disabled="interfacesLoading || interfacesSaving || disabled"
          >
            <option value="">{{ $t('plugins.pins.wifiAutoInterface') }}</option>
            <option
              v-for="adapter in wifiAdapters"
              :key="adapter.interface"
              :value="adapter.interface"
            >
              {{ formatAdapterLabel(adapter) }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <label for="pinsHotspotInterface" class="tns-label">{{
            $t('plugins.pins.wifiHotspotInterface')
          }}</label>
          <select
            id="pinsHotspotInterface"
            :value="selectedHotspotInterface"
            @change="$emit('update:selectedHotspotInterface', $event.target.value)"
            class="tns-select"
            :disabled="interfacesLoading || interfacesSaving || disabled"
          >
            <option value="">{{ $t('plugins.pins.wifiAutoInterface') }}</option>
            <option
              v-for="adapter in wifiAdapters"
              :key="adapter.interface"
              :value="adapter.interface"
            >
              {{ formatAdapterLabel(adapter) }}
            </option>
          </select>
        </div>
      </div>

      <button
        class="tns-btn-primary"
        :disabled="interfacesLoading || interfacesSaving || disabled"
        @click="$emit('save-interfaces')"
      >
        {{
          interfacesSaving
            ? $t('plugins.pins.wifiAdapterSaving')
            : $t('plugins.pins.wifiAdapterSave')
        }}
      </button>
    </div>

    <div
      v-if="stationaryMode || allowConcurrentMode"
      class="w-full relative z-10 flex flex-col gap-3 mt-2 animate-fade-in-up"
    >
      <div
        class="rounded-control border p-3 text-sm"
        :class="
          wifiIsConnected
            ? 'border-status-ok/40 bg-status-ok/10 text-content'
            : 'border-line bg-surface-2 text-content-muted'
        "
      >
        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-2">
            <span
              class="tns-dot"
              :class="wifiIsConnected ? 'bg-status-ok' : 'bg-content-faint'"
            ></span>
            <span class="font-semibold">
              {{
                wifiIsConnected
                  ? $t('plugins.pins.wifiStatusConnected')
                  : $t('plugins.pins.wifiStatusDisconnected')
              }}
            </span>
          </div>
          <div v-if="wifiIsConnected" class="text-xs text-content-muted sm:text-right">
            <span>{{ wifiStatusLabel }}</span>
          </div>
        </div>
      </div>

      <div v-if="wifiConnectionRows.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="connection in wifiConnectionRows"
          :key="connection.key"
          class="rounded-card border border-line bg-surface-2 p-3 flex flex-col gap-2"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="tns-label">
                {{ formatConnectionRole(connection.role) }}
              </div>
              <div class="text-content font-semibold truncate">
                {{ connection.ssid || connection.connectionName || connection.interface || '-' }}
              </div>
            </div>
            <span
              class="text-xs px-2 py-1 rounded-chip border"
              :class="
                connection.connected
                  ? 'border-status-ok/40 bg-status-ok/10 text-status-ok'
                  : 'border-line bg-surface-1 text-content-muted'
              "
            >
              {{
                connection.connected
                  ? $t('plugins.pins.wifiStatusConnected')
                  : $t('plugins.pins.wifiStatusDisconnected')
              }}
            </span>
          </div>

          <div class="text-xs text-content-muted flex flex-wrap gap-x-3 gap-y-1">
            <span v-if="connection.interface">{{ connection.interface }}</span>
            <span v-if="connection.ipAddress">{{ connection.ipAddress }}</span>
            <span v-if="connection.band">{{ connection.band }}</span>
            <span v-if="connection.channel">{{
              $t('plugins.pins.wifiChannel', { channel: connection.channel })
            }}</span>
          </div>

          <div v-if="hasSignal(connection)" class="flex flex-col gap-1">
            <div class="flex items-center justify-between text-xs text-content">
              <span>
                {{
                  connection.measuredOnMobile
                    ? $t('plugins.pins.wifiSignalMobile')
                    : $t('plugins.pins.wifiSignal')
                }}
              </span>
              <span>{{
                $t('plugins.pins.wifiSignalValue', { value: connection.signalStrength })
              }}</span>
            </div>
            <div class="h-2 rounded-full bg-surface-1 overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="signalBarClass(connection.signalStrength)"
                :style="{ width: `${connection.signalStrength}%` }"
              ></div>
            </div>
            <div
              v-if="signalHistory(connection).length > 1"
              class="flex items-end gap-1 h-8 pt-1"
              :aria-label="$t('plugins.pins.wifiSignalHistory')"
            >
              <span
                v-for="(sample, index) in signalHistory(connection)"
                :key="`${connection.key}-${index}`"
                class="flex-1 min-w-[3px] rounded-sm"
                :class="signalBarClass(sample)"
                :style="{ height: `${Math.max(15, sample)}%` }"
              ></span>
            </div>
            <div v-if="connection.rssiDbm" class="text-[11px] text-content-faint">
              {{ $t('plugins.pins.wifiRssiValue', { value: connection.rssiDbm }) }}
            </div>
          </div>

          <div v-else class="text-xs text-content-faint">
            {{ $t('plugins.pins.wifiSignalUnavailable') }}
          </div>
        </div>
      </div>

      <div v-if="isScanning" class="flex items-center gap-2 text-accent py-4 justify-center">
        <Spinner size="md" />
        <span>{{ $t('plugins.pins.scanning') }}</span>
      </div>

      <div v-else-if="wifiList.length > 0" class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label for="pinsWifiSsid" class="tns-label">{{ $t('plugins.pins.wifiSelect') }}</label>
          <select
            id="pinsWifiSsid"
            :value="selectedSsid"
            @change="$emit('update:selectedSsid', $event.target.value)"
            class="tns-select"
          >
            <option value="" disabled>{{ $t('plugins.pins.wifiSelect') }}</option>
            <option v-for="net in wifiList" :key="net.ssid" :value="net.ssid">
              {{ net.ssid }} ({{ net.quality }}) {{ net.encrypted ? '🔒' : '' }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2" v-if="selectedSsid">
          <span class="tns-label">{{ $t('plugins.pins.wifiBand') }}</span>
          <div class="flex flex-wrap gap-x-4">
            <label
              v-for="band in bandOptions"
              :key="band.value"
              class="flex items-center gap-2 min-h-touch cursor-pointer"
            >
              <input
                type="radio"
                :value="band.value"
                :checked="selectedBand === band.value"
                @change="$emit('update:selectedBand', band.value)"
                class="h-5 w-5 accent-accent-action"
              />
              <span class="text-content text-sm">{{ band.label }}</span>
            </label>
          </div>
        </div>

        <div class="flex flex-col gap-2" v-if="selectedSsid">
          <label for="pinsWifiPassword" class="tns-label">{{
            $t('plugins.pins.wifiPassword')
          }}</label>
          <input
            id="pinsWifiPassword"
            :value="wifiPassword"
            @input="$emit('update:wifiPassword', $event.target.value)"
            type="password"
            class="tns-input"
            placeholder="********"
          />
        </div>

        <label v-if="selectedSsid" class="flex flex-row items-center gap-2 min-h-touch">
          <input
            type="checkbox"
            :checked="autoConnect"
            @change="$emit('update:autoConnect', $event.target.checked)"
            class="h-5 w-5 accent-accent-action"
          />
          <span class="text-content text-sm">{{ $t('plugins.pins.autoConnect') }}</span>
        </label>

        <button
          v-if="selectedSsid"
          :class="
            isSelectedNetworkConnected
              ? 'tns-btn-secondary border-status-ok/40 text-content-muted'
              : 'tns-btn-primary'
          "
          :disabled="disabled || isSelectedNetworkConnected"
          @click="$emit('connect-wifi')"
        >
          {{
            isSelectedNetworkConnected
              ? $t('plugins.pins.wifiConnectedAction')
              : $t('plugins.pins.wifiConnect')
          }}
        </button>

        <button class="tns-btn-danger" :disabled="disabled" @click="$emit('disconnect-wifi')">
          {{ $t('plugins.pins.wifiDisconnect') }}
        </button>
      </div>

      <div v-else class="text-content-muted italic py-4 text-center">
        {{ $t('plugins.pins.noNetworks') }}
      </div>
    </div>

    <div class="w-full relative z-10 border-t border-line pt-4 mt-1 flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <h4 class="text-base font-semibold text-content">
            {{ $t('plugins.pins.hotspotPasswordTitle') }}
          </h4>
          <div class="text-content-muted text-xs space-y-1">
            <p>
              {{
                hotspotConfigured
                  ? $t('plugins.pins.hotspotConfigured')
                  : $t('plugins.pins.hotspotNotConfigured')
              }}
            </p>
            <p>
              {{
                $t('plugins.pins.hotspotMetaLine', {
                  source: hotspotSource || 'default',
                  iface: hotspotInterface || 'auto',
                  band: hotspotBand === 'auto' ? 'unset' : hotspotBand,
                  channel: hotspotChannel || 'unset',
                })
              }}
            </p>
          </div>
        </div>
        <button
          class="min-h-touch min-w-touch shrink-0 flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
          :disabled="hotspotLoading || hotspotSaving || disabled"
          :title="$t('plugins.pins.hotspotRefresh')"
          @click="$emit('load-hotspot')"
        >
          <svg
            class="w-5 h-5"
            :class="{ 'animate-spin': hotspotLoading }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <div class="flex flex-col gap-2">
        <label for="pinsHotspotBand" class="tns-label">
          {{ $t('plugins.pins.hotspotBandLabel') }}
        </label>
        <select
          id="pinsHotspotBand"
          :value="hotspotBand"
          @change="$emit('update:hotspotBand', $event.target.value)"
          class="tns-select"
          :disabled="hotspotSaving || hotspotLoading || disabled"
        >
          <option value="auto">{{ $t('plugins.pins.hotspotBandAuto') }}</option>
          <option value="2.4GHz">{{ $t('plugins.pins.band24') }}</option>
          <option value="5GHz">{{ $t('plugins.pins.band5') }}</option>
        </select>
      </div>

      <div class="flex flex-col gap-2">
        <label for="pinsHotspotChannel" class="tns-label">
          {{ $t('plugins.pins.hotspotChannelLabel') }}
        </label>
        <!-- Stays a plain field: empty means "no channel set", which NumberInputPicker cannot
             represent. The chips below cover the channels the adapter reports. -->
        <input
          id="pinsHotspotChannel"
          :value="hotspotChannel"
          @input="$emit('update:hotspotChannel', sanitizePositiveInteger($event.target.value))"
          type="number"
          min="1"
          step="1"
          class="tns-input"
          :placeholder="$t('plugins.pins.hotspotChannelPlaceholder')"
          :disabled="hotspotSaving || hotspotLoading || disabled"
        />

        <div v-if="selectedBandChannels.length" class="flex flex-wrap gap-2">
          <button
            v-for="channel in selectedBandChannels"
            :key="`hotspot-channel-${channel}`"
            type="button"
            class="min-w-10 min-h-10 px-3 rounded-chip text-xs border transition-colors disabled:opacity-50"
            :class="
              String(channel) === hotspotChannel
                ? 'bg-accent-action border-accent-action text-white'
                : 'bg-surface-2 border-line-strong text-content-muted hover:text-content hover:border-accent'
            "
            :disabled="hotspotSaving || hotspotLoading || disabled"
            @click="$emit('update:hotspotChannel', String(channel))"
          >
            {{ channel }}
          </button>
        </div>

        <p v-if="selectedBandCapabilitiesEmpty" class="text-xs text-status-warn">
          {{ $t('plugins.pins.hotspotCapabilitiesUnavailable') }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label for="pinsHotspotPassword" class="tns-label">{{
          $t('plugins.pins.hotspotNewPassword')
        }}</label>
        <input
          id="pinsHotspotPassword"
          :value="hotspotPassword"
          @input="$emit('update:hotspotPassword', $event.target.value)"
          type="password"
          class="tns-input"
          placeholder="********"
          :disabled="hotspotSaving || hotspotLoading || disabled"
        />
        <p class="text-xs text-content-faint">{{ $t('plugins.pins.hotspotPasswordHint') }}</p>
      </div>

      <div
        v-if="hotspotSaveResult"
        class="rounded-control border p-3 text-sm"
        :class="
          hotspotSaveResult.appliedToActiveHotspot
            ? 'border-status-ok/40 bg-status-ok/10 text-status-ok'
            : 'border-status-warn/40 bg-status-warn/10 text-status-warn'
        "
      >
        <p class="font-semibold">{{ hotspotSaveResult.message }}</p>
        <p class="text-xs mt-1">
          {{
            $t('plugins.pins.hotspotAppliedStatus', {
              applied: hotspotSaveResult.appliedToActiveHotspot
                ? $t('general.yes')
                : $t('general.no'),
              band: hotspotSaveResult.band || 'unset',
              channel:
                hotspotSaveResult.channel === null ||
                typeof hotspotSaveResult.channel === 'undefined'
                  ? 'unset'
                  : hotspotSaveResult.channel,
            })
          }}
        </p>
      </div>

      <button
        class="tns-btn-primary"
        :disabled="hotspotSaving || hotspotLoading || disabled || !canSaveHotspot"
        @click="$emit('save-hotspot')"
      >
        {{ hotspotSaving ? $t('plugins.pins.hotspotSaving') : $t('plugins.pins.hotspotSave') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import toggleButton from '@/components/helpers/toggleButton.vue';
import Spinner from '@/components/helpers/Spinner.vue';

const { t } = useI18n();

const bandOptions = computed(() => [
  { value: 'auto', label: t('plugins.pins.bandAuto') },
  { value: '2.4GHz', label: t('plugins.pins.band24') },
  { value: '5GHz', label: t('plugins.pins.band5') },
]);

const props = defineProps({
  stationaryMode: {
    type: Boolean,
    required: true,
  },
  allowConcurrentMode: {
    type: Boolean,
    required: true,
  },
  isScanning: {
    type: Boolean,
    required: true,
  },
  wifiList: {
    type: Array,
    required: true,
  },
  wifiStatus: {
    type: Object,
    required: false,
    default: null,
  },
  wifiMode: {
    type: Object,
    required: false,
    default: null,
  },
  connectionState: {
    type: Object,
    required: true,
  },
  mobileWifiSignal: {
    type: Object,
    required: false,
    default: null,
  },
  selectedSsid: {
    type: String,
    required: true,
  },
  wifiPassword: {
    type: String,
    required: true,
  },
  selectedBand: {
    type: String,
    required: true,
  },
  autoConnect: {
    type: Boolean,
    required: true,
  },
  wifiAdapters: {
    type: Array,
    required: true,
  },
  interfacesLoading: {
    type: Boolean,
    required: true,
  },
  interfacesSaving: {
    type: Boolean,
    required: true,
  },
  selectedClientInterface: {
    type: String,
    required: true,
  },
  selectedHotspotInterface: {
    type: String,
    required: true,
  },
  hotspotConfigured: {
    type: Boolean,
    required: true,
  },
  hotspotPassword: {
    type: String,
    required: true,
  },
  hotspotBand: {
    type: String,
    required: true,
  },
  hotspotChannel: {
    type: String,
    required: true,
  },
  hotspotSource: {
    type: String,
    required: true,
  },
  hotspotInterface: {
    type: String,
    required: true,
  },
  supportedChannels: {
    type: Object,
    required: true,
  },
  hotspotSaveResult: {
    type: Object,
    required: false,
    default: null,
  },
  hotspotCanSaveWithSessionPassword: {
    type: Boolean,
    required: true,
  },
  hotspotLoading: {
    type: Boolean,
    required: true,
  },
  hotspotSaving: {
    type: Boolean,
    required: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits([
  'toggle-stationary',
  'scan-wifi',
  'refresh-interfaces',
  'save-interfaces',
  'connect-wifi',
  'disconnect-wifi',
  'set-network-mode',
  'retry-network-recovery',
  'update:selectedSsid',
  'update:wifiPassword',
  'update:selectedBand',
  'update:autoConnect',
  'update:selectedClientInterface',
  'update:selectedHotspotInterface',
  'update:hotspotPassword',
  'update:hotspotBand',
  'update:hotspotChannel',
  'load-hotspot',
  'save-hotspot',
]);

const selectedBandChannels = computed(() => {
  if (props.hotspotBand !== '2.4GHz' && props.hotspotBand !== '5GHz') {
    return [];
  }

  const candidates = props.supportedChannels?.[props.hotspotBand];
  if (!Array.isArray(candidates)) {
    return [];
  }

  return candidates
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);
});

const selectedBandCapabilitiesEmpty = computed(() => {
  if (props.hotspotBand !== '2.4GHz' && props.hotspotBand !== '5GHz') {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(props.supportedChannels || {}, props.hotspotBand)) {
    return false;
  }

  return selectedBandChannels.value.length === 0;
});

const canSaveHotspot = computed(() => {
  const inlinePassword = String(props.hotspotPassword || '').trim();
  const passwordValidLength = inlinePassword.length >= 8 && inlinePassword.length <= 63;
  return passwordValidLength || props.hotspotCanSaveWithSessionPassword;
});

const wifiIsConnected = computed(() => Boolean(props.wifiStatus?.connected));
const desiredNetworkMode = computed(
  () => props.wifiMode?.desiredMode || props.wifiStatus?.desiredMode || 'unknown'
);
const observedNetworkMode = computed(
  () => props.wifiMode?.observedMode || props.wifiStatus?.observedMode || 'unknown'
);
const networkModeOptions = computed(() => [
  {
    value: 'auto',
    label: t('plugins.pins.networkMode.autoLabel'),
    hint: t('plugins.pins.networkMode.autoHint'),
  },
  {
    value: 'hotspot',
    label: t('plugins.pins.networkMode.hotspotLabel'),
    hint: t('plugins.pins.networkMode.hotspotHint'),
  },
]);
const selectedNetworkModeHint = computed(
  () => networkModeOptions.value.find((mode) => mode.value === desiredNetworkMode.value)?.hint || ''
);
// Daemon reports auto/hotspot/client/dual/unknown; an unexpected value is shown as-is.
const networkModeNames = {
  auto: 'modeAuto',
  hotspot: 'modeHotspot',
  client: 'modeClient',
  dual: 'modeDual',
  unknown: 'modeUnknown',
};
function networkModeName(mode) {
  const key = networkModeNames[mode];
  return key ? t(`plugins.pins.networkMode.${key}`) : mode;
}
const networkTransitionActive = computed(() =>
  ['network-transition', 'probing', 'reconnecting'].includes(props.connectionState.phase)
);

const wifiStatusLabel = computed(() => {
  if (!wifiIsConnected.value) {
    return '';
  }

  const parts = [];
  if (props.wifiStatus?.ssid) {
    parts.push(props.wifiStatus.ssid);
  }
  if (props.wifiStatus?.ipAddress) {
    parts.push(props.wifiStatus.ipAddress);
  }
  if (props.wifiStatus?.interface) {
    parts.push(props.wifiStatus.interface);
  }
  if (props.wifiStatus?.band) {
    parts.push(props.wifiStatus.band);
  }

  return parts.join(' | ');
});

const isSelectedNetworkConnected = computed(() => {
  const connectedSsid = String(props.wifiStatus?.ssid || '').trim();
  const selected = String(props.selectedSsid || '').trim();
  return Boolean(wifiIsConnected.value && connectedSsid && selected && connectedSsid === selected);
});

const signalHistoryByKey = ref({});

const wifiConnectionRows = computed(() => {
  const rows = Array.isArray(props.wifiStatus?.connections) ? props.wifiStatus.connections : [];
  const normalized = rows
    .filter((connection) => connection && connection.connected)
    .map((connection) => normalizeWifiConnection(connection));

  if (normalized.length > 0) {
    return normalized;
  }

  if (!props.wifiStatus?.connected) {
    return [];
  }

  return [normalizeWifiConnection({ ...props.wifiStatus, role: 'client' })];
});

watch(
  wifiConnectionRows,
  (connections) => {
    const nextKeys = new Set();
    const nextHistory = { ...signalHistoryByKey.value };

    connections.forEach((connection) => {
      nextKeys.add(connection.key);
      if (!hasSignal(connection)) {
        return;
      }

      const existing = Array.isArray(nextHistory[connection.key])
        ? nextHistory[connection.key]
        : [];
      nextHistory[connection.key] = [...existing, connection.signalStrength].slice(-12);
    });

    Object.keys(nextHistory).forEach((key) => {
      if (!nextKeys.has(key)) {
        delete nextHistory[key];
      }
    });

    signalHistoryByKey.value = nextHistory;
  },
  { immediate: true }
);

function normalizeWifiConnection(connection) {
  const role = connection.role || 'client';
  const iface = connection.interface || '';
  const name = connection.ssid || connection.connectionName || '';
  const mobileSignal =
    role === 'hotspot' && mobileSignalMatchesConnection(connection) ? props.mobileWifiSignal : null;
  const rawSignal = mobileSignal?.signalStrength ?? connection.signalStrength;
  // The hotspot reports null, which Number() would turn into a signal of 0%.
  const signal =
    rawSignal !== null &&
    rawSignal !== '' &&
    Number.isFinite(Number(rawSignal)) &&
    Number(rawSignal) >= 0
      ? Math.min(100, Math.max(0, Number(rawSignal)))
      : null;

  return {
    ...connection,
    role,
    interface: iface,
    signalStrength: signal,
    quality: mobileSignal?.quality || connection.quality,
    rssiDbm: mobileSignal?.rssiDbm ?? connection.rssiDbm,
    measuredOnMobile: Boolean(mobileSignal),
    key: `${role}:${iface}:${name}`,
  };
}

function mobileSignalMatchesConnection(connection) {
  if (!props.mobileWifiSignal?.available || !props.mobileWifiSignal?.ssid) {
    return false;
  }

  const mobileSsid = normalizeSsid(props.mobileWifiSignal.ssid);
  const candidates = [connection.ssid, connection.connectionName]
    .map((value) => normalizeSsid(value))
    .filter(Boolean);

  if (candidates.includes(mobileSsid)) {
    return true;
  }

  if (connection.role !== 'hotspot') {
    return false;
  }

  const genericHotspotNames = ['Hotspot', 'hotspot-ap'].map((value) => normalizeSsid(value));
  const hasGenericHotspotName = candidates.some((candidate) =>
    genericHotspotNames.includes(candidate)
  );
  return hasGenericHotspotName && mobileSsid.startsWith('pins-');
}

function normalizeSsid(value) {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '');
}

function hasSignal(connection) {
  return Number.isFinite(connection?.signalStrength);
}

function signalHistory(connection) {
  return signalHistoryByKey.value[connection.key] || [];
}

function signalBarClass(value) {
  if (value >= 70) {
    return 'bg-status-ok';
  }
  if (value >= 40) {
    return 'bg-status-warn';
  }
  return 'bg-status-danger';
}

function formatConnectionRole(role) {
  if (role === 'hotspot') {
    return t('plugins.pins.wifiRoleHotspot');
  }
  return t('plugins.pins.wifiRoleClient');
}

function sanitizePositiveInteger(value) {
  const text = String(value ?? '').trim();
  if (!text) {
    return '';
  }

  const asNumber = Number(text);
  if (!Number.isInteger(asNumber) || asNumber < 1) {
    return '';
  }

  return String(asNumber);
}

function formatAdapterLabel(adapter) {
  if (!adapter || !adapter.interface) {
    return '';
  }

  const parts = [adapter.interface];
  if (adapter.role && adapter.role !== 'idle') {
    parts.push(adapter.role);
  }
  if (adapter.state) {
    parts.push(adapter.state);
  }
  if (adapter.driver) {
    parts.push(adapter.driver);
  }

  return parts.join(' | ');
}
</script>
