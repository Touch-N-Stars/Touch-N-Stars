<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="item.ForceCalibration" class="text-xs text-accent">
        {{ $t('components.sequence.items.startGuiding.forceCalibrationLabel') }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label shrink-0">
          {{ $t('components.sequence.items.startGuiding.forceCalibrationLabel') }}
        </label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.ForceCalibration"
            @update:statusValue="save('ForceCalibration', $event)"
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
