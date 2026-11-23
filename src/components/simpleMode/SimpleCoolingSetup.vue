<template>
  <!-- One-time choice of how fast the camera cools down and warms up, per profile -->
  <div class="flex flex-col gap-2">
    <p class="text-sm font-semibold text-content">{{ $t(`${base}.question`) }}</p>
    <p class="text-xs text-content-muted">{{ $t(`${base}.text`) }}</p>
    <div role="radiogroup" class="flex flex-col gap-2">
      <button
        v-for="preset in COOLING_PRESETS"
        :key="preset.id"
        type="button"
        role="radio"
        :aria-checked="pending === preset.id"
        :disabled="pending !== null"
        class="flex items-start gap-3 min-h-touch p-3 rounded-control border text-left transition-colors disabled:opacity-60"
        :class="
          pending === preset.id
            ? 'border-accent bg-accent/10'
            : 'border-line-strong bg-surface-2 hover:bg-surface-3'
        "
        @click="choose(preset)"
      >
        <span
          class="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center"
          :class="pending === preset.id ? 'border-accent' : 'border-content-faint'"
        >
          <span v-if="pending === preset.id" class="w-2.5 h-2.5 rounded-full bg-accent"></span>
        </span>
        <span class="flex flex-col gap-0.5">
          <span class="font-semibold text-content">
            {{ $t(`${base}.presets.${preset.id}.title`) }}
          </span>
          <span class="text-sm text-content-muted">
            {{
              $t(`${base}.presets.${preset.id}.description`, {
                cool: preset.cool,
                warm: preset.warm,
              })
            }}
          </span>
        </span>
      </button>
    </div>
    <p class="text-xs text-content-muted">{{ $t(`${base}.notSure`) }}</p>

    <!-- Values set earlier (on the camera page or in NINA): keep them with one tap -->
    <div v-if="ownTiming" class="flex flex-col gap-2 rounded-control border border-line p-3">
      <p class="text-sm text-content">
        {{ $t(`${base}.currentValues`, { cool: coolMinutes, warm: warmMinutes }) }}
      </p>
      <button
        type="button"
        class="tns-btn-secondary"
        :disabled="pending !== null"
        @click="emit('chosen')"
      >
        {{ $t(`${base}.keepValues`) }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useToastStore } from '@/store/toastStore';
import { useProfileSetting } from '@/composables/useProfileSetting';
import { COOLING_PRESETS, hasOwnCoolingTiming } from '@/utils/coolingPresets';

const emit = defineEmits(['chosen']);

const base = 'components.simpleMode.steps.cool.setup';
const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();

const { value: coolMinutes, save: saveCool } = useProfileSetting('CameraSettings-CoolingDuration', {
  fallback: 0,
});
const { value: warmMinutes, save: saveWarm } = useProfileSetting('CameraSettings-WarmingDuration', {
  fallback: 0,
});

const ownTiming = computed(() => hasOwnCoolingTiming(store.profileInfo?.CameraSettings));

// The preset being written; also locks the choice so a second tap cannot interleave writes.
const pending = ref(null);

async function choose(preset) {
  if (pending.value !== null) return;
  pending.value = preset.id;
  try {
    const ok = (await saveCool(preset.cool)) && (await saveWarm(preset.warm));
    if (!ok) {
      toastStore.showToast({
        type: 'error',
        title: t(`${base}.question`),
        message: t(`${base}.applyFailed`),
      });
      return;
    }
    // The cool button reads the profile right after this, so it must not wait for the next poll.
    await store.fetchProfilInfos();
    emit('chosen');
  } finally {
    pending.value = null;
  }
}
</script>
