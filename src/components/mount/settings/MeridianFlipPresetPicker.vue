<template>
  <div class="flex flex-col gap-2">
    <h3 class="font-bold text-base text-content">
      {{ $t('components.mount.settings.meridian_flip.presets.question') }}
    </h3>
    <div role="radiogroup" class="flex flex-col gap-2">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        role="radio"
        :aria-checked="shownPreset === option.id"
        :disabled="isApplying"
        class="flex items-start gap-3 min-h-touch p-3 rounded-control border text-left transition-colors disabled:opacity-60"
        :class="
          shownPreset === option.id
            ? 'border-accent bg-accent/10'
            : 'border-line-strong bg-surface-2 hover:bg-surface-3'
        "
        @click="choose(option.id)"
      >
        <span
          class="mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center"
          :class="shownPreset === option.id ? 'border-accent' : 'border-content-faint'"
        >
          <span v-if="shownPreset === option.id" class="w-2.5 h-2.5 rounded-full bg-accent"></span>
        </span>
        <span class="flex flex-col gap-0.5">
          <span class="font-semibold text-content">
            {{ $t(`components.mount.settings.meridian_flip.presets.${option.id}.title`) }}
          </span>
          <span class="text-sm text-content-muted">
            {{ $t(`components.mount.settings.meridian_flip.presets.${option.id}.description`) }}
          </span>
        </span>
      </button>
    </div>
    <p v-if="sideOfPierHint" class="text-xs text-content-muted">{{ sideOfPierHint }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import apiService from '@/services/apiService';
import { useToastStore } from '@/store/toastStore';
import {
  CUSTOM_PRESET_ID,
  MERIDIAN_FLIP_PRESETS,
  isPierSideKnown,
  matchPreset,
  presetProfileChanges,
} from '@/utils/meridianFlipPresets';

const emit = defineEmits(['custom']);

const { t } = useI18n();
const store = apiStore();
const toastStore = useToastStore();

const options = [...MERIDIAN_FLIP_PRESETS.map((p) => ({ id: p.id })), { id: CUSTOM_PRESET_ID }];

const isApplying = ref(false);
// Shown while the writes are in flight and until the next profile poll confirms them.
const pendingPreset = ref(null);

const storedPreset = computed(() => matchPreset(store.profileInfo?.MeridianFlipSettings));
const shownPreset = computed(() => pendingPreset.value ?? storedPreset.value);

const sideOfPierHint = computed(() => {
  if (!store.mountInfo?.Connected) {
    return t('components.mount.settings.meridian_flip.presets.sideOfPierNoMount');
  }
  return isPierSideKnown(store.mountInfo.SideOfPier)
    ? ''
    : t('components.mount.settings.meridian_flip.presets.sideOfPierUnknown');
});

async function choose(presetId) {
  if (presetId === CUSTOM_PRESET_ID) {
    emit('custom');
    return;
  }

  isApplying.value = true;
  pendingPreset.value = presetId;
  try {
    for (const [key, value] of presetProfileChanges(presetId, store.mountInfo)) {
      const response = await apiService.profileChangeValue(key, value);
      if (!response?.Success) throw new Error(response?.Error || key);
    }
    await store.fetchProfilInfos();
  } catch (error) {
    console.error('Error applying meridian flip preset:', error);
    toastStore.showToast({
      type: 'error',
      title: t('components.mount.settings.meridian_flip_settings'),
      message: t('components.mount.settings.meridian_flip.presets.applyFailed'),
    });
  } finally {
    pendingPreset.value = null;
    isApplying.value = false;
  }
}
</script>
