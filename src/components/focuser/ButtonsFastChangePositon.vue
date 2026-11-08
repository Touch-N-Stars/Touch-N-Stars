<template>
  <div class="flex gap-1 focuser-buttons">
    <button class="tns-btn-secondary" @click="changeBigMinus" :disabled="isMoving">
      <Spinner v-if="loadingButton === 'changeBigMinus'" size="sm" class="text-accent" />
      <label v-else
        ><ChevronDoubleLeftIcon class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4"
      /></label>
    </button>
    <button class="tns-btn-secondary" @click="changeSmallMinus" :disabled="isMoving">
      <Spinner v-if="loadingButton === 'changeSmallMinus'" size="sm" class="text-accent" />
      <label v-else
        ><ChevronLeftIcon class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4"
      /></label>
    </button>
    <button class="tns-btn-secondary" @click="changeSmallPlus" :disabled="isMoving">
      <Spinner v-if="loadingButton === 'changeSmallPlus'" size="sm" class="text-accent" />
      <label v-else
        ><ChevronRightIcon class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4"
      /></label>
    </button>
    <button class="tns-btn-secondary" @click="changeBigPlus" :disabled="isMoving">
      <Spinner v-if="loadingButton === 'changeBigPlus'" size="sm" class="text-accent" />
      <label v-else
        ><ChevronDoubleRightIcon class="w-5 h-5 sm:w-7 sm:h-7 landscape:w-4 landscape:h-4"
      /></label>
    </button>
  </div>
</template>
<script setup>
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { computed, ref, watch } from 'vue';
import Spinner from '@/components/helpers/Spinner.vue';
import {
  ChevronRightIcon,
  ChevronLeftIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from '@heroicons/vue/24/outline';

const store = apiStore();
// Follows the profile so a newly applied AF step size takes effect without reopening the view.
const afStepsize = computed(() => store.profileInfo.FocuserSettings.AutoFocusStepSize);
const isMoving = ref(false);
const loadingButton = ref(null);
const timeoutId = ref(null); // ID für den Timeout

async function moveFocuser(newPosiont) {
  const currentPosition = store.focuserInfo.Position;
  newPosiont = Math.max(0, Math.round(newPosiont));
  try {
    console.log('Change focuser positon from', currentPosition, 'to', newPosiont);
    await apiService.moveFocuser(newPosiont);
    isMoving.value = true;

    if (timeoutId.value) clearTimeout(timeoutId.value);
    timeoutId.value = setTimeout(() => {
      console.warn('Timeout reached – resetting loading state');
      loadingButton.value = null;
      isMoving.value = false;
    }, 5000); //  5 Sekunden
  } catch (error) {
    console.error(`Error updating:`, error);
  }
}

async function changeBigMinus() {
  loadingButton.value = 'changeBigMinus';
  const currentPosition = store.focuserInfo.Position;
  let newPosiont = currentPosition - afStepsize.value * 5;
  moveFocuser(newPosiont);
}

async function changeSmallMinus() {
  loadingButton.value = 'changeSmallMinus';
  const currentPosition = store.focuserInfo.Position;
  let newPosiont = currentPosition - afStepsize.value / 2;
  moveFocuser(newPosiont);
}

async function changeBigPlus() {
  loadingButton.value = 'changeBigPlus';
  const currentPosition = store.focuserInfo.Position;
  let newPosiont = currentPosition + afStepsize.value * 5;
  moveFocuser(newPosiont);
}

async function changeSmallPlus() {
  loadingButton.value = 'changeSmallPlus';
  const currentPosition = store.focuserInfo.Position;
  let newPosiont = currentPosition + afStepsize.value / 2;
  moveFocuser(newPosiont);
}

watch(
  () => store.focuserInfo.IsMoving,
  (newVal) => {
    isMoving.value = newVal;
    if (newVal === false) {
      loadingButton.value = null;
    }
  }
);
</script>

<style scoped>
/* Landscape Anpassungen */
@media screen and (orientation: landscape) {
  .focuser-buttons {
    gap: 0.25rem;
  }

  .focuser-buttons button {
    min-width: 2rem;
    min-height: 2rem;
    padding: 0.25rem;
  }
}
</style>
