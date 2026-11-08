<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted truncate">{{ item.Text }}</span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row items-start">
        <label class="tns-label shrink-0 mt-1">{{
          $t('components.sequence.items.annotation.text')
        }}</label>
        <TextAreaInput
          :modelValue="item.Text ?? ''"
          inputClass="tns-input-compact ml-auto w-36 md:w-40 resize-none"
          :rows="3"
          @change="save('Text', $event)"
        />
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import TextAreaInput from '@/components/helpers/TextAreaInput.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
