<template>
  <section class="tns-card space-y-3">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-base font-semibold text-content">
        {{ $t('plugins.aapa.connection.title') }}
      </h2>
      <span class="flex items-center gap-2 text-sm text-content-muted">
        <span
          class="tns-dot"
          :class="store.deviceConnected ? 'bg-status-ok' : 'bg-content-faint'"
        ></span>
        {{
          store.deviceConnected
            ? $t('plugins.aapa.connection.connectedTo', { port: store.server?.connectedPort })
            : $t('plugins.aapa.connection.disconnected')
        }}
      </span>
    </div>

    <template v-if="!store.deviceConnected">
      <label class="flex flex-col gap-1">
        <span class="text-sm text-content-muted">{{ $t('plugins.aapa.connection.port') }}</span>
        <select v-model="selected" class="tns-select">
          <option value="">{{ $t('plugins.aapa.connection.auto') }}</option>
          <option v-for="port in availablePorts" :key="port" :value="port">{{ port }}</option>
          <option :value="IP_OPTION">{{ $t('plugins.aapa.connection.wifi') }}</option>
        </select>
      </label>
      <label v-if="selected === IP_OPTION" class="flex flex-col gap-1">
        <span class="text-sm text-content-muted">{{
          $t('plugins.aapa.connection.ipAddress')
        }}</span>
        <input
          v-model.trim="ip"
          type="text"
          inputmode="url"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          class="tns-input"
          placeholder="192.168.1.100"
          @focus="editingIp = true"
          @blur="onIpBlur"
          @keydown.enter="$event.target.blur()"
        />
      </label>
      <button class="tns-btn-primary" :disabled="!canConnect" @click="connect">
        {{ $t('plugins.aapa.connection.connect') }}
      </button>
      <p v-if="selected === ''" class="text-xs text-content-faint">
        {{ $t('plugins.aapa.connection.autoHint') }}
      </p>
    </template>
    <button v-else class="tns-btn-secondary" @click="store.command('Disconnect')">
      {{ $t('plugins.aapa.connection.disconnect') }}
    </button>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useAapaStore } from '../store/aapaStore';
import { isIpv4 } from '../utils/aapaProtocol';

// Sentinel select value; real port names never look like this.
const IP_OPTION = '__ip__';

const store = useAapaStore();
const selected = ref('');
const ip = ref('');
const editingIp = ref(false);

const availablePorts = computed(() => store.server?.availablePorts ?? []);
const canConnect = computed(
  () => store.isWsOpen && (selected.value !== IP_OPTION || isIpv4(ip.value))
);

// Protocol v2 shares the IP with the box in N.I.N.A.'s panel; older servers do not
// report it, and the field stays local there.
const serverIp = computed(() => store.settings.LastIpAddress);
const ipSynced = computed(() => typeof serverIp.value === 'string');

// Follow changes made in N.I.N.A., but never overwrite what the user is typing.
watch(
  serverIp,
  (value) => {
    if (!editingIp.value && typeof value === 'string') ip.value = value;
  },
  { immediate: true }
);

// Reopen on Wi-Fi after disconnecting from a Wi-Fi connection.
watch(
  () => store.server?.connectedPort,
  (port) => {
    if (isIpv4(port)) selected.value = IP_OPTION;
  },
  { immediate: true }
);

function pushIp() {
  if (ipSynced.value && isIpv4(ip.value) && ip.value !== serverIp.value) {
    store.setSetting('LastIpAddress', ip.value);
  }
}

function onIpBlur() {
  editingIp.value = false;
  pushIp();
}

function connect() {
  if (selected.value === IP_OPTION) {
    pushIp();
    store.connectDevice(ip.value);
  } else {
    store.connectDevice(selected.value);
  }
}
</script>
