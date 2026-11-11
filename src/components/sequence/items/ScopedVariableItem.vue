<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">{{ item.Identifier }}</span>
      <span v-if="item.OriginalDefinition" class="text-xs text-content-faint font-mono truncate"
        >= {{ item.OriginalDefinition }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Name -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.expressionVariable.identifier')
        }}</label>
        <TextInput
          :modelValue="item.Identifier"
          inputClass="tns-input-compact ml-auto w-36 md:w-40"
          @change="save('Identifier', $event)"
        />
      </div>

      <!-- Initially -->
      <NumberInputPicker
        :modelValue="Number(item.OriginalDefinition)"
        :label="$t('components.sequence.items.expressionVariable.initially')"
        labelKey="scopedvar-initial"
        :min="-999999"
        :max="999999"
        :step="1"
        :decimalPlaces="2"
        @change="save('OriginalDefinition', String($event))"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import TextInput from '@/components/helpers/TextInput.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
