<template>
  <div
    v-if="focuserStore.focuserSettings?.FocuserAlias !== undefined"
    class="flex items-center w-full justify-between border border-line-strong p-1 md:p-2 rounded-control"
  >
    <label for="setFocuserAlias" class="text-xs md:text-sm text-content font-medium">
      {{ $t('components.focuser.settings.FocuserAlias') }}
    </label>
    <input
      id="setFocuserAlias"
      v-model="alias"
      type="text"
      class="tns-input w-28 md:w-36"
      @blur="setAlias"
      @keyup.enter="setAlias"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch } from 'vue';
import apiService from '@/services/apiService';
import { useFocuserStore } from '@/store/focuserStore';

const focuserStore = useFocuserStore();
const alias = ref('');

onMounted(() => {
  alias.value = focuserStore.focuserSettings?.FocuserAlias ?? '';
});

watch(
  () => focuserStore.focuserSettings?.FocuserAlias,
  (val) => {
    if (val !== undefined) alias.value = val;
  }
);

async function setAlias() {
  try {
    await apiService.focusAction(
      `set-setting?settingName=FocuserAlias&newValue=${encodeURIComponent(alias.value)}`
    );
  } catch (error) {
    console.log('[pinsSetFocuserAlias] Error:', error);
  }
}
</script>
