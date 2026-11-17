<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ raStr }} {{ decStr }}</span>
      <span class="text-xs text-content-faint font-mono">{{ displayPositionAngle }}°</span>
    </template>

    <template #editor="{ save }">
      <template v-if="!item.Inherited">
        <!-- RA -->
        <div class="text-xs text-content-muted font-medium">
          {{ $t('components.sequence.items.center.ra') }}
        </div>
        <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
          <NumberInputPicker
            :modelValue="c.RAHours"
            label="h"
            labelKey="cr-ra-h"
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
            labelKey="cr-ra-m"
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
            labelKey="cr-ra-s"
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
            labelKey="cr-dec-d"
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
            labelKey="cr-dec-m"
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
            labelKey="cr-dec-s"
            :min="0"
            :max="59"
            :step="0.1"
            :decimalPlaces="1"
            labelPosition="top"
            wrapperClass="w-full"
            @change="saveDec(decDeg, c.DecMinutes, $event)"
          />
        </div>

        <!-- Position Angle -->
        <NumberInputPicker
          :modelValue="item.PositionAngle"
          :label="$t('components.sequence.items.solveAndRotate.positionAngle')"
          labelKey="cr-pos-angle"
          :min="0"
          :max="360"
          :step="0.1"
          :decimalPlaces="1"
          @change="save('PositionAngle', $event)"
        />
      </template>
      <div v-else class="text-xs text-accent/80">
        {{ $t('components.sequence.items.center.inherited') }}
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

const deepSkyContainer = computed(() => {
  if (!props.item.Inherited) return null;
  const DSO = 'NINA.Sequencer.Container.DeepSkyObjectContainer';
  let current = store.findParentOf(props.item.Id);
  while (current) {
    if (current.FullTypeName === DSO) return current;
    current = store.findParentOf(current.Id);
  }
  return null;
});

const c = computed(() => {
  if (props.item.Inherited) {
    return deepSkyContainer.value?.Target?.InputCoordinates ?? {};
  }
  return props.item.Coordinates ?? {};
});

const displayPositionAngle = computed(() => {
  const value = props.item.Inherited
    ? (deepSkyContainer.value?.Target?.PositionAngle ?? 0)
    : props.item.PositionAngle;
  return Number(value).toFixed(2);
});

const raStr = computed(() => {
  const co = c.value;
  if (!co.RAHours && co.RAHours !== 0) return '';
  return `${String(co.RAHours).padStart(2, '0')}:${String(co.RAMinutes).padStart(2, '0')}:${String(Math.round(co.RASeconds)).padStart(2, '0')}`;
});

const decStr = computed(() => {
  const co = c.value;
  if (!co.DecDegrees && co.DecDegrees !== 0) return '';
  const isNegative = co.NegativeDec || (co.DecDegrees ?? 0) < 0;
  const sign = isNegative ? '-' : '+';
  const absDeg = Math.abs(co.DecDegrees);
  return `${sign}${String(absDeg).padStart(2, '0')}°${String(co.DecMinutes).padStart(2, '0')}'${String(Math.round(co.DecSeconds)).padStart(2, '0')}"`;
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
