<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">{{ item.Variable }}</span>
      <span v-if="item.Expr?.Definition" class="text-xs text-content-faint font-mono truncate"
        >= {{ item.Expr.Definition }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Variable name -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.expressionVariable.identifier')
        }}</label>
        <TextInput
          :modelValue="item.Variable"
          inputClass="tns-input-compact ml-auto w-36 md:w-40"
          @change="save('Variable', $event)"
        />
      </div>

      <!-- New Value -->
      <NumberInputPicker
        :modelValue="Number(item.Expr?.Definition)"
        :label="$t('components.sequence.items.expressionVariable.newValue')"
        labelKey="resetvar-value"
        :min="-999999"
        :max="999999"
        :step="1"
        :decimalPlaces="2"
        @change="save('Expr', { Definition: String($event) })"
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
