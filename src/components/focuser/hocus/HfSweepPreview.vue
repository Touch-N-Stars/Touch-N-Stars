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
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { sweepRange } from '@/utils/hocusFocusAdvisor';

// One line that says where an autofocus run will move the focuser, so a wrong step size or
// points-per-side value shows before the run instead of during it.
const props = defineProps({
  stepSize: { type: Number, default: null },
  offsetSteps: { type: Number, default: null },
  // True while a measurement or a run moves the focuser: the range then stays centred on the
  // position it started from instead of following every move (both ends kept changing).
  frozen: { type: Boolean, default: false },
});

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfSweep.${key}`, params || {});
const store = apiStore();

const frozenPosition = ref(null);
watch(
  () => props.frozen,
  (frozen) => {
    frozenPosition.value = frozen ? (store.focuserInfo?.Position ?? null) : null;
  },
  { immediate: true }
);

const range = computed(() => {
  const focuser = store.profileInfo?.FocuserSettings || {};
  return sweepRange(
    frozenPosition.value ?? store.focuserInfo?.Position,
    props.stepSize ?? focuser.AutoFocusStepSize,
    props.offsetSteps ?? focuser.AutoFocusInitialOffsetSteps,
    store.focuserInfo?.MaxStep
  );
});
</script>
