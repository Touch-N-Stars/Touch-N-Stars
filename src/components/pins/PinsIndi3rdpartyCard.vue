<template>
  <div class="tns-card relative overflow-hidden">
    <div class="absolute top-0 right-20 p-4 opacity-10 pointer-events-none">
      <svg class="w-16 h-16 text-content" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 7h16M4 12h16M4 17h16"
        />
      </svg>
    </div>

    <div class="relative z-10 flex flex-col gap-4">
      <div class="flex flex-row items-start justify-between gap-2">
        <div class="min-w-0">
          <h3 class="tns-section-title mb-1">
            {{ $t('plugins.pins.indi3rdpartyTitle') }}
          </h3>
          <p class="text-content-muted text-sm">{{ $t('plugins.pins.indi3rdpartyDescription') }}</p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button
            class="min-h-touch min-w-touch flex items-center justify-center text-accent hover:text-content transition-colors disabled:opacity-50"
            :disabled="loading || disabled"
            :title="$t('plugins.pins.indi3rdpartyRefresh')"
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
      </div>

      <div class="flex flex-col sm:flex-row gap-3">
        <input
          :value="searchQuery"
          @input="$emit('update:searchQuery', $event.target.value)"
          @keyup.enter="$emit('search')"
          class="tns-input"
          :placeholder="$t('plugins.pins.indi3rdpartySearchPlaceholder')"
          :disabled="disabled"
        />
        <button @click="$emit('search')" :disabled="disabled" class="tns-btn-secondary sm:w-auto!">
          {{ $t('plugins.pins.indi3rdpartySearch') }}
        </button>
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-accent text-sm">
        <Spinner size="sm" />{{ $t('plugins.pins.scanning') }}
      </div>

      <!-- The picker stays mounted even with an empty result list, so a fruitless
           search never hides the driver selection or the config editor. -->
      <div class="flex flex-col gap-3">
        <label for="pinsIndiDriver" class="tns-label">{{
          $t('plugins.pins.indi3rdpartySelect')
        }}</label>
        <select
          id="pinsIndiDriver"
          :value="selectedAsset"
          @change="$emit('update:selectedAsset', $event.target.value)"
          class="tns-select"
          :disabled="disabled || drivers.length === 0"
        >
          <option value="" disabled>{{ $t('plugins.pins.indi3rdpartySelect') }}</option>
          <option v-for="pkg in drivers" :key="pkg.assetName" :value="pkg.assetName">
            {{ pkg.name }} - {{ pkg.version }} ({{ pkg.architecture }})
          </option>
        </select>

        <p v-if="!loading && drivers.length === 0" class="text-content-muted italic">
          {{ $t('plugins.pins.indi3rdpartyNoDrivers') }}
        </p>

        <button
          @click="$emit('install')"
          :disabled="disabled || installing || !selectedAsset"
          class="tns-btn-primary"
        >
          {{
            installing
              ? $t('plugins.pins.indi3rdpartyInstalling')
              : $t('plugins.pins.indi3rdpartyInstall')
          }}
        </button>

        <button
          class="tns-btn-secondary"
          :disabled="loading || disabled"
          @click="$emit('edit-config')"
        >
          {{ $t('plugins.pins.indiRegistryEditConfig') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Spinner from '@/components/helpers/Spinner.vue';

defineProps({
  drivers: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  installing: {
    type: Boolean,
    default: false,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  selectedAsset: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits([
  'refresh',
  'search',
  'install',
  'edit-config',
  'update:searchQuery',
  'update:selectedAsset',
]);
</script>
