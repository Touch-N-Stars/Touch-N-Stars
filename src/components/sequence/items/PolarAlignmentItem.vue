<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ item.ExposureTime }}s</span>
      <span v-if="item.Filter?.Name" class="text-xs text-content-muted shrink-0">{{
        item.Filter.Name
      }}</span>
      <span v-if="item.ManualMode" class="text-xs text-content-faint">{{
        $t('components.sequence.items.polarAlignment.manual')
      }}</span>
    </template>

    <template #editor="{ save }">
      <NumberInputPicker
        :modelValue="item.ExposureTime"
        :label="$t('components.sequence.items.takeExposure.exposureTime')"
        labelKey="pa-expTime"
        :min="0"
        :max="3600"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('ExposureTime', $event)"
      />

      <!-- Filter -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchFilter.filter')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="item.Filter?.Name ?? ''"
          @change="save('Filter', $event.target.value || null)"
        >
          <option value="">{{ $t('components.sequence.items.switchFilter.noFilter') }}</option>
          <option
            v-for="filter in store.filterInfo?.AvailableFilters"
            :key="filter.Id"
            :value="filter.Name"
          >
            {{ filter.Name }}
          </option>
        </select>
      </div>

      <GainInput
        :modelValue="item.Gain"
        labelKey="pa-gain"
        :min="-1"
        :max="1000"
        @change="save('Gain', $event)"
      />

      <NumberInputPicker
        :modelValue="item.Offset"
        :label="$t('components.sequence.items.takeExposure.offset')"
        labelKey="pa-offset"
        :min="-1"
        :max="1000"
        :step="1"
        :decimalPlaces="0"
        @change="save('Offset', $event)"
      />

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.binning')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="binningValue"
          @change="save('Binning', $event.target.value)"
        >
          <option value='{"X":1,"Y":1}'>1x1</option>
          <option value='{"X":2,"Y":2}'>2x2</option>
          <option value='{"X":3,"Y":3}'>3x3</option>
          <option value='{"X":4,"Y":4}'>4x4</option>
        </select>
      </div>

      <NumberInputPicker
        :modelValue="item.SearchRadius"
        :label="$t('components.sequence.items.polarAlignment.searchRadius')"
        labelKey="pa-searchRadius"
        :min="1"
        :max="90"
        :step="1"
        :decimalPlaces="0"
        @change="save('SearchRadius', $event)"
      />

      <NumberInputPicker
        :modelValue="item.AlignmentTolerance"
        :label="$t('components.sequence.items.polarAlignment.alignmentTolerance')"
        labelKey="pa-alignTolerance"
        :min="0"
        :max="60"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('AlignmentTolerance', $event)"
      />

      <NumberInputPicker
        :modelValue="item.MoveRate"
        :label="$t('components.sequence.items.polarAlignment.moveRate')"
        labelKey="pa-moveRate"
        :min="0.1"
        :max="10"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('MoveRate', $event)"
      />

      <NumberInputPicker
        :modelValue="item.TargetDistance"
        :label="$t('components.sequence.items.polarAlignment.targetDistance')"
        labelKey="pa-targetDistance"
        :min="1"
        :max="180"
        :step="1"
        :decimalPlaces="0"
        @change="save('TargetDistance', $event)"
      />

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.polarAlignment.eastDirection')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.EastDirection"
            @update:statusValue="save('EastDirection', $event)"
          />
        </div>
      </div>

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.polarAlignment.manualMode')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.ManualMode"
            @update:statusValue="save('ManualMode', $event)"
          />
        </div>
      </div>

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.polarAlignment.startFromCurrentPosition')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.StartFromCurrentPosition"
            @update:statusValue="save('StartFromCurrentPosition', $event)"
          />
        </div>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import GainInput from '@/components/helpers/GainInput.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';
import { apiStore } from '@/store/store';

const store = apiStore();

const props = defineProps({
  item: { type: Object, required: true },
});

const binningValue = computed(() => {
  const b = props.item.Binning;
  if (!b) return '{"X":1,"Y":1}';
  return JSON.stringify({ X: b.X, Y: b.Y });
});
</script>
