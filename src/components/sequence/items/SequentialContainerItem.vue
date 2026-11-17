<template>
  <ItemShell :item="item">
    <template v-if="item.Iterations > 0" #summary>
      <span class="text-xs text-content-muted font-mono"
        >{{ item.CompletedIterations ?? 0 }} / {{ item.Iterations }}</span
      >
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{ $t('common.name') }}</label>
        <TextInput
          :modelValue="item.Name ?? ''"
          inputClass="tns-input-compact ml-auto w-36 md:w-40"
          @change="save('Name', $event)"
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
