<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">
        {{ item.PredicateDefinition || '—' }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.loopWhile.expression')
        }}</label>
        <input
          type="text"
          class="tns-input-compact ml-auto flex-1 font-mono"
          :value="item.PredicateDefinition"
          @blur="save('PredicateDefinition', $event.target.value)"
          @keydown.enter="$event.target.blur()"
        />
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
