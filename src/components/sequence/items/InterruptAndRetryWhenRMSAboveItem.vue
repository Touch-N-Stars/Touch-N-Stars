<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.RmsThreshold }}"</span>
      <span class="text-xs text-content-muted font-mono">≤{{ item.MaxRetries }}×</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.RmsThreshold"
        :label="$t('components.sequence.items.interruptAndRetryWhenRMSAbove.rmsThreshold')"
        labelKey="retry-rms-threshold"
        :min="0"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('RmsThreshold', $event)"
      />

      <div class="flex items-center gap-3">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.interruptAndRetryWhenRMSAbove.mode')
        }}</label>
        <select
          :value="item.Mode"
          class="tns-select-compact ml-auto w-auto"
          @change="save('Mode', $event.target.value)"
        >
          <option value="RMS">
            {{ $t('components.sequence.items.interruptAndRetryWhenRMSAbove.modeRMS') }}
          </option>
          <option value="Peak">
            {{ $t('components.sequence.items.interruptAndRetryWhenRMSAbove.modePeak') }}
          </option>
        </select>
      </div>

      <NumberInputPicker
        v-if="item.Mode === 'RMS'"
        :modelValue="item.MinimumPoints"
        :label="$t('components.sequence.items.interruptAndRetryWhenRMSAbove.minimumPoints')"
        labelKey="retry-rms-minpoints"
        :min="1"
        :max="100"
        :step="1"
        @change="save('MinimumPoints', $event)"
      />

      <NumberInputPicker
        :modelValue="item.StableTime"
        :label="$t('components.sequence.items.interruptAndRetryWhenRMSAbove.stableTime')"
        labelKey="retry-rms-stabletime"
        :min="0"
        :max="600"
        :step="1"
        @change="save('StableTime', $event)"
      />

      <NumberInputPicker
        :modelValue="item.RecoveryTimeout"
        :label="$t('components.sequence.items.interruptAndRetryWhenRMSAbove.recoveryTimeout')"
        labelKey="retry-rms-recoverytimeout"
        :min="0"
        :max="120"
        :step="1"
        @change="save('RecoveryTimeout', $event)"
      />

      <NumberInputPicker
        :modelValue="item.MaxRetries"
        :label="$t('components.sequence.items.interruptAndRetryWhenRMSAbove.maxRetries')"
        labelKey="retry-rms-maxretries"
        :min="0"
        :max="20"
        :step="1"
        @change="save('MaxRetries', $event)"
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
