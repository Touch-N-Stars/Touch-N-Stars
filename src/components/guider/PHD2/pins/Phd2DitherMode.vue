<template>
  <div v-if="store.isPINS" class="flex flex-row w-full items-center min-w-28">
    <div class="flex items-center gap-1 mr-3">
      <label for="phd2-dither-mode" class="text-sm sm:text-xs mb-1 text-content">
        {{ $t('components.guider.phd2.ditherMode') }}
      </label>
      <InfoModal
        :title="$t('components.guider.phd2.ditherMode')"
        :message="$t('components.guider.phd2.help.ditherMode')"
        size="w-4 h-4"
      />
    </div>
    <select
      id="phd2-dither-mode"
      v-model="guiderStore.phd2DitherMode"
      @change="onChange"
      class="tns-select w-32 ml-auto"
      :disabled="guiderStore.phd2DitherModeLoading"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useGuiderStore } from '@/store/guiderStore';
import InfoModal from '@/components/helpers/infoModal.vue';
import { apiStore } from '@/store/store';

const { t } = useI18n();
const store = apiStore();
const guiderStore = useGuiderStore();

const options = computed(() => [
  { value: 'random', label: t('components.guider.phd2.ditherModeRandom') },
  { value: 'spiral', label: t('components.guider.phd2.ditherModeSpiral') },
]);

onMounted(async () => {
  await guiderStore.fetchPHD2DitherMode();
});

const onChange = async () => {
  try {
    await guiderStore.setPHD2DitherMode(guiderStore.phd2DitherMode);
  } catch (error) {
    console.error('Error changing PHD2 dither mode:', error);
    await guiderStore.fetchPHD2DitherMode();
  }
};
</script>
