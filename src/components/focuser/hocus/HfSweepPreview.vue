<template>
  <p
    v-if="range"
    class="text-sm"
    :class="range.outOfRange ? 'text-status-warn' : 'text-content-muted'"
  >
    {{ L('line', { from: range.from, to: range.to, half: range.half }) }}
    <template v-if="range.outOfRange"> {{ L('outOfRange') }}</template>
  </p>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { sweepRange } from '@/utils/hocusFocusAdvisor';

// One line that says where an autofocus run will move the focuser, so a wrong step size or
// points-per-side value shows before the run instead of during it.
const props = defineProps({
  stepSize: { type: Number, default: null },
  offsetSteps: { type: Number, default: null },
});

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfSweep.${key}`, params || {});
const store = apiStore();

const range = computed(() => {
  const focuser = store.profileInfo?.FocuserSettings || {};
  return sweepRange(
    store.focuserInfo?.Position,
    props.stepSize ?? focuser.AutoFocusStepSize,
    props.offsetSteps ?? focuser.AutoFocusInitialOffsetSteps,
    store.focuserInfo?.MaxStep
  );
});
</script>
