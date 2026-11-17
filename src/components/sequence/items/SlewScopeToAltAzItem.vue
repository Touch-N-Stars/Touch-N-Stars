<template>
  <ItemShell :item="item">
    <template #summary>
      <span class="text-xs text-content-muted font-mono">Az {{ azStr }} Alt {{ altStr }}</span>
    </template>

    <template #editor>
      <!-- Az -->
      <div class="text-xs text-content-muted font-medium">
        {{ $t('components.sequence.items.slewScopeToAltAz.azimuth') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="c.AzDegrees"
          label="°"
          labelKey="altaz-az-d"
          :min="0"
          :max="359"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAz($event, c.AzMinutes, c.AzSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.AzMinutes"
          label="m"
          labelKey="altaz-az-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAz(c.AzDegrees, $event, c.AzSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.AzSeconds"
          label="s"
          labelKey="altaz-az-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAz(c.AzDegrees, c.AzMinutes, $event)"
        />
      </div>

      <!-- Alt -->
      <div class="text-xs text-content-muted font-medium pt-1">
        {{ $t('components.sequence.items.slewScopeToAltAz.altitude') }}
      </div>
      <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
        <NumberInputPicker
          :modelValue="c.AltDegrees"
          label="°"
          labelKey="altaz-alt-d"
          :min="0"
          :max="90"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAlt($event, c.AltMinutes, c.AltSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.AltMinutes"
          label="m"
          labelKey="altaz-alt-m"
          :min="0"
          :max="59"
          :step="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAlt(c.AltDegrees, $event, c.AltSeconds)"
        />
        <NumberInputPicker
          :modelValue="c.AltSeconds"
          label="s"
          labelKey="altaz-alt-s"
          :min="0"
          :max="59"
          :step="0.1"
          :decimalPlaces="1"
          labelPosition="top"
          wrapperClass="w-full"
          @change="saveAlt(c.AltDegrees, c.AltMinutes, $event)"
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

const azStr = computed(() => {
  const co = c.value;
  if (co.AzDegrees === undefined) return '';
  return `${String(co.AzDegrees).padStart(3, '0')}°${String(co.AzMinutes).padStart(2, '0')}'`;
});

const altStr = computed(() => {
  const co = c.value;
  if (co.AltDegrees === undefined) return '';
  return `${String(co.AltDegrees).padStart(2, '0')}°${String(co.AltMinutes).padStart(2, '0')}'`;
});

function saveAz(d, m, s) {
  const decimal = Number(d) + Number(m) / 60 + Number(s) / 3600;
  store.setProperty(props.item.Id, 'Az', decimal);
}

function saveAlt(d, m, s) {
  const decimal = Number(d) + Number(m) / 60 + Number(s) / 3600;
  store.setProperty(props.item.Id, 'Alt', decimal);
}
</script>
