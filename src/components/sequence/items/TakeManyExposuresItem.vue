<template>
  <ItemShell :item="item">
    <template #summary>
      <template v-if="exposure">
        <span class="text-xs text-content-muted font-mono">{{ exposure.ExposureTime }}s</span>
        <span class="text-xs text-content-faint">G{{ exposure.Gain }}</span>
        <span class="text-xs text-content-faint">{{ exposure.ImageType }}</span>
      </template>
      <span v-if="loopIterations" class="text-xs text-content-muted font-mono">
        {{ completedIterations }} / {{ loopIterations }}
      </span>
    </template>

    <template v-if="exposure && loopCondition" #editor>
      <NumberInputPicker
        :modelValue="loopIterations"
        :label="$t('components.sequence.items.takeManyExposures.iterations')"
        labelKey="tme-iterations"
        :min="1"
        :max="9999"
        :step="1"
        :decimalPlaces="0"
        @change="saveLoop('Iterations', $event)"
      />
      <NumberInputPicker
        :modelValue="exposure.ExposureTime"
        :label="$t('components.sequence.items.takeExposure.exposureTime')"
        labelKey="tme-exposureTime"
        :min="0"
        :max="3600"
        :step="0.1"
        :decimalPlaces="3"
        @change="saveExposure('ExposureTime', $event)"
      />
      <GainInput
        :modelValue="exposure.Gain"
        labelKey="tme-gain"
        :min="0"
        :max="1000"
        @change="saveExposure('Gain', $event)"
      />
      <NumberInputPicker
        :modelValue="exposure.Offset"
        :label="$t('components.sequence.items.takeExposure.offset')"
        labelKey="tme-offset"
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
          class="tns-select-compact ml-auto w-36 md:w-40"
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
          class="tns-select-compact ml-auto w-36 md:w-40"
          :value="exposure.ImageType"
          @change="saveExposure('ImageType', $event.target.value)"
        >
          <option value="LIGHT">LIGHT</option>
          <option value="DARK">DARK</option>
          <option value="FLAT">FLAT</option>
          <option value="BIAS">BIAS</option>
        </select>
      </div>
    </template>
  </ItemShell>
</template>

<script setup>
import { computed } from 'vue';
import ItemShell from './ItemShell.vue';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import GainInput from '@/components/helpers/GainInput.vue';
import { useSequenceV2Store } from '@/store/sequenceV2Store';

const props = defineProps({
  item: { type: Object, required: true },
});

const store = useSequenceV2Store();

const exposure = computed(() => props.item.Items?.[0] ?? null);
const loopCondition = computed(() => props.item.Conditions?.[0] ?? null);
const loopIterations = computed(() => loopCondition.value?.Iterations ?? null);
const completedIterations = computed(() => loopCondition.value?.CompletedIterations ?? 0);

const binningValue = computed(() => {
  const b = exposure.value?.Binning;
  if (!b) return '{"X":1,"Y":1}';
  return JSON.stringify({ X: b.X, Y: b.Y });
});

function saveExposure(key, value) {
  if (exposure.value?.Id) {
    store.setProperty(exposure.value.Id, key, value);
  }
}

function saveLoop(key, value) {
  if (loopCondition.value?.Id) {
    store.setProperty(loopCondition.value.Id, key, value);
  }
}
</script>
