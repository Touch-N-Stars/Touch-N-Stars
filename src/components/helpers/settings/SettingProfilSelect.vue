<template>
  <div class="flex flex-col w-full border border-line-strong p-1 rounded-lg">
    <label class="text-sm sm:text-xs mb-2 text-content">{{ $t(`${labelKey}`) }}</label>
    <select
      v-model="value"
      @change="updateSetting"
      :class="[statusClass]"
      class="tns-select w-full py-2"
    >
      <option value="">{{ $t('common.select') }}</option>
      <option v-for="option in options" :key="option" :value="option">
        {{ $t(translationPrefix + option) }}
      </option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProfileSetting } from '@/composables/useProfileSetting';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  settingKey: {
    type: String,
    required: true,
  },
  modelValue: {
    type: String,
    required: true,
  },
  options: {
    type: Array,
    required: true,
  },
  translationPrefix: {
    type: String,
    required: true,
  },
});

const { value, save, status } = useProfileSetting(() => props.settingKey, {
  source: () => props.modelValue,
});

const statusClass = computed(
  () => ({ saved: 'glow-green', error: 'glow-red' })[status.value] ?? ''
);

function updateSetting() {
  save();
}
</script>
