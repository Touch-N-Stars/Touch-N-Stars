<template>
  <!-- gap-2 keeps the destructive stop button away from the primary slew action -->
  <div class="flex gap-2">
    <button
      @click="slew"
      :disabled="
        framingStore.isSlewing ||
        framingStore.isSlewingAndCentering ||
        framingStore.isRotating ||
        props.disabled
      "
      class="tns-btn-primary px-5"
    >
      <span v-if="framingStore.isSlewing" class="loader mr-2"></span>
      <p v-if="label">{{ label }}</p>
      <p v-else>{{ $t('components.slewAndCenter.slew') }}</p>
    </button>
    <ButtonSlewStop v-if="store.mountIsSlewing" class="w-16" />
  </div>
</template>

<script setup>
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useI18n } from 'vue-i18n';
import { wait } from '@/utils/utils';
import ButtonSlewStop from '@/components/mount/ButtonSlewStop.vue';

const store = apiStore();
const framingStore = useFramingStore();
const { t } = useI18n();

const props = defineProps({
  raAngle: Number,
  decAngle: Number,
  label: String,
  disabled: Boolean,
  // Optional: resolves { ra, dec } at click time for time-dependent targets
  getCoordinates: Function,
});
const emit = defineEmits(['finished']);

async function unparkMount() {
  if (store.mountInfo.AtPark) {
    try {
      const response = await apiService.mountAction('unpark');
      if (!response.Success) return;
      await wait(2000);
      console.log(t('components.mount.control.unpark'));
    } catch (error) {
      console.log(t('components.mount.control.errors.unpark'));
    }
  }
}

async function slew() {
  await unparkMount(); // Überprüfen und Entparken, falls erforderlich
  const { ra, dec } = props.getCoordinates
    ? props.getCoordinates()
    : { ra: props.raAngle, dec: props.decAngle };
  await framingStore.slew(ra, dec);
  emit('finished'); // Emit Event nach Erfolg
}
</script>

<style scoped>
.loader {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
