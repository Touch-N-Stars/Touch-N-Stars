<template>
  <div v-if="store.isPINS" class="flex items-center justify-between w-full">
    <div class="flex items-center gap-1">
      <span class="text-sm font-medium text-content">{{ $t(labelKey) }}</span>
      <InfoModal v-if="helpKey" :title="$t(labelKey)" :message="$t(helpKey)" size="w-4 h-4" />
    </div>
    <toggleButton
      @click="toggle"
      :status-value="guiderStore[field]"
      :disabled="guiderStore[loadingFieldName]"
    />
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useGuiderStore } from '@/store/guiderStore';
import toggleButton from '@/components/helpers/toggleButton.vue';
import InfoModal from '@/components/helpers/infoModal.vue';
import { apiStore } from '@/store/store';

const props = defineProps({
  labelKey: {
    type: String,
    required: true,
  },
  helpKey: {
    type: String,
    default: '',
  },
  // guiderStore state key, e.g. 'phd2FastRecenter'
  field: {
    type: String,
    required: true,
  },
  // Overrides for stores that do not follow the
  // fetchPHD2X / setPHD2X / phd2XLoading naming convention (e.g. backlash)
  fetchAction: {
    type: String,
    default: '',
  },
  setAction: {
    type: String,
    default: '',
  },
  loadingField: {
    type: String,
    default: '',
  },
});

const store = apiStore();
const guiderStore = useGuiderStore();

// 'phd2FastRecenter' -> fetchPHD2FastRecenter / setPHD2FastRecenter / phd2FastRecenterLoading
const fieldSuffix = props.field.replace(/^phd2/, '');
const fetchActionName = props.fetchAction || `fetchPHD2${fieldSuffix}`;
const setActionName = props.setAction || `setPHD2${fieldSuffix}`;
const loadingFieldName = props.loadingField || `${props.field}Loading`;

onMounted(async () => {
  await guiderStore[fetchActionName]();
});

const toggle = async () => {
  const previousValue = guiderStore[props.field];
  const newValue = !previousValue;
  try {
    // Optimistic update
    guiderStore[props.field] = newValue;
    await guiderStore[setActionName](newValue);
  } catch (error) {
    console.error(`Error changing ${props.field}:`, error);
    // Revert on error
    guiderStore[props.field] = previousValue;
  }
};
</script>
