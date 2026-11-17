<template>
  <!-- @container: the RA/Dec grids switch to three columns against this block's own width,
       so the fields fit both a nested sequence item and a full-width card. -->
  <div class="@container space-y-2">
    <!-- Target Name -->
    <div class="seq-field-row">
      <label class="tns-label shrink-0">{{ $t('components.sequence.items.dso.targetName') }}</label>
      <input
        type="text"
        class="tns-input-compact ml-auto w-36 md:w-40"
        :value="parsedTarget?.TargetName ?? item.Target?.TargetName"
        @blur="saveTargetName($event.target.value)"
        @keydown.enter="$event.target.blur()"
      />
    </div>

    <!-- Position Angle -->
    <NumberInputPicker
      :modelValue="parsedTarget?.PositionAngle ?? item.Target?.PositionAngle ?? 0"
      :label="$t('components.sequence.items.dso.positionAngle')"
      labelKey="dso-positionAngle"
      :inputId="`dso-positionAngle-${item.Id}`"
      :min="0"
      :max="360"
      :step="1"
      :decimalPlaces="1"
      @change="savePositionAngle($event)"
    />

    <!-- RA -->
    <div class="tns-label font-medium">
      {{ $t('components.sequence.items.center.ra') }}
    </div>
    <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
      <NumberInputPicker
        :modelValue="coords.RAHours"
        label="h"
        labelKey="dso-ra-h"
        :inputId="`dso-ra-h-${item.Id}`"
        :min="0"
        :max="23"
        :step="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="saveRa($event, coords.RAMinutes, coords.RASeconds)"
      />
      <NumberInputPicker
        :modelValue="coords.RAMinutes"
        label="m"
        labelKey="dso-ra-m"
        :inputId="`dso-ra-m-${item.Id}`"
        :min="0"
        :max="59"
        :step="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="saveRa(coords.RAHours, $event, coords.RASeconds)"
      />
      <NumberInputPicker
        :modelValue="localRASeconds ?? coords.RASeconds"
        label="s"
        labelKey="dso-ra-s"
        :inputId="`dso-ra-s-${item.Id}`"
        :min="0"
        :max="59"
        :step="0.1"
        :decimalPlaces="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="
          localRASeconds = $event;
          saveRa(coords.RAHours, coords.RAMinutes, $event);
        "
      />
    </div>

    <!-- Dec -->
    <div class="tns-label font-medium pt-1">
      {{ $t('components.sequence.items.center.dec') }}
    </div>
    <div class="grid grid-cols-1 @[20rem]:grid-cols-3 gap-1">
      <NumberInputPicker
        :modelValue="decDeg"
        label="°"
        labelKey="dso-dec-d"
        :inputId="`dso-dec-d-${item.Id}`"
        :min="-90"
        :max="90"
        :step="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="saveDec($event, coords.DecMinutes, coords.DecSeconds)"
      />
      <NumberInputPicker
        :modelValue="coords.DecMinutes"
        label="m"
        labelKey="dso-dec-m"
        :inputId="`dso-dec-m-${item.Id}`"
        :min="0"
        :max="59"
        :step="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="saveDec(decDeg, $event, coords.DecSeconds)"
      />
      <NumberInputPicker
        :modelValue="localDecSeconds ?? coords.DecSeconds"
        label="s"
        labelKey="dso-dec-s"
        :inputId="`dso-dec-s-${item.Id}`"
        :min="0"
        :max="59"
        :step="0.1"
        :decimalPlaces="1"
        labelPosition="top"
        wrapperClass="w-full"
        @change="
          localDecSeconds = $event;
          saveDec(decDeg, coords.DecMinutes, $event);
        "
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useDsoContainerTarget } from '@/composables/useDsoContainerTarget';

// Hand-typed name, position angle and RA/Dec of a DSO container. Used by the full editor's
// DeepSkyObjectContainerItem and the simple view's target card.
const props = defineProps({
  item: { type: Object, required: true },
});

const { parsedTarget, coords, decDeg, callSetTarget } = useDsoContainerTarget(() => props.item);

const localRASeconds = ref(null);
const localDecSeconds = ref(null);

watch(
  () => props.item.Id,
  () => {
    localRASeconds.value = null;
    localDecSeconds.value = null;
  }
);

function saveRa(h, m, s) {
  callSetTarget((Number(h) + Number(m) / 60 + Number(s) / 3600) * 15, null, null, null);
}

function saveDec(d, m, s) {
  const sign = Number(d) < 0 ? -1 : 1;
  callSetTarget(null, sign * (Math.abs(Number(d)) + Number(m) / 60 + Number(s) / 3600), null, null);
}

function saveTargetName(name) {
  callSetTarget(null, null, name, null);
}

function savePositionAngle(rotation) {
  callSetTarget(null, null, null, rotation);
}
</script>
