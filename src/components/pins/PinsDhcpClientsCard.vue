<template>
  <div class="tns-card relative overflow-hidden flex flex-col gap-4">
    <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
      <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
        />
      </svg>
    </div>

    <div class="flex flex-row items-center justify-between gap-3 w-full relative z-10">
      <div class="min-w-0">
        <h3 class="tns-section-title mb-1">{{ $t('plugins.pins.dhcpClientsTitle') }}</h3>
        <p class="text-content-muted text-sm">{{ $t('plugins.pins.dhcpClientsDescription') }}</p>
      </div>
      <button
        @click="$emit('refresh')"
        class="min-h-touch min-w-touch shrink-0 flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
        :disabled="loading"
        :title="$t('plugins.pins.dhcpClientsRefresh')"
      >
        <svg
          class="w-5 h-5"
          :class="{ 'animate-spin': loading }"
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

    <div class="relative z-10">
      <div v-if="loading" class="flex items-center gap-2 text-accent py-4 justify-center">
        <Spinner size="sm" />
        <span>{{ $t('plugins.pins.dhcpClientsLoading') }}</span>
      </div>

      <div v-else-if="clients.length === 0" class="text-content-muted italic py-4 text-center">
        {{ $t('plugins.pins.dhcpClientsEmpty') }}
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-content-muted uppercase text-xs">
            <tr>
              <th class="pb-2 pr-4">{{ $t('plugins.pins.dhcpClientsIp') }}</th>
              <th class="pb-2 pr-4">{{ $t('plugins.pins.dhcpClientsMac') }}</th>
              <th class="pb-2 pr-4">{{ $t('plugins.pins.dhcpClientsHostname') }}</th>
              <th class="pb-2">{{ $t('plugins.pins.dhcpClientsExpires') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="client in clients"
              :key="client.mac"
              class="border-t border-line text-content"
            >
              <td class="py-2 pr-4 font-mono">{{ client.ip }}</td>
              <td class="py-2 pr-4 font-mono text-xs">{{ client.mac }}</td>
              <td class="py-2 pr-4">{{ client.hostname || '—' }}</td>
              <td class="py-2 text-xs text-content-muted">{{ client.expires || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import Spinner from '@/components/helpers/Spinner.vue';

defineProps({
  clients: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['refresh']);
</script>
