<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.RmsThreshold }}"</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.RmsThreshold"
        :label="$t('components.sequence.items.interruptWhenRMSAbove.rmsThreshold')"
        labelKey="rms-threshold"
        :min="0"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('RmsThreshold', $event)"
      />

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.interruptWhenRMSAbove.mode')
        }}</label>
        <select
          :value="item.Mode"
          class="tns-select-compact ml-auto w-auto"
          @change="save('Mode', $event.target.value)"
        >
          <option value="RMS">
            {{ $t('components.sequence.items.interruptWhenRMSAbove.modeRMS') }}
          </option>
          <option value="Peak">
            {{ $t('components.sequence.items.interruptWhenRMSAbove.modePeak') }}
          </option>
        </select>
      </div>

      <NumberInputPicker
        v-if="item.Mode === 'RMS'"
        :modelValue="item.MinimumPoints"
        :label="$t('components.sequence.items.interruptWhenRMSAbove.minimumPoints')"
        labelKey="rms-minpoints"
        :min="1"
        :max="100"
        :step="1"
        @change="save('MinimumPoints', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

defineProps({
  item: { type: Object, required: true },
});
</script>
