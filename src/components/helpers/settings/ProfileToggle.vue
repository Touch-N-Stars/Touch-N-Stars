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
import { useProfileSetting } from '@/composables/useProfileSetting';
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

const { value: isEnabled, save } = useProfileSetting(() => props.settingKey, {
  fallback: false,
});

function updateSetting() {
  save(!isEnabled.value);
}
</script>
