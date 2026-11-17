import { defineConfig, globalIgnores } from 'eslint/config';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.cache/**',
    '**/dist/**',
    '**/public/**',
    '**/.github/**',
    '**/android/**',
    '**/Logo/**',
    '**/resources/**',
    '**/scripts/**',
  ]),

  {
    files: ['**/*.vue', '**/*.js'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: 'espree',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
      },
    },
    plugins: {
      vue,
    },
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-alert': 'error',
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          caughtErrors: 'none', // <- HIER
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'apiService',
          property: 'profileChangeValue',
          message:
            'Use useProfileSetting (src/composables/useProfileSetting.js) for profile values. Direct writes are reserved for the exceptions listed in eslint.config.js.',
        },
      ],
    },
  },

  // Deliberate exceptions to the useProfileSetting rule. Adding a file here should be a
  // visible decision in review, so every group states why the helper does not fit.
  {
    files: [
      // The helper itself and its tests.
      'src/composables/useProfileSetting.js',
      '**/__tests__/**',

      // The value goes to the connected device first, the profile write follows it.
      'src/components/camera/setBinning.vue',
      'src/components/camera/setCameraUsbLimit.vue',
      'src/components/camera/setReadoutMode.vue',
      'src/components/camera/settingsPins/pinsSetCameraUsbLimit.vue',
      'src/components/camera/settingsPins/pinsSetFanSpeed.vue',
      'src/components/camera/settingsPins/pinsSetReadoutMode.vue',
      'src/components/focuser/settings/setFocuserReverse.vue',
      'src/components/guider/GuideCameraSettings.vue',
      'src/components/guider/PHD2/selectGuiderCam.vue',

      // Values bound to a store instead of the profile snapshot.
      'src/components/camera/settingsCamera.vue',
      'src/components/flatassistant/MultiMode.vue',
      'src/components/flatassistant/setCount.vue',
      'src/components/flatassistant/setDarkCount.vue',
      'src/components/flatassistant/setHistogramMeanTarget.vue',
      'src/components/flatassistant/setHistogramTolerance.vue',
      'src/components/flatassistant/setMaxExposureTime.vue',
      'src/components/flatassistant/setMinExposureTime.vue',
      'src/store/hocusFocusStore.js',
      'src/store/store.js',

      // Equipment profile traps: driver/port writes with ordering rules (see the equipment skill).
      'src/components/equipment/SettingsOnStepXConnection.vue',
      'src/components/equipment/SettingsSerialConnection.vue',
      'src/components/equipment/selectIndi.vue',
      'src/components/setupWizard/IndiDriverSelect.vue',
      'src/utils/equipmentDevices.js',

      // One action writes several keys at once.
      'src/components/focuser/settings/setFocuserUseFilterOffset.vue',
      'src/components/mount/settings/MeridianFlipPresetPicker.vue',
      'src/components/mount/settings/MeridianFlipSettings.vue',
      'src/components/settings/image/FilePatternBuilder.vue',
      'src/utils/location.js',
      'src/utils/locationSyncUtils.js',

      // Actions and wizard steps that apply a computed value, not a bound setting.
      'src/components/focuser/hocus/HfSetupAssistant.vue',
      'src/components/framing/slewAndCenter.vue',
      'src/components/mount/ButtonSetLocationSyncToMount.vue',
      'src/components/pins/system/TimeSyncSettings.vue',
      'src/components/profil/ProfilManagementModal.vue',
      'src/components/setupWizard/CameraSensorSettings.vue',
      'src/components/setupWizard/GuiderDitherCalculator.vue',
      'src/components/setupWizard/steps/WizardSlewRateStep.vue',
      'src/views/CameraPage.vue',
    ],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
]);
