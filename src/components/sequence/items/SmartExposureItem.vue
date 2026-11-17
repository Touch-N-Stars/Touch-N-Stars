<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="currentFilter" class="text-xs text-content-muted shrink-0">{{
        currentFilter
      }}</span>
      <template v-if="exposure">
        <span class="text-xs text-content-muted font-mono shrink-0"
          >{{ exposure.ExposureTime }}s</span
        >
        <span class="text-xs text-content-faint shrink-0">G{{ exposure.Gain }}</span>
      </template>
      <span v-if="loopCondition" class="text-xs text-content-muted font-mono shrink-0">
        {{ loopCondition.CompletedIterations }}/{{ loopCondition.Iterations }}
      </span>
    </template>

    <template v-if="switchFilter && exposure && loopCondition" #editor>
      <!-- Filter -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchFilter.filter')
        }}</label>
        <select
          class="tns-select ml-auto w-36 md:w-40"
          :value="currentFilter"
          @change="saveFilter($event.target.value)"
        >
          <option
            v-if="currentFilter && !filterNames.includes(currentFilter)"
            :value="currentFilter"
          >
            {{ currentFilter }}
          </option>
          <option v-for="(name, i) in filterNames" :key="i" :value="name">
            {{ name }}
          </option>
        </select>
      </div>

      <!-- Iterations -->
      <NumberInputPicker
        :modelValue="loopIterations"
        :label="$t('components.sequence.items.takeManyExposures.iterations')"
        labelKey="se-iterations"
        :min="1"
        :max="9999"
        :step="1"
        :decimalPlaces="0"
        @change="saveLoop('Iterations', $event)"
      />

      <!-- Exposure Time -->
      <NumberInputPicker
        :modelValue="exposure.ExposureTime"
        :label="$t('components.sequence.items.takeExposure.exposureTime')"
        labelKey="se-exposureTime"
        :min="0"
        :max="3600"
        :step="0.1"
        :decimalPlaces="3"
        @change="saveExposure('ExposureTime', $event)"
      />

      <!-- Gain -->
      <GainInput
        :modelValue="exposure.Gain"
        labelKey="se-gain"
        :min="0"
        :max="1000"
        @change="saveExposure('Gain', $event)"
      />

      <!-- Offset -->
      <NumberInputPicker
        :modelValue="exposure.Offset"
        :label="$t('components.sequence.items.takeExposure.offset')"
        labelKey="se-offset"
        :min="-1"
        :max="1000"
        :step="1"
        @change="saveExposure('Offset', $event)"
      />

      <!-- Binning -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.binning')
        }}</label>
        <select
          class="tns-select ml-auto w-36 md:w-40"
          :value="binningValue"
          @change="saveExposure('Binning', $event.target.value)"
        >
          <option value='{"X":1,"Y":1}'>1x1</option>
          <option value='{"X":2,"Y":2}'>2x2</option>
          <option value='{"X":3,"Y":3}'>3x3</option>
          <option value='{"X":4,"Y":4}'>4x4</option>
        </select>
      </div>

      <!-- Image Type -->
      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.imageType')
        }}</label>
        <select
          class="tns-select ml-auto w-36 md:w-40"
          :value="exposure.ImageType"
          @change="saveExposure('ImageType', $event.target.value)"
        >
          <option value="LIGHT">LIGHT</option>
          <option value="DARK">DARK</option>
          <option value="FLAT">FLAT</option>
          <option value="BIAS">BIAS</option>
        </select>
      </div>

      <!-- Dither after exposures -->
      <NumberInputPicker
        v-if="ditherTrigger"
        :modelValue="ditherTrigger.AfterExposures"
        :label="$t('components.sequence.items.smartExposure.ditherAfter')"
        labelKey="se-ditherAfter"
        :min="0"
        :max="9999"
        :step="1"
        :decimalPlaces="0"
        @change="saveDither('AfterExposures', $event)"
      />
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import GainInput from '@/components/helpers/GainInput.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';
import { apiStore } from '@/store/store';
import { switchFilterName, switchFilterUpdate } from '@/utils/sequenceFilter';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = useSequenceV2Store();
const mainStore = apiStore();

const filterNames = computed(() => {
  const fw = switchFilter.value;
  if (fw?.FilterNames?.length) return fw.FilterNames;
  return mainStore.filterInfo?.AvailableFilters?.map((f) => f.Name) ?? [];
});

const switchFilter = computed(
  () => props.item.Items?.find((i) => i.FullTypeName?.includes('SwitchFilter')) ?? null
);
const exposure = computed(
  () => props.item.Items?.find((i) => i.FullTypeName?.includes('TakeExposure')) ?? null
);
const loopCondition = computed(
  () => props.item.Conditions?.find((c) => c.FullTypeName?.includes('LoopCondition')) ?? null
);
const ditherTrigger = computed(
  () => props.item.Triggers?.find((t) => t.FullTypeName?.includes('DitherAfterExposures')) ?? null
);

const loopIterations = computed(() => loopCondition.value?.Iterations ?? null);

const binningValue = computed(() => {
  const b = exposure.value?.Binning;
  if (!b) return '{"X":1,"Y":1}';
  if (typeof b === 'string') {
    const n = parseInt(b);
    return JSON.stringify({ X: n, Y: n });
  }
  return JSON.stringify({ X: b.X, Y: b.Y });
});

const currentFilter = computed(() => switchFilterName(switchFilter.value));

function saveFilter(name) {
  if (!switchFilter.value?.Id) return;
  const { property, value } = switchFilterUpdate(switchFilter.value, filterNames.value, name);
  store.setProperty(switchFilter.value.Id, property, value);
}

function saveExposure(key, value) {
  if (exposure.value?.Id) store.setProperty(exposure.value.Id, key, value);
}

function saveLoop(key, value) {
  if (loopCondition.value?.Id) store.setProperty(loopCondition.value.Id, key, value);
}

function saveDither(key, value) {
  if (ditherTrigger.value?.Id) store.setProperty(ditherTrigger.value.Id, key, value);
}
</script>
