<template>
  <div class="container w-full flex flex-col items-center justify-center">
    <div class="flex space-x-3 items-center w-full gap-2">
      <NumberInputPicker
        v-model="position"
        :label="$t('components.focuser.new_position')"
        labelKey="components.focuser.new_position"
        :min="0"
        :max="999999"
        :step="1"
        :decimalPlaces="0"
        placeholder="1"
        inputId="focuser-position"
        wrapperClass="flex-1"
      />
      <button
        :class="
          store.focuserInfo.IsMoving
            ? 'tns-btn-danger w-auto shrink-0 whitespace-nowrap'
            : 'tns-btn-primary w-auto shrink-0 whitespace-nowrap'
        "
        @click="store.focuserInfo.IsMoving ? stopFocuser() : moveFocuser()"
      >
        <StopIcon v-if="store.focuserInfo.IsMoving" class="h-5 w-5 text-white" />
        <span v-else>{{ $t('components.focuser.move') }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { StopIcon } from '@heroicons/vue/24/outline';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';
import { useHaptics } from '@/composables/useHaptics';
const { tapLight, tapMedium } = useHaptics();

const store = apiStore();
const position = ref(0);
const loading = ref(false);

async function moveFocuser() {
  tapLight();
  try {
    loading.value = true;
    await apiService.moveFocuser(position.value);
  } catch (error) {
    console.error('Error moving focuser:', error);
  } finally {
    loading.value = false;
  }
}

async function stopFocuser() {
  tapMedium();
  try {
    await apiService.focusAction('stop-move');
    console.log('Focuser stopped');
  } catch (error) {
    console.error('Error stopping focuser:', error);
  }
}

onMounted(() => {
  position.value = store.focuserInfo.Position || 100;
});
watch(
  () => store.focuserInfo.Position,
  (newPosition) => {
    if (newPosition !== position.value) {
      position.value = newPosition;
    }
  }
);
</script>

<style scoped></style>
