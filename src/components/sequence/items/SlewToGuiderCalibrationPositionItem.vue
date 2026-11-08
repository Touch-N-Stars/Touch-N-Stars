<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">
        HA±{{ item.HaOffsetDegrees ?? 5 }}° Dec{{ (item.TargetDec ?? 0) >= 0 ? '+' : ''
        }}{{ item.TargetDec ?? 0 }}°
        {{
          item.PointingSide === 'East'
            ? $t('components.sequence.items.slewToGuiderCalibrationPosition.sideEast')
            : item.PointingSide === 'West'
              ? $t('components.sequence.items.slewToGuiderCalibrationPosition.sideWest')
              : $t('components.sequence.items.slewToGuiderCalibrationPosition.sideStay')
        }}
      </span>
    </template>

    <template #editor="{ save }">
      <div class="seq-field-row">
        <label class="tns-label flex-shrink-0">
          {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.haOffset') }}
        </label>
        <NumberInputPicker
          :modelValue="item.HaOffsetDegrees"
          label="°"
          labelKey="calib-ha-offset"
          :min="0"
          :max="90"
          :step="0.5"
          :decimalPlaces="1"
          wrapperClass="ml-auto"
          @change="save('HaOffsetDegrees', $event)"
        />
      </div>

      <div class="seq-field-row">
        <label class="tns-label flex-shrink-0">
          {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.dec') }}
        </label>
        <NumberInputPicker
          :modelValue="item.TargetDec"
          label="°"
          labelKey="calib-dec"
          :min="-90"
          :max="90"
          :step="1"
          :decimalPlaces="1"
          wrapperClass="ml-auto"
          @change="save('TargetDec', $event)"
        />
      </div>

      <div class="seq-field-row">
        <label class="tns-label flex-shrink-0">
          {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.side') }}
        </label>
        <select
          :value="item.PointingSide"
          class="tns-select-compact ml-auto w-auto"
          @change="save('PointingSide', $event.target.value)"
        >
          <option value="Stay">
            {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.sideStay') }}
          </option>
          <option value="East">
            {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.sideEast') }}
          </option>
          <option value="West">
            {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.sideWest') }}
          </option>
        </select>
      </div>

      <div class="seq-field-row">
        <label class="tns-label flex-shrink-0">
          {{ $t('components.sequence.items.slewToGuiderCalibrationPosition.clearBacklash') }}
        </label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.ClearBacklash"
            @update:statusValue="save('ClearBacklash', $event)"
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

defineProps({
  item: { type: Object, required: true },
});
</script>
