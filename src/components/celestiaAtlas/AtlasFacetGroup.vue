<template>
  <details class="rounded-md border border-line-strong bg-surface-1/40" :data-filter-kind="kind">
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm text-content"
    >
      <span>{{ title }}</span>
      <span class="shrink-0 text-xs text-accent">
        {{
          t('components.celestiaAtlas.settings.catalog_filter_selected', {
            selected: selectedCount,
            total: facets.length,
          })
        }}
      </span>
    </summary>

    <div class="border-t border-line p-2">
      <div class="mb-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          data-filter-action="all"
          class="min-h-11 rounded-md border border-accent-action bg-accent/15 px-3 text-sm text-content"
          @click="$emit('selectAll')"
        >
          {{ t('components.celestiaAtlas.settings.catalog_filter_all') }}
        </button>
        <button
          type="button"
          data-filter-action="none"
          class="min-h-11 rounded-md border border-line-strong bg-surface-2 px-3 text-sm text-content"
          @click="$emit('selectNone')"
        >
          {{ t('components.celestiaAtlas.settings.catalog_filter_none') }}
        </button>
      </div>

      <div class="grid max-h-64 gap-1 overflow-y-auto overscroll-contain pr-1 sm:grid-cols-2">
        <label
          v-for="facet in facets"
          :key="facet.key"
          class="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1 hover:bg-surface-2"
        >
          <input
            :id="`atlas-${kind}-${facet.key}`"
            :name="`atlas-${kind}`"
            type="checkbox"
            :value="facet.key"
            :data-facet-key="facet.key"
            class="h-5 w-5 shrink-0 accent-accent-action"
            :checked="isSelected(facet.key)"
            @change="toggle(facet.key, $event.target.checked)"
          />
          <span class="min-w-0 flex-1 text-sm text-content">
            <span class="block truncate">{{ facet.label }}</span>
            <span class="block font-mono text-[10px] uppercase text-content-faint">{{
              facet.key
            }}</span>
          </span>
          <span class="shrink-0 text-xs tabular-nums text-content-muted">
            {{ numberFormatter.format(facet.count) }}
          </span>
        </label>
      </div>
    </div>
  </details>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { normalizeAtlasFacetSelection } from '@/integrations/celestiaAtlas/catalogFilters';

const props = defineProps({
  kind: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  facets: {
    type: Array,
    default: () => [],
  },
  selection: {
    type: null,
    default: null,
  },
});

const emit = defineEmits(['selectAll', 'selectNone', 'toggle']);
const { locale, t } = useI18n();
const normalizedSelection = computed(() =>
  normalizeAtlasFacetSelection(props.selection, props.facets)
);
const selectedCount = computed(() =>
  normalizedSelection.value === null ? props.facets.length : normalizedSelection.value.length
);
const numberFormatter = computed(() => new Intl.NumberFormat(locale.value));

function isSelected(key) {
  return normalizedSelection.value === null || normalizedSelection.value.includes(key);
}

function toggle(key, enabled) {
  emit('toggle', { key, enabled });
}
</script>
