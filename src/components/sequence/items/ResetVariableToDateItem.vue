<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono truncate">{{ item.Variable }}</span>
      <span class="text-xs text-content-faint font-mono">{{ item.TimeString }}</span>
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

      <!-- Time -->
      <div class="text-xs text-content-muted font-medium">
        {{ $t('components.sequence.items.expressionVariable.time') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="item.Hours"
          label="h"
          labelKey="resetdate-h"
          :min="0"
          :max="23"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="save('Hours', $event)"
        />
        <NumberInputPicker
          :modelValue="item.Minutes"
          label="m"
          labelKey="resetdate-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="save('Minutes', $event)"
        />
        <NumberInputPicker
          :modelValue="item.Seconds"
          label="s"
          labelKey="resetdate-s"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="save('Seconds', $event)"
        />
      </div>

      <!-- Offset -->
      <NumberInputPicker
        :modelValue="item.MinutesOffset"
        :label="$t('components.sequence.items.expressionVariable.minutesOffset')"
        labelKey="resetdate-offset"
        :min="-1440"
        :max="1440"
        :step="1"
        :decimalPlaces="0"
        @change="save('MinutesOffset', $event)"
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
