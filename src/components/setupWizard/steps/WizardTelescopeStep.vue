<template>
  <div class="flex flex-col gap-4">
    <div>
      <h2 class="text-xl font-semibold text-content">
        {{ t('components.setupWizard.telescope.title') }}
      </h2>
      <p class="text-sm text-content-muted mt-1">
        {{ t('components.setupWizard.telescope.description') }}
      </p>
    </div>

    <label class="flex flex-col gap-1">
      <span class="text-xs font-semibold uppercase text-content-muted">
        {{ t('components.settings.telescope.name') }}
      </span>
      <input
        v-model="telescopeName"
        type="text"
        class="tns-input"
        :class="nameStatusClass"
        :placeholder="t('components.setupWizard.telescope.namePlaceholder')"
        @change="updateTelescopeName"
      />
    </label>

    <NumberInputPicker
      v-model="focalLength"
      :label="t('components.camera.chip_settings.focal_length')"
      labelKey="components.camera.chip_settings.focal_length"
      :min="10"
      :max="5000"
      :step="1"
      :decimalPlaces="0"
      inputId="wizard-focal-length"
      @change="updateFocalLength"
    />

    <NumberInputPicker
      v-model="focalRatio"
      :label="t('components.settings.telescope.focal_ratio')"
      labelKey="components.settings.telescope.focal_ratio"
      :min="1"
      :max="50"
      :step="0.1"
      :decimalPlaces="1"
      inputId="wizard-focal-ratio"
      @change="updateFocalRatio"
    />

    <p class="text-xs text-content-faint">
      {{ t('components.setupWizard.telescope.hint') }}
    </p>

    <p v-if="errorMessage" class="text-sm text-status-danger break-words">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useProfileSetting } from '@/composables/useProfileSetting';
import NumberInputPicker from '@/components/helpers/NumberInputPicker.vue';

const { t } = useI18n();
const store = apiStore();

const FOCAL_LENGTH_FALLBACK = 500;
const FOCAL_RATIO_FALLBACK = 5.0;

// Same settings as settingsTelescope.vue: each field follows the profile until it is saved,
// so values that arrive with a late poll still show up.
const positiveOr = (fallback) => (v) => (Number(v) > 0 ? Number(v) : fallback);

const telescope = useProfileSetting('TelescopeSettings-Name', { fallback: '' });
const focal = useProfileSetting('TelescopeSettings-FocalLength', {
  fallback: FOCAL_LENGTH_FALLBACK,
  fromProfile: positiveOr(FOCAL_LENGTH_FALLBACK),
});
const ratio = useProfileSetting('TelescopeSettings-FocalRatio', {
  fallback: FOCAL_RATIO_FALLBACK,
  fromProfile: positiveOr(FOCAL_RATIO_FALLBACK),
});
const { value: telescopeName, glowClass: nameStatusClass } = telescope;
const { value: focalLength } = focal;
const { value: focalRatio } = ratio;

const errorMessage = ref('');

async function write(setting) {
  errorMessage.value = '';
  if (!(await setting.save())) {
    errorMessage.value = t('components.setupWizard.telescope.saveFailed', {
      message: setting.error.value,
    });
  }
}

const updateTelescopeName = () => write(telescope);
const updateFocalLength = () => write(focal);
const updateFocalRatio = () => write(ratio);

// The fields show 500 mm and f/5 while the profile has no value, but only a change saved them.
// Leaving them as shown left the profile without a focal length - plate solving, the dither
// calculator and the summary then reported it missing although the user saw a value. Leaving
// the step (Next, Back, close) saves what is shown wherever the profile still has nothing.
const hasValue = (key) => Number(store.profileInfo?.TelescopeSettings?.[key]) > 0;
onBeforeUnmount(async () => {
  // An unread profile is not an empty one: never overwrite values that were not loaded yet.
  if (!store.profileInfo?.TelescopeSettings) return;
  const pending = [];
  if (!hasValue('FocalLength') && !focal.saving.value) pending.push(focal.save());
  if (!hasValue('FocalRatio') && !ratio.saving.value) pending.push(ratio.save());
  if (!pending.length) return;
  await Promise.all(pending);
  // The next step may already have read the profile before these writes landed.
  await store.fetchProfilInfos();
});
</script>
