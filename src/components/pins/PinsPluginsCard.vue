<template>
  <div class="tns-card relative overflow-hidden">
    <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
      <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 11H5m14-6H5m14 12H5m14 6H5"
        />
      </svg>
    </div>

    <div class="relative z-10 flex flex-col gap-4">
      <div class="flex flex-row items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="tns-section-title mb-1">{{ $t('plugins.pins.pluginsTitle') }}</h3>
          <p class="text-content-muted text-sm">{{ $t('plugins.pins.pluginsDescription') }}</p>
        </div>

        <button
          class="min-h-touch min-w-touch shrink-0 flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
          :disabled="loading || disabled"
          :title="$t('plugins.pins.pluginsRefresh')"
          @click="$emit('refresh')"
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

      <div class="text-xs text-content-muted">
        {{ $t('plugins.pins.pluginsCheckedAt') }}:
        {{ checkedAt ? new Date(checkedAt).toLocaleString() : '-' }}
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-accent text-sm">
        <Spinner size="sm" />{{ $t('plugins.pins.scanning') }}
      </div>

      <div v-else-if="plugins.length === 0" class="text-content-muted italic py-2">
        {{ $t('plugins.pins.pluginsEmpty') }}
      </div>

      <div v-else class="max-h-96 overflow-auto border border-line rounded-card">
        <table class="w-full text-left text-sm">
          <thead class="bg-surface-2 text-content-muted sticky top-0">
            <tr>
              <th class="px-4 py-3">{{ $t('plugins.pins.pluginsPackage') }}</th>
              <th class="px-4 py-3">{{ $t('plugins.pins.pluginsInstalled') }}</th>
              <th class="px-4 py-3">{{ $t('plugins.pins.pluginsVersion') }}</th>
              <th class="px-4 py-3 text-right">{{ $t('plugins.pins.pluginsAction') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="plugin in plugins"
              :key="plugin.packageName"
              class="border-t border-line text-content"
            >
              <td class="px-4 py-3 font-medium break-all">{{ plugin.packageName }}</td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex items-center rounded-chip px-2 py-1 text-xs font-semibold border"
                  :class="
                    plugin.installed
                      ? 'bg-status-ok/10 text-status-ok border-status-ok/40'
                      : 'bg-surface-3 text-content-muted border-line-strong'
                  "
                >
                  {{
                    plugin.installed
                      ? $t('plugins.pins.pluginsInstalledYes')
                      : $t('plugins.pins.pluginsInstalledNo')
                  }}
                </span>
              </td>
              <td class="px-4 py-3">{{ formatPluginVersion(plugin) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <button
                    v-if="!plugin.installed"
                    class="tns-btn-primary w-auto! px-3!"
                    :disabled="disabled || busyPackage === plugin.packageName"
                    @click="$emit('install', plugin.packageName)"
                  >
                    {{
                      busyPackage === plugin.packageName
                        ? $t('plugins.pins.pluginsInstalling')
                        : $t('plugins.pins.pluginsInstall')
                    }}
                  </button>
                  <button
                    v-else
                    class="tns-btn-danger w-auto! px-3!"
                    :disabled="disabled || busyPackage === plugin.packageName"
                    @click="$emit('uninstall', plugin.packageName)"
                  >
                    {{
                      busyPackage === plugin.packageName
                        ? $t('plugins.pins.pluginsUninstalling')
                        : $t('plugins.pins.pluginsUninstall')
                    }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import Spinner from '@/components/helpers/Spinner.vue';

function formatPluginVersion(plugin) {
  if (!plugin) {
    return '-';
  }

  const installedVersion = plugin.installedVersion || null;
  const availableVersion = plugin.availableVersion || null;

  if (installedVersion && availableVersion && installedVersion !== availableVersion) {
    return `${installedVersion} -> ${availableVersion}`;
  }

  return installedVersion || availableVersion || '-';
}

defineProps({
  plugins: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  checkedAt: {
    type: String,
    default: '',
  },
  busyPackage: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['refresh', 'install', 'uninstall']);
</script>
