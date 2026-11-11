<template>
  <div v-if="isPHD2Selected" class="flex flex-col border border-line-strong p-1 md:p-2 rounded-lg">
    <!-- PHD2 Path -->
    <div class="flex flex-row items-center justify-between w-full">
      <label for="phd2Path" class="text-xs md:text-sm text-content">
        {{ $t('components.guider.phd2Path') }}
      </label>
      <input
        id="phd2Path"
        v-model="phd2Path"
        @change="setPhd2Path"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="statusClassPhd2Path"
        placeholder="/path/to/phd2"
      />
    </div>

    <!-- PHD2 Server Hostname -->
    <div class="flex flex-row items-center justify-between w-full mt-2 md:mt-3">
      <label for="phd2ServerHost" class="text-xs md:text-sm text-content mr-2">
        {{ $t('components.guider.phd2ServerHost') }}
      </label>
      <input
        id="phd2ServerHost"
        v-model="phd2ServerHost"
        @change="setPhd2ServerHost"
        type="text"
        class="tns-input text-xs md:text-sm w-48"
        :class="statusClassPhd2ServerHost"
        placeholder="localhost"
      />
    </div>

    <!-- PHD2 Server Port -->
    <div class="mt-2 md:mt-3">
      <NumberInputPicker
        v-model="phd2ServerPort"
        :label="$t('components.guider.phd2ServerPort')"
        labelKey="components.guider.phd2ServerPort"
        :min="1"
        :max="65535"
        :step="1"
        :decimalPlaces="0"
        placeholder="4400"
        inputId="phd2ServerPort"
        wrapperClass="w-full"
        @change="setPhd2ServerPort"
      />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const props = defineProps({
  selectedGuiderDevice: { type: String, default: '' },
});

const isPHD2Selected = computed(() => {
  return props.selectedGuiderDevice === 'PHD2' || props.selectedGuiderDevice === 'PHD2_Single';
});

const {
  value: phd2Path,
  save: setPhd2Path,
  glowClass: statusClassPhd2Path,
} = useProfileSetting('GuiderSettings-PHD2Path', { fallback: '' });
const {
  value: phd2ServerHost,
  save: setPhd2ServerHost,
  glowClass: statusClassPhd2ServerHost,
} = useProfileSetting('GuiderSettings-PHD2ServerUrl', { fallback: 'localhost' });
const { value: phd2ServerPort, save: setPhd2ServerPort } = useProfileSetting(
  'GuiderSettings-PHD2ServerPort',
  { fallback: 4400 }
);
</script>
