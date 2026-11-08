<template>
  <ItemShell :item="item">
    <template #summary>
      <span v-if="currentFilter" class="text-xs text-content-muted shrink-0">{{
        currentFilter
      }}</span>
      <span v-if="loopCondition" class="text-xs text-content-faint"
        >{{ loopCondition.CompletedIterations }}/{{ loopCondition.Iterations }}</span
      >
    </template>

    <template #editor="{ save }">
      <!-- Iterations from inner loop condition -->
      <NumberInputPicker
        v-if="loopCondition"
        :modelValue="loopCondition.Iterations"
        :label="$t('components.sequence.items.autoBrightnessFlat.iterations')"
        labelKey="tfe-iterations"
        :min="1"
        :max="9999"
        :step="1"
        :decimalPlaces="0"
        @change="store.setProperty(loopCondition.Id, 'Iterations', $event)"
      />

      <!-- Filter from inner SwitchFilter -->
      <div v-if="switchFilter" class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.switchFilter.filter')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
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

      <!-- Binning from inner TakeExposure -->
      <div v-if="exposure" class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.takeExposure.binning')
        }}</label>
        <select
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="binningValue"
          @change="store.setProperty(exposure.Id, 'Binning', $event.target.value)"
        >
          <option value='{"X":1,"Y":1}'>1x1</option>
          <option value='{"X":2,"Y":2}'>2x2</option>
          <option value='{"X":3,"Y":3}'>3x3</option>
          <option value='{"X":4,"Y":4}'>4x4</option>
        </select>
      </div>

      <!-- Gain from inner TakeExposure -->
      <GainInput
        v-if="exposure"
        :modelValue="exposure.Gain"
        labelKey="tfe-gain"
        :min="-1"
        :max="1000"
        @change="store.setProperty(exposure.Id, 'Gain', $event)"
      />

      <!-- Offset from inner TakeExposure -->
      <NumberInputPicker
        v-if="exposure"
        :modelValue="exposure.Offset"
        :label="$t('components.sequence.items.takeExposure.offset')"
        labelKey="tfe-offset"
        :min="-1"
        :max="1000"
        :step="1"
        :decimalPlaces="0"
        @change="store.setProperty(exposure.Id, 'Offset', $event)"
      />

      <div class="seq-field-row">
        <label class="tns-label shrink-0">{{
          $t('components.sequence.items.autoBrightnessFlat.keepPanelClosed')
        }}</label>
        <div class="ml-auto">
          <ToggleButton
            :statusValue="item.KeepPanelClosed"
            @update:statusValue="save('KeepPanelClosed', $event)"
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
  () => props.item.Items?.find((i) => i.FullTypeName?.endsWith('SwitchFilter')) ?? null
);
const currentFilter = computed(() => switchFilterName(switchFilter.value));

function saveFilter(name) {
  const { property, value } = switchFilterUpdate(switchFilter.value, filterNames.value, name);
  store.setProperty(switchFilter.value.Id, property, value);
}

const innerContainer = computed(
  () => props.item.Items?.find((i) => i.FullTypeName?.endsWith('SequentialContainer')) ?? null
);

const loopCondition = computed(() => innerContainer.value?.Conditions?.[0] ?? null);
const exposure = computed(() => innerContainer.value?.Items?.[0] ?? null);

const binningValue = computed(() => {
  const b = exposure.value?.Binning;
  if (!b) return '{"X":1,"Y":1}';
  return JSON.stringify({ X: b.X, Y: b.Y });
});
</script>
