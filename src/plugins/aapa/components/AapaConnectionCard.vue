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
          inputmode="decimal"
          class="tns-input"
          placeholder="192.168.1.100"
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
import { computed, ref } from 'vue';
import { useAapaStore } from '../store/aapaStore';

// Sentinel select value; real port names never look like this.
const IP_OPTION = '__ip__';
const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/;

const store = useAapaStore();
const selected = ref('');
const ip = ref('');

const availablePorts = computed(() => store.server?.availablePorts ?? []);
const canConnect = computed(
  () => store.isWsOpen && (selected.value !== IP_OPTION || IPV4.test(ip.value))
);

function connect() {
  store.connectDevice(selected.value === IP_OPTION ? ip.value : selected.value);
}
</script>
