<template>
  <div v-if="store.isPINS" class="flex flex-row w-full items-center min-w-28">
    <div class="flex items-center gap-1 mr-3">
      <label for="phd2-auto-select-downsample" class="text-sm sm:text-xs mb-1 text-content">
        {{ $t('components.guider.phd2.autoSelectDownsample') }}
      </label>
      <InfoModal
        :title="$t('components.guider.phd2.autoSelectDownsample')"
        :message="$t('components.guider.phd2.help.autoSelectDownsample')"
        size="w-4 h-4"
      />
    </div>
    <select
      id="phd2-auto-select-downsample"
      v-model="guiderStore.phd2AutoSelectDownsample"
      @change="onChange"
      class="tns-select w-32 ml-auto"
      :disabled="guiderStore.phd2AutoSelectDownsampleLoading"
    >
      <option v-for="option in options" :key="option" :value="option">
        {{ option }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';
import { apiStore } from '@/store/store';
import InfoModal from '@/components/helpers/infoModal.vue';

const store = apiStore();
const guiderStore = useGuiderStore();

const options = ['Auto', '1', '2', '3'];

onMounted(async () => {
  await guiderStore.fetchPHD2AutoSelectDownsample();
});

const onChange = async () => {
  try {
    await guiderStore.setPHD2AutoSelectDownsample(guiderStore.phd2AutoSelectDownsample);
  } catch (error) {
    console.error('Error changing PHD2 auto-select downsample:', error);
    await guiderStore.fetchPHD2AutoSelectDownsample();
  }
};
</script>
