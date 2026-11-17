<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted truncate">{{ paramLabel }}</span>
    </template>

    <template #editor="{ save }">
      <!-- Parameter type select -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.changePHD2Parameters.parameter')
        }}</label>
        <select
          :value="item.Phd2Parameter"
          class="tns-select-compact ml-auto w-auto"
          @change="save('Phd2Parameter', Number($event.target.value))"
        >
          <option v-for="p in parameters" :key="p.value" :value="p.value">{{ p.label }}</option>
        </select>
      </div>

      <!-- Dither Pixels -->
      <NumberInputPicker
        v-if="item.Phd2Parameter === 0"
        :modelValue="item.DitherPixels"
        :label="$t('components.sequence.items.changePHD2Parameters.ditherPixels')"
        labelKey="phd2-ditherpx"
        :min="0"
        :max="100"
        :step="0.5"
        :decimalPlaces="1"
        @change="save('DitherPixels', $event)"
      />

      <!-- Dither in RA Only -->
      <div v-else-if="item.Phd2Parameter === 1" class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.changePHD2Parameters.ditherRAOnly')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.DitherRAOnly"
            @update:statusValue="save('DitherRAOnly', $event)"
          />
        </div>
      </div>

      <!-- Settle Pixel Tolerance -->
      <NumberInputPicker
        v-else-if="item.Phd2Parameter === 2"
        :modelValue="item.SettlePixels"
        :label="$t('components.sequence.items.changePHD2Parameters.settlePixels')"
        labelKey="phd2-settlepx"
        :min="0"
        :max="100"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('SettlePixels', $event)"
      />

      <!-- Minimum Settle Time -->
      <NumberInputPicker
        v-else-if="item.Phd2Parameter === 3"
        :modelValue="item.SettleTime"
        :label="$t('components.sequence.items.changePHD2Parameters.settleTime')"
        labelKey="phd2-settletime"
        :min="0"
        :max="300"
        :step="1"
        @change="save('SettleTime', $event)"
      />

      <!-- Settle Timeout -->
      <NumberInputPicker
        v-else-if="item.Phd2Parameter === 4"
        :modelValue="item.SettleTimeout"
        :label="$t('components.sequence.items.changePHD2Parameters.settleTimeout')"
        labelKey="phd2-settletimeout"
        :min="0"
        :max="600"
        :step="1"
        @change="save('SettleTimeout', $event)"
      />

      <!-- ROI -->
      <NumberInputPicker
        v-else-if="item.Phd2Parameter === 5"
        :modelValue="item.RoiPct"
        :label="$t('components.sequence.items.changePHD2Parameters.roiPct')"
        labelKey="phd2-roi"
        :min="0"
        :max="100"
        :step="1"
        @change="save('RoiPct', $event)"
      />

      <!-- Exposure Time -->
      <NumberInputPicker
        v-else-if="item.Phd2Parameter === 6"
        :modelValue="item.ExposureTime"
        :label="$t('components.sequence.items.changePHD2Parameters.exposureTime')"
        labelKey="phd2-exposure"
        :min="0"
        :max="60"
        :step="0.1"
        :decimalPlaces="1"
        @change="save('ExposureTime', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import ToggleButton from '@/components/helpers/toggleButton.vue';

const { t } = useI18n();

const props = defineProps({
  item: { type: Object, required: true },
});

const parameters = [
  { value: 0, label: t('components.sequence.items.changePHD2Parameters.ditherPixels') },
  { value: 1, label: t('components.sequence.items.changePHD2Parameters.ditherRAOnly') },
  { value: 2, label: t('components.sequence.items.changePHD2Parameters.settlePixels') },
  { value: 3, label: t('components.sequence.items.changePHD2Parameters.settleTime') },
  { value: 4, label: t('components.sequence.items.changePHD2Parameters.settleTimeout') },
  { value: 5, label: t('components.sequence.items.changePHD2Parameters.roiPct') },
  { value: 6, label: t('components.sequence.items.changePHD2Parameters.exposureTime') },
];

const paramLabel = computed(
  () => parameters.find((p) => p.value === props.item.Phd2Parameter)?.label ?? ''
);
</script>
