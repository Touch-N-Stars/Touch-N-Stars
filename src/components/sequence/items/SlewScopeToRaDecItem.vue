<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">{{ raStr }} {{ decStr }}</span>
    </template>

    <template #editor="{ save }">
      <!-- RA -->
      <div class="text-xs text-content-muted font-medium">
        {{ $t('components.sequence.items.center.ra') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="c.RAHours"
          label="h"
          labelKey="slew-ra-h"
          :min="0"
          :max="23"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveCoords({ RAHours: $event })"
        />
        <NumberInputPicker
          :modelValue="c.RAMinutes"
          label="m"
          labelKey="slew-ra-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveCoords({ RAMinutes: $event })"
        />
        <NumberInputPicker
          :modelValue="c.RASeconds"
          label="s"
          labelKey="slew-ra-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveCoords({ RASeconds: $event })"
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
          labelKey="slew-dec-d"
          :min="-90"
          :max="90"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveDecDeg($event)"
        />
        <NumberInputPicker
          :modelValue="c.DecMinutes"
          label="m"
          labelKey="slew-dec-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveCoords({ DecMinutes: $event })"
        />
        <NumberInputPicker
          :modelValue="c.DecSeconds"
          label="s"
          labelKey="slew-dec-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveCoords({ DecSeconds: $event })"
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

function saveCoords(patch) {
  const coords = { ...c.value, ...patch };
  store.setProperty(props.item.Id, 'Coordinates', JSON.stringify(coords));
}

function saveDecDeg(d) {
  saveCoords({ NegativeDec: Number(d) < 0, DecDegrees: Math.abs(Number(d)) });
}
</script>
