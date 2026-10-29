<template>
  <div class="flex flex-col gap-4">
    <SegmentTabs v-model="activeTab" :tabs="tabs" />

    <!-- General Settings Container -->
    <div v-if="activeTab === 'general'" class="tns-card flex flex-col gap-3">
      <setFocuserMaxStep />
    </div>

    <!-- AutoFocus Settings Container -->
    <div v-if="activeTab === 'autofocus'" class="flex flex-col gap-4">
      <!-- With Hocus Focus its essentials (assistant, sweep) replace NINA's sweep fields -->
      <HfSimpleSettings v-if="hfActive" @open-assistant="emit('open-assistant')" />
      <div class="tns-card flex flex-col gap-3">
        <setFocuserUseFilterOffset />
        <template v-if="!hfActive">
          <SettingInput
            labelKey="components.focuser.settings.AutoFocusExposureTime"
            settingKey="FocuserSettings-AutoFocusExposureTime"
            :modelValue="store.profileInfo.FocuserSettings.AutoFocusExposureTime"
            :max="9999"
          />
          <SettingInput
            labelKey="components.focuser.settings.AutoFocusInitialOffsetSteps"
            settingKey="FocuserSettings-AutoFocusInitialOffsetSteps"
            :modelValue="store.profileInfo.FocuserSettings.AutoFocusInitialOffsetSteps"
            :max="10"
          />
          <SettingInput
            labelKey="components.focuser.settings.AutoFocusStepSize"
            settingKey="FocuserSettings-AutoFocusStepSize"
            :modelValue="store.profileInfo.FocuserSettings.AutoFocusStepSize"
            :max="100000"
          />
        </template>
        <SettingInput
          labelKey="components.focuser.settings.FocuserSettleTime"
          settingKey="FocuserSettings-FocuserSettleTime"
          :modelValue="store.profileInfo.FocuserSettings.FocuserSettleTime"
          :max="1000"
        />
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusTotalNumberOfAttempts"
          settingKey="FocuserSettings-AutoFocusTotalNumberOfAttempts"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusTotalNumberOfAttempts"
          :max="50"
        />
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusNumberOfFramesPerPoint"
          settingKey="FocuserSettings-AutoFocusNumberOfFramesPerPoint"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusNumberOfFramesPerPoint"
          :max="50"
        />
      </div>
      <AutoFocusOptions v-if="hfActive" :sections="['storage']" />
    </div>

    <!-- Crop & Stars Container -->
    <div v-if="activeTab === 'crop_and_stars'" class="flex flex-col gap-4">
      <div class="tns-card flex flex-col gap-3">
        <!-- With Hocus Focus two engines share this tab: say which values belong to which -->
        <div v-if="hfActive" class="flex flex-col gap-1">
          <h3 class="text-base font-semibold text-content">
            {{ t('components.focuser.settings.cropCardTitle') }}
          </h3>
          <p class="text-sm text-content-muted">
            {{ t('components.focuser.settings.cropCardHf') }}
          </p>
        </div>
        <!-- HF drops the crop for every detection, its own autofocus included, while this is off -->
        <HfToggleRow
          v-if="hfActive && hfStore.starDetectionOptions"
          :model-value="hfStore.starDetectionOptions.UseAutoFocusCrop"
          :label="t('components.focuser.hocus.starDetection.useAutoFocusCrop')"
          :help="t('components.focuser.hocus.starDetection.help.useAutoFocusCrop')"
          :status="cropToggleStatus"
          :error="cropToggleError"
          @change="saveUseAutoFocusCrop"
        />
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusInnerCropRatio"
          settingKey="FocuserSettings-AutoFocusInnerCropRatio"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusInnerCropRatio"
          :min="0.2"
          :max="1"
          step="0.1"
        />
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusOuterCropRatio"
          settingKey="FocuserSettings-AutoFocusOuterCropRatio"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusOuterCropRatio"
          :min="0.2"
          :max="1"
          step="0.1"
        />
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusUseBrightestStars"
          settingKey="FocuserSettings-AutoFocusUseBrightestStars"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusUseBrightestStars"
          max="9999"
        />
      </div>
      <!-- Hocus Focus star detection: presets, optimizer and the advanced detection values -->
      <template v-if="hfActive">
        <div class="flex flex-col gap-1 px-1">
          <h3 class="text-base font-semibold text-content">
            {{ t('components.focuser.settings.starDetectionTitle') }}
          </h3>
          <p class="text-sm text-content-muted">
            {{ t('components.focuser.settings.starDetectionHf') }}
          </p>
        </div>
        <StarDetection :isTabActive="true" :omitKeys="['UseAutoFocusCrop']" />
      </template>
    </div>

    <!-- Backlash Container -->
    <div v-if="activeTab === 'backlash'" class="tns-card flex flex-col gap-3">
      <SettingInput
        labelKey="components.focuser.settings.BacklashIn"
        settingKey="FocuserSettings-BacklashIn"
        :modelValue="store.profileInfo.FocuserSettings.BacklashIn"
        max="9999"
      />
      <SettingInput
        labelKey="components.focuser.settings.BacklashOut"
        settingKey="FocuserSettings-BacklashOut"
        :modelValue="store.profileInfo.FocuserSettings.BacklashOut"
        max="9999"
      />
      <SettingSelect
        labelKey="components.focuser.settings.BacklashCompensationModel"
        settingKey="FocuserSettings-BacklashCompensationModel"
        :modelValue="store.profileInfo.FocuserSettings.BacklashCompensationModel"
        :options="['OVERSHOOT', 'ABSOLUTE']"
        translationPrefix="components.focuser.settings."
      />
    </div>

    <!-- Advanced Container -->
    <div v-if="activeTab === 'advanced'" class="flex flex-col gap-4">
      <div class="tns-card flex flex-col gap-3">
        <SettingInput
          labelKey="components.focuser.settings.AutoFocusBinning"
          settingKey="FocuserSettings-AutoFocusBinning"
          :modelValue="store.profileInfo.FocuserSettings.AutoFocusBinning"
          max="9"
        />
        <!-- Hocus Focus brings its own timeout, fit and rejection thresholds (below) -->
        <template v-if="!hfActive">
          <SettingInput
            labelKey="components.focuser.settings.AutoFocusTimeoutSeconds"
            settingKey="FocuserSettings-AutoFocusTimeoutSeconds"
            :modelValue="store.profileInfo.FocuserSettings.AutoFocusTimeoutSeconds"
            :max="9999"
          />
          <SettingInput
            labelKey="components.focuser.settings.RSquaredThreshold"
            settingKey="FocuserSettings-RSquaredThreshold"
            :modelValue="store.profileInfo.FocuserSettings.RSquaredThreshold"
            :min="0"
            :max="1"
            step="0.1"
          />
          <SettingSelect
            labelKey="components.focuser.settings.AutoFocusFitFunction"
            settingKey="FocuserSettings-AutoFocusCurveFitting"
            :modelValue="store.profileInfo.FocuserSettings.AutoFocusCurveFitting"
            :options="[
              'TRENDLINES',
              'PARABOLIC',
              'TRENDPARABOLIC',
              'HYPERBOLIC',
              'TRENDHYPERBOLIC',
            ]"
            translationPrefix="components.focuser.settings."
          />
        </template>
        <ProfileToggle
          class="rounded-control border border-line p-1"
          labelKey="components.focuser.settings.AutoFocusDisableGuiding"
          settingKey="FocuserSettings-AutoFocusDisableGuiding"
        />
      </div>
      <AutoFocusOptions
        v-if="hfActive"
        :sections="['basic', 'hfr', 'fit', 'outlier', 'reset']"
        collapseExpert
      />
    </div>
    <!-- Device specific settings container -->
    <div v-if="activeTab === 'deviceSpecific'" class="tns-card flex flex-col gap-3">
      <pinsSetMotorSpeedControl
        v-if="store.isPINS && focuserStore.focuserSettings?.HasMotorSpeedControl"
      />
      <template v-if="store.isPINS">
        <PinsSettingToggle
          v-for="setting in ['BeepOnMove', 'BeepOnStartup', 'StallDetection', 'Heating']"
          :key="setting"
          device="focuser"
          :settingName="setting"
          :labelKey="`components.focuser.settings.${setting}`"
        />
      </template>
      <pinsSetHeatingTemperature v-if="store.isPINS" />
      <pinsSetUSBCapacity v-if="store.isPINS" />
      <pinsSetFocuserAlias v-if="store.isPINS" />
      <pinsClearStall v-if="store.isPINS" />
      <pinsResetPosition v-if="store.isPINS" />
    </div>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import SettingInput from '@/components/helpers/settings/UpdatePorfileNumber.vue';
import SettingSelect from '@/components/helpers/settings/SettingProfilSelect.vue';
import ProfileToggle from '@/components/helpers/settings/ProfileToggle.vue';
import setFocuserUseFilterOffset from './settings/setFocuserUseFilterOffset.vue';
import setFocuserMaxStep from './settings/setFocuserMaxStep.vue';
import pinsSetMotorSpeedControl from './settingsPins/pinsSetMotorSpeedControl.vue';
import PinsSettingToggle from '@/components/helpers/settings/PinsSettingToggle.vue';
import pinsSetHeatingTemperature from './settingsPins/pinsSetHeatingTemperature.vue';
import pinsSetUSBCapacity from './settingsPins/pinsSetUSBCapacity.vue';
import pinsSetFocuserAlias from './settingsPins/pinsSetFocuserAlias.vue';
import pinsClearStall from './settingsPins/pinsClearStall.vue';
import pinsResetPosition from './settingsPins/pinsResetPosition.vue';
import SegmentTabs from '@/components/helpers/SegmentTabs.vue';
import HfSimpleSettings from './hocus/HfSimpleSettings.vue';
import AutoFocusOptions from './hocus/AutoFocusOptions.vue';
import StarDetection from './hocus/StarDetection.vue';
import HfToggleRow from './hocus/fields/HfToggleRow.vue';
import { useFocuserStore } from '@/store/focuserStore';
import { useHocusFocusStore } from '@/store/hocusFocusStore';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

const emit = defineEmits(['open-assistant']);

const { t } = useI18n();
const store = apiStore();
const focuserStore = useFocuserStore();
const hfStore = useHocusFocusStore();

// Hocus Focus is the autofocus on PINS: its fields take the place of the NINA values it
// duplicates or replaces. Feature-detected rather than isPINS, so a PINS without the HF routes
// keeps the NINA fields; while the probe is pending (null) the NINA fields stay.
const hfActive = computed(() => hfStore.available === true);

// Hocus Focus' "Use AutoFocus Crop" lives next to the NINA crop values it switches on and off
const cropToggleStatus = ref('');
const cropToggleError = ref('');

async function saveUseAutoFocusCrop(value) {
  cropToggleStatus.value = 'saving';
  cropToggleError.value = '';
  try {
    await hfStore.setStarDetectionOption('UseAutoFocusCrop', value);
    cropToggleStatus.value = 'saved';
    setTimeout(() => (cropToggleStatus.value = ''), 1000);
  } catch (err) {
    console.error('[FocusSettingsPanel] Error saving UseAutoFocusCrop:', err);
    cropToggleStatus.value = 'error';
    cropToggleError.value = err.response?.data?.error || err.message || '';
  }
}

// focuserSettings survives a disconnect, so the connection decides whether they are current
const hasDeviceSettings = computed(
  () => store.focuserInfo.Connected && focuserStore.focuserSettings != null
);

const tabs = computed(() =>
  [
    // General holds only the max step, which hides itself on focusers that cannot set it
    ...(store.isPINS && store.focuserInfo.CanSetMaxStep ? ['general'] : []),
    'autofocus',
    'crop_and_stars',
    'backlash',
    'advanced',
    ...(store.isPINS && hasDeviceSettings.value ? ['deviceSpecific'] : []),
  ].map((value) => ({ value, label: t(`components.focuser.settings.${value}`) }))
);
// With Hocus Focus the autofocus tab holds the setup assistant, the recommended start
const activeTab = ref(hfActive.value ? 'autofocus' : tabs.value[0].value);

// A tab can vanish (PINS check resolves, device settings go away): fall back to the first one
// instead of showing nothing.
watch(tabs, (list) => {
  if (!list.some((tab) => tab.value === activeTab.value)) activeTab.value = list[0].value;
});
// Open the autofocus tab once the async HF probe turns Hocus Focus on.
watch(hfActive, (active) => {
  if (active) activeTab.value = 'autofocus';
});
</script>
