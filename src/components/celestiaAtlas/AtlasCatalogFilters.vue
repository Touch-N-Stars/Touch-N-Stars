<template>
  <section
    class="col-span-full grid w-full gap-3 rounded-lg border border-gray-500 p-3"
    data-testid="atlas-catalog-filters"
  >
    <div>
      <p class="font-medium text-gray-200">
        {{ t('components.celestiaAtlas.settings.catalog_filters') }}
      </p>
      <p class="text-xs leading-5 text-gray-400">
        {{ t('components.celestiaAtlas.settings.catalog_filter_hint') }}
      </p>
    </div>

    <AtlasFacetGroup
      kind="star-catalogues"
      :title="t('components.celestiaAtlas.settings.star_catalogues')"
      :facets="starCatalogueGroups"
      :selection="settingsStore.celestiaAtlas.starCatalogueGroups"
      @select-all="setSelection('starCatalogueGroups', null)"
      @select-none="setSelection('starCatalogueGroups', [])"
      @toggle="toggleSelection('starCatalogueGroups', starCatalogueGroups, $event)"
    />
    <p class="text-xs leading-5 text-gray-400">
      {{ t('components.celestiaAtlas.settings.star_catalogue_hint') }}
    </p>
    <fieldset :disabled="disabled" class="grid gap-2 disabled:opacity-50">
      <AtlasFacetGroup
        kind="object-types"
        :title="t('components.celestiaAtlas.settings.catalog_filter_types')"
        :facets="objectTypes"
        :selection="settingsStore.celestiaAtlas.deepSkyObjectTypes"
        @select-all="setSelection('deepSkyObjectTypes', null)"
        @select-none="setSelection('deepSkyObjectTypes', [])"
        @toggle="toggleSelection('deepSkyObjectTypes', objectTypes, $event)"
      />

      <AtlasFacetGroup
        kind="catalogue-groups"
        :title="t('components.celestiaAtlas.settings.catalog_filter_sources')"
        :facets="catalogueGroups"
        :selection="settingsStore.celestiaAtlas.deepSkyCatalogueGroups"
        @select-all="setSelection('deepSkyCatalogueGroups', null)"
        @select-none="setSelection('deepSkyCatalogueGroups', [])"
        @toggle="toggleSelection('deepSkyCatalogueGroups', catalogueGroups, $event)"
      />
    </fieldset>
  </section>
</template>

<script setup>
import { useSettingsStore } from '@/store/settingsStore';
import { toggleAtlasFacetSelection } from '@/integrations/celestiaAtlas/catalogFilters';
import AtlasFacetGroup from '@/components/celestiaAtlas/AtlasFacetGroup.vue';
import { useI18n } from 'vue-i18n';

defineProps({
  starCatalogueGroups: {
    type: Array,
    default: () => [],
  },
  objectTypes: {
    type: Array,
    default: () => [],
  },
  catalogueGroups: {
    type: Array,
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const settingsStore = useSettingsStore();
const { t } = useI18n();

function setSelection(setting, value) {
  settingsStore.celestiaAtlas[setting] = value;
}

function toggleSelection(setting, facets, { key, enabled }) {
  settingsStore.celestiaAtlas[setting] = toggleAtlasFacetSelection(
    settingsStore.celestiaAtlas[setting],
    key,
    enabled,
    facets
  );
}
</script>
