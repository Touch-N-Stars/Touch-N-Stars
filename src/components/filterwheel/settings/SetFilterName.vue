<template>
  <div class="flex flex-row w-full items-center">
    <label class="text-sm text-content mr-10 whitespace-nowrap">
      {{ $t('components.filterwheel.settings.FilterWheelFilters.Name') }}
    </label>
    <input
      v-model="value"
      type="text"
      class="tns-input w-full"
      @input="sanitizeName"
      @change="updateSetting"
    />
  </div>
</template>

<script setup>
import { useProfileSetting } from '@/composables/useProfileSetting';

const props = defineProps({
  modelValue: {
    type: String,
    required: true,
  },
  settingKey: {
    type: String,
    required: true,
  },
});

// The caller passes the name from its filter entry; the input follows it until edited.
const { value, save } = useProfileSetting(() => props.settingKey, {
  source: () => props.modelValue,
});

// Allow harmless separators (dash, underscore, space) in filter names such as
// "Ha 3nm" or "L-eXtreme"; everything else is stripped while typing.
function sanitizeName(event) {
  value.value = event.target.value.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '');
}

function updateSetting() {
  save(value.value.trim());
}
</script>
