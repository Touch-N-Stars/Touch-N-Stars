<template>
  <div v-if="store.focuserInfo.Connected" class="flex flex-col text-left">
    <div class="border border-gray-400/50 p-2 sm:p-3 rounded-md">
      <MoveFocuser />
      <div class="pt-1 sm:pt-2">
        <ButtonsFastChangePositon />
      </div>
      <div v-if="store.isPINS" class="pt-2">
        <setFocuserReverse />
      </div>
    </div>
    <div class="mt-2 sm:mt-4 flex gap-1 sm:gap-2 items-center">
      <button
        v-if="!store.focuserAfInfo.autofocus_running"
        class="tns-btn-primary"
        @click="startAutofocus"
      >
        {{ $t('components.focuser.start_autofocus') }}
      </button>
      <button
        v-else
        class="tns-btn-danger"
        @click="stoppAutofocus"
        :disabled="sequenceStore.sequenceRunning"
      >
        {{ $t('components.focuser.cancel_autofocus') }}
      </button>
      <button
        v-if="store.focuserAfInfo.autofocus_running"
        @click="showImageModal = true"
        class="p-2 bg-gray-700 border border-cyan-600 rounded-full shadow-md hover:bg-cyan-600 transition-colors"
        :title="$t('common.showImage')"
      >
        <PhotoIcon class="w-6 h-6" />
      </button>
    </div>

    <div class="flex items-center space-x-2 sm:space-x-3 mt-2 sm:mt-4">
      <div class="w-3 h-[1px] bg-gray-700"></div>
      <!-- kurze Linie -->
      <button
        @click="store.showAfGraph = !store.showAfGraph"
        class="w-7 h-7 bg-gray-700 active:bg-cyan-700 hover:bg-cyan-600 rounded-md border border-cyan-500/20 flex items-center justify-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 text-white transition-transform duration-300"
          :class="{ 'rotate-90': store.showAfGraph }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <p class="text-xs sm:text-sm italic">{{ $t('components.focuser.autofocus_graph') }}</p>
      <div class="grow h-[1px] bg-gray-700"></div>
      <!-- lange Linie -->
    </div>

    <div v-show="store.showAfGraph" class="mt-3 sm:mt-6">
      <!--AfStatus-->
      <div v-if="store.focuserAfInfo.autofocus_running || !delayShowGraph">
        <div>
          <AfShowGraph />
        </div>
        <div
          class="flex flex-col items-center mt-2 p-4 min-h-28 bg-gray-800/50 rounded-lg border border-gray-700/50"
        >
          <AfStatus />
        </div>
      </div>
      <div v-else-if="!store.focuserAfInfo.afError">
        <p class="mb-4 text-center">{{ $t('components.focuser.last_autofocus') }}</p>
        <div class="grow h-screen">
          <AfFnishGraph />
        </div>
      </div>
      <div v-else class="text-center text-red-600">
        <p>{{ $t('components.focuser.autofocus_error') }}</p>
        <p class="italic">{{ store.focuserAfInfo.afErrorText }}</p>
      </div>
    </div>
  </div>

  <!-- Image Modal -->
  <ImageModal
    :showModal="showImageModal"
    :imageData="imageStore.imageData"
    :isLoading="false"
    @close="showImageModal = false"
  />
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import apiService from '@/services/apiService';
import { useSequenceStore } from '@/store/sequenceStore';
import { useImagetStore } from '@/store/imageStore';
import AfFnishGraph from '@/components/focuser/AfFnishGraph.vue';
import { apiStore } from '@/store/store';
import { autofocusStartRefusal, toastBackendError } from '@/utils/backendErrors';
import AfStatus from '@/components/focuser/AfStatus.vue';
import AfShowGraph from '@/components/focuser/AfShowGraph.vue';
import ButtonsFastChangePositon from '@/components/focuser/ButtonsFastChangePositon.vue';
import MoveFocuser from '@/components/focuser/MoveFocuser.vue';
import ImageModal from '@/components/helpers/imageModal.vue';
import { PhotoIcon } from '@heroicons/vue/24/outline';
import setFocuserReverse from './settings/setFocuserReverse.vue';

const store = apiStore();
const imageStore = useImagetStore();
const sequenceStore = useSequenceStore();
const position = ref(0);
const delayShowGraph = ref(true);
const showImageModal = ref(false);

async function startAutofocus() {
  try {
    const response = await apiService.focuserAfAction('start');
    const refusal = autofocusStartRefusal(response);
    if (refusal !== null) {
      toastBackendError({ Error: refusal }, 'components.backendErrors.autofocusStart');
      return;
    }
    store.afTimestampLastStart = Date.now();
    store.afCurveData = [];
  } catch (error) {
    console.error('Error during autofocus', error);
  }
}

async function stoppAutofocus() {
  try {
    await apiService.focuserAfAction('stopp');
  } catch (error) {
    console.error('Error during autofocus', error);
  }
}

onMounted(() => {
  position.value = store.focuserInfo.Position || 100;
});

watch(
  () => store.focuserAfInfo.autofocus_running,
  (newVal, oldVal) => {
    console.log('Autofocus Running changed:', oldVal, '->', newVal);
    if (!newVal) {
      delayShowGraph.value = false;
      setTimeout(() => {
        delayShowGraph.value = true;
      }, 5000);
    }
  }
);
</script>
