<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">{{
        item.PredicateDefinition || item.Predicate
      }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.waitUntil.predicate')
        }}</label>
        <TextInput
          :modelValue="item.PredicateDefinition"
          inputClass="tns-input-compact ml-auto w-36 md:w-40"
          @change="save('PredicateDefinition', $event)"
        />
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import TextInput from '@/components/helpers/TextInput.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
