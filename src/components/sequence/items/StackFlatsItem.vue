<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.QueueEntries }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.stackFlats.waitForStack')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.WaitForStack"
            @update:statusValue="save('WaitForStack', $event)"
          />
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
