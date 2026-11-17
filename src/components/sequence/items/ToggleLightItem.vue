<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted">{{
        item.OnOff ? $t('components.sequence.items.on') : $t('components.sequence.items.off')
      }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.dewHeater.onOff')
        }}</label>
        <div class="ml-auto">
          <ToggleButton :statusValue="item.OnOff" @update:statusValue="save('OnOff', $event)" />
        </div>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
