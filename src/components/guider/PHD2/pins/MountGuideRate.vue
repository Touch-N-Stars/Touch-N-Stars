<template>
  <div
    v-if="store.isPINS && guiderStore.mountGuideRateRA !== null"
    class="flex flex-col gap-2 w-full"
  >
    <div :class="{ 'pointer-events-none opacity-50': !guiderStore.mountCanSetGuideRate }">
      <NumberInputPicker
        v-model="localGuideRate"
        :label="$t('components.guider.phd2.guideRate')"
        :label-key="'components.guider.phd2.guideRate'"
        :min="0.1"
        :max="1.0"
        :step="0.05"
        :decimal-places="2"
        input-id="mount-guide-rate"
        @change="onGuideRateChange"
      />
    </div>
    <p v-if="!guiderStore.mountCanSetGuideRate" class="text-xs text-content-muted italic">
      {{ $t('components.guider.phd2.guideRateReadOnly') }}
    </p>
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { apiStore } from '@/store/store';

const store = apiStore();
const guiderStore = useGuiderStore();

const localGuideRate = ref(guiderStore.mountGuideRateRA);

// Lokalen Wert mit dem Store synchron halten (z.B. nach fetchMountGuideRate)
watch(
  () => guiderStore.mountGuideRateRA,
  (newVal) => {
    localGuideRate.value = newVal;
  }
);

onMounted(async () => {
  await guiderStore.fetchMountGuideRate();
});

const onGuideRateChange = async (newValue) => {
  const previousRA = guiderStore.mountGuideRateRA;
  const previousDec = guiderStore.mountGuideRateDec;
  try {
    await guiderStore.setMountGuideRate(newValue, newValue);
    // Store erst nach erfolgreicher API-Antwort aktualisieren
    guiderStore.mountGuideRateRA = newValue;
    guiderStore.mountGuideRateDec = newValue;
  } catch {
    // Bei Fehler lokalen Input auf den Originalwert zurücksetzen
    localGuideRate.value = previousRA;
    guiderStore.mountGuideRateRA = previousRA;
    guiderStore.mountGuideRateDec = previousDec;
  }
};
</script>
