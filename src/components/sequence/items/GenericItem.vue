<template>
  <ItemShell :item="item" :label="$t('components.sequence.items.generic')">
    <!-- The fields are resolved when the editor opens (GenericFieldsEditor asks the plugin
         for their real types), so only offer the editor when there is anything to show. -->
    <template v-if="hasAnyField" #editor="{ save }">
      <GenericFieldsEditor :item="item" :save="save" />
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import GenericFieldsEditor from './GenericFieldsEditor.vue';
import { excludedKeys } from '@/utils/sequenceConfig';

const props = defineProps({
  item: { type: Object, required: true },
});

const hasAnyField = computed(() =>
  Object.entries(props.item).some(
    ([key, val]) =>
      !excludedKeys.has(key) &&
      val !== null &&
      val !== undefined &&
      !(Array.isArray(val) && val.length === 0)
  )
);
</script>
