<template>
  <div v-for="issue in shown" :key="issue" class="flex flex-col gap-2">
    <p class="flex items-start gap-2 text-sm text-status-warn">
      <span class="tns-dot bg-status-warn mt-1.5 shrink-0"></span>
      <span>{{ L(`issues.${issue}`) }}</span>
    </p>
    <template v-if="ISSUE_FIXES[issue]">
      <button
        class="tns-btn-secondary min-h-touch"
        :disabled="state[issue] === 'busy'"
        @click="apply(issue)"
      >
        {{ fixLabel(ISSUE_FIXES[issue]) }}
      </button>
      <p v-if="state[issue] === 'error'" class="text-xs text-status-danger">
        {{ $t('components.focuser.hfAdvice.applyFailed') }}
      </p>
    </template>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { checkPrerequisites, fixLabelKey, ISSUE_FIXES } from '@/utils/hocusFocusAdvisor';

// Setup problems visible before any run, each with its one-tap fix where there is an obvious
// value. `only` limits the list to the given issue ids.
const props = defineProps({
  only: { type: Array, default: null },
});

const { t } = useI18n();
const L = (key, params) => t(`components.focuser.hfSimple.${key}`, params || {});
const store = apiStore();
const hfStore = useHocusFocusStore();

const shown = computed(() => {
  const issues = checkPrerequisites(
    store.profileInfo,
    hfStore.starDetectionOptions,
    store.focuserInfo
  );
  return props.only ? issues.filter((i) => props.only.includes(i)) : issues;
});

// The issue disappears once the profile poll shows the new value, so only busy/error is kept.
const state = ref({});

function fixLabel(fix) {
  return t(`components.focuser.hfAdvice.fix.${fixLabelKey(fix)}`, { value: fix.value });
}

async function apply(issue) {
  state.value = { ...state.value, [issue]: 'busy' };
  try {
    await hfStore.applyFix(ISSUE_FIXES[issue]);
    state.value = { ...state.value, [issue]: '' };
  } catch (err) {
    console.error('[HfSetupIssues] Error applying fix:', err);
    state.value = { ...state.value, [issue]: 'error' };
  }
}
</script>
