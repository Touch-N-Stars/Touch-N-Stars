<template>
  <div class="flex items-center" :class="spread ? 'justify-between' : ''">
    <div class="flex items-center gap-1" :class="spread ? '' : 'mr-2'">
      <span :class="labelClass">{{ $t(labelKey) }}</span>
      <InfoModal v-if="helpKey" :title="$t(labelKey)" :message="$t(helpKey)" size="w-4 h-4" />
    </div>
    <toggleButton @click="updateSetting" :status-value="isEnabled" :class="toggleClass" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  // NINA profile setting key, e.g. 'TelescopeSettings-PrimaryReversed'.
  // Also describes the path inside store.profileInfo (split by '-').
  settingKey: {
    type: String,
    required: true,
  },
  helpKey: {
    type: String,
    default: '',
  },
  // true: toggle is right-aligned (justify-between), false: toggle sits next to the label
  spread: {
    type: Boolean,
    default: true,
  },
  labelClass: {
    type: String,
    default: 'text-sm font-medium text-content',
  },
  toggleClass: {
    type: String,
    default: '',
  },
});

const store = apiStore();
const isEnabled = ref(false);
const isWriting = ref(false);

const profileValue = computed(
  () => props.settingKey.split('-').reduce((obj, key) => obj?.[key], store.profileInfo) ?? false
);

async function updateSetting() {
  isEnabled.value = !isEnabled.value;
  isWriting.value = true;
  try {
    const response = await apiService.profileChangeValue(props.settingKey, isEnabled.value);
    if (!response.Success) {
      // Revert on error
      isEnabled.value = !isEnabled.value;
    }
  } catch (error) {
    console.error(`Error saving setting ${props.settingKey}:`, error);
    // Revert on error
    isEnabled.value = !isEnabled.value;
  } finally {
    isWriting.value = false;
  }
}

onMounted(() => {
  isEnabled.value = profileValue.value;
});

// Follow the profile when something else writes the setting (a preset, another client).
// Skipped while our own write is in flight so a stale poll does not flip the toggle back.
watch(profileValue, (v) => {
  if (isWriting.value) return;
  isEnabled.value = v;
});
</script>
