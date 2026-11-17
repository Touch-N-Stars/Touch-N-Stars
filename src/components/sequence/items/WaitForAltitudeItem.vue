<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono"
        >{{ item.AboveOrBelow }} {{ item.Offset }}°</span
      >
      <span class="text-xs text-content-faint font-mono">{{ raStr }}</span>
      <span v-if="item.ExpectedTime" class="text-xs text-amber-400/80 font-mono"
        >⏱ {{ item.ExpectedTime }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Above/Below -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.moonAltitude.comparator')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="item.AboveOrBelow"
          @change="save('AboveOrBelow', $event.target.value)"
        >
          <option value=">">{{ $t('components.sequence.items.moonAltitude.above') }}</option>
          <option value="<">{{ $t('components.sequence.items.moonAltitude.below') }}</option>
        </select>
      </div>

      <!-- Altitude offset -->
      <NumberInputPicker
        :modelValue="item.Offset"
        :label="$t('components.sequence.items.altitudeCondition.altitude')"
        labelKey="waitalt-offset"
        :min="-90"
        :max="90"
        :step="1"
        :decimalPlaces="1"
        @change="save('Offset', $event)"
      />

      <!-- RA -->
      <div class="text-xs text-content-muted font-medium">
        {{ $t('components.sequence.items.center.ra') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="c.RAHours"
          label="h"
          labelKey="waitalt-ra-h"
          :min="0"
          :max="23"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveRa($event, c.RAMinutes, c.RASeconds)"
        />
        <NumberInputPicker
          :modelValue="c.RAMinutes"
          label="m"
          labelKey="waitalt-ra-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveRa(c.RAHours, $event, c.RASeconds)"
        />
        <NumberInputPicker
          :modelValue="c.RASeconds"
          label="s"
          labelKey="waitalt-ra-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveRa(c.RAHours, c.RAMinutes, $event)"
        />
      </div>

      <!-- Dec -->
      <div class="text-xs text-content-muted font-medium pt-1">
        {{ $t('components.sequence.items.center.dec') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="decDeg"
          label="°"
          labelKey="waitalt-dec-d"
          :min="-90"
          :max="90"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveDec($event, c.DecMinutes, c.DecSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.DecMinutes"
          label="m"
          labelKey="waitalt-dec-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveDec(decDeg, $event, c.DecSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.DecSeconds"
          label="s"
          labelKey="waitalt-dec-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveDec(decDeg, c.DecMinutes, $event)"
        />
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = useSequenceV2Store();
const c = computed(() => props.item.Coordinates ?? {});

const raStr = computed(() => {
  const co = c.value;
  if (!co.RAHours && co.RAHours !== 0) return '';
  return `${String(co.RAHours).padStart(2, '0')}:${String(co.RAMinutes).padStart(2, '0')}`;
});

const decDeg = computed(() => {
  const co = c.value;
  const isNegative = co.NegativeDec || (co.DecDegrees ?? 0) < 0;
  const absDeg = Math.abs(co.DecDegrees ?? 0);
  return isNegative ? -absDeg : absDeg;
});

function saveRa(h, m, s) {
  const decimal = Number(h) + Number(m) / 60 + Number(s) / 3600;
  store.setProperty(props.item.Id, 'Ra', decimal);
}

function saveDec(d, m, s) {
  const sign = Number(d) < 0 ? -1 : 1;
  const decimal = sign * (Math.abs(Number(d)) + Number(m) / 60 + Number(s) / 3600);
  store.setProperty(props.item.Id, 'Dec', decimal);
}
</script>
