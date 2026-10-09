<template>
  <div class="flex flex-col space-y-6">
    <PinsRepositoryCard
      :repository="repository"
      :loading="repositoryLoading"
      :switching="repositorySwitching"
      :error="repositoryError"
      :disabled="disabled"
      @switch="$emit('repository-switch', $event)"
      @refresh="$emit('repository-refresh')"
    />
    <div v-if="availableUpdateCount > 0" class="text-center">
      <button
        @click="$emit('open-updates')"
        class="text-amber-300 hover:text-amber-200 underline underline-offset-4 transition-colors"
      >
        {{ $t('plugins.pins.updatesAvailable', { count: availableUpdateCount }) }}
      </button>
    </div>

    <PinsIndi3rdpartyCard
      :drivers="drivers"
      :loading="loading"
      :installing="installing"
      :search-query="searchQuery"
      :selected-asset="selectedAsset"
      :disabled="disabled"
      @refresh="$emit('refresh')"
      @search="$emit('search')"
      @install="$emit('install')"
      @edit-config="$emit('open-indi-registry-config')"
      @update:search-query="$emit('update:search-query', $event)"
      @update:selected-asset="$emit('update:selected-asset', $event)"
    />

    <PinsPluginsCard
      :plugins="plugins"
      :loading="pluginsLoading"
      :checked-at="pluginsCheckedAt"
      :busy-package="pluginsBusyPackage"
      :disabled="disabled"
      @refresh="$emit('plugins-refresh')"
      @install="$emit('plugin-install', $event)"
      @uninstall="$emit('plugin-uninstall', $event)"
    />
  </div>
</template>

<script setup>
import PinsIndi3rdpartyCard from '../PinsIndi3rdpartyCard.vue';
import PinsPluginsCard from '../PinsPluginsCard.vue';
import PinsRepositoryCard from '../PinsRepositoryCard.vue';

defineProps({
  repository: { type: Object, default: null },
  repositoryLoading: { type: Boolean, default: false },
  repositorySwitching: { type: Boolean, default: false },
  repositoryError: { type: String, default: '' },
  availableUpdateCount: {
    type: Number,
    required: true,
  },
  drivers: {
    type: Array,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  installing: {
    type: Boolean,
    required: true,
  },
  searchQuery: {
    type: String,
    required: true,
  },
  selectedAsset: {
    type: String,
    required: true,
  },
  plugins: {
    type: Array,
    required: true,
  },
  pluginsLoading: {
    type: Boolean,
    required: true,
  },
  pluginsCheckedAt: {
    type: String,
    default: '',
  },
  pluginsBusyPackage: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    required: true,
  },
});

defineEmits([
  'repository-switch',
  'repository-refresh',
  'open-updates',
  'refresh',
  'search',
  'install',
  'open-indi-registry-config',
  'plugins-refresh',
  'plugin-install',
  'plugin-uninstall',
  'update:search-query',
  'update:selected-asset',
]);
</script>
