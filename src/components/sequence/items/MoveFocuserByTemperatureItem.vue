<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono"
        >{{ item.Slope }}x + {{ item.Intercept }}</span
      >
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.Slope"
        :label="$t('components.sequence.items.moveFocuserByTemperature.slope')"
        labelKey="movefocuserbytemp-slope"
        :min="-9999"
        :max="9999"
        :step="0.1"
        :decimalPlaces="2"
        @change="save('Slope', $event)"
      />
      <NumberInputPicker
        :modelValue="item.Intercept"
        :label="$t('components.sequence.items.moveFocuserByTemperature.intercept')"
        labelKey="movefocuserbytemp-intercept"
        :min="-999999"
        :max="999999"
        :step="1"
        :decimalPlaces="1"
        @change="save('Intercept', $event)"
      />
      <div class="seq-field-row">
        <label class="tns-label shrink-0">
          {{ $t('components.sequence.items.moveFocuserByTemperature.absolute') }}
        </label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.Absolute"
            @update:statusValue="save('Absolute', $event)"
          />
        </div>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';

defineProps({ item: { type: Object, required: true } });
</script>
