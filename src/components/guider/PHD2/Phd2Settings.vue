<template>
  <div class="flex flex-col gap-2 sm:gap-4">
    <!-- Dark Library Build Banner -->
    <div
      v-if="store.isPINS && guiderStore.isDarkLibraryBuildActive"
      class="p-3 rounded-control bg-status-warn/10 border border-status-warn/40"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-status-warn">
            {{ $t('components.guider.phd2.darkLibrary.buildActive') }}
          </div>
          <div class="text-xs text-content">
            {{ $t('components.guider.phd2.darkLibrary.buildActiveMessage') }}
          </div>
          <div
            v-if="guiderStore.phd2DarkLibraryBuildStatus"
            class="text-xs text-content-muted mt-1"
          >
            {{
              $t('components.guider.phd2.darkLibrary.buildProgress', {
                frame: guiderStore.phd2DarkLibraryBuildStatus.Frame ?? 0,
                total: guiderStore.phd2DarkLibraryBuildStatus.TotalFrames ?? 0,
                exposure: ((guiderStore.phd2DarkLibraryBuildStatus.ExposureMs ?? 0) / 1000).toFixed(
                  1
                ),
              })
            }}
          </div>
        </div>
        <button
          @click="guiderStore.cancelPHD2DarkLibraryBuild()"
          class="tns-btn-danger w-auto! px-3! text-xs!"
        >
          {{ $t('components.guider.phd2.darkLibrary.cancel') }}
        </button>
      </div>
    </div>

    <!-- PHD2 Profile -->
    <div v-if="!store.isPINS" class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.guider.phd2.profile') }}
      </h3>
      <PHD2Profil />
    </div>

    <template v-if="guiderStore.phd2IsConnected">
      <!-- Calibration Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.calibration') }}
        </h3>
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-content">
            {{ $t('components.guider.phd2.forceCalibration') }}
          </span>
          <toggleButton
            @click="
              settingsStore.setPhd2ForceCalibration(!settingsStore.guider.phd2ForceCalibration)
            "
            :status-value="settingsStore.guider.phd2ForceCalibration"
          />
        </div>
      </div>

      <!-- Exposure Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.exposure') }}
        </h3>
        <SetExposure />
      </div>

      <!-- RA Algorithm -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.raAlgorithm') }}
        </h3>
        <SetRaAlgoPara />
      </div>

      <!-- DEC Algorithm -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.decAlgorithm') }}
        </h3>
        <SetDecAlgoPara />
      </div>
    </template>

    <!-- Image Display Settings -->
    <div v-if="showImageDisplay" class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.guider.phd2.imageDisplay') }}
      </h3>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-content">
            {{ $t('components.guider.phd2.imageGamma') }}
          </span>
          <span class="text-sm text-content-muted">{{
            settingsStore.guider.phd2ImageGamma.toFixed(2)
          }}</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="1.0"
          step="0.05"
          :value="settingsStore.guider.phd2ImageGamma"
          @input="settingsStore.setPhd2ImageGamma(parseFloat($event.target.value))"
          class="w-full accent-accent"
        />
        <div class="flex justify-between text-xs text-content-faint">
          <span>{{ $t('components.guider.phd2.imageGammaHint') }}</span>
        </div>
      </div>
    </div>

    <template v-if="store.isPINS">
      <!-- Shared Parameters (always visible) -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.shared_prarmeters') }}
        </h3>
        <Phd2Toggle
          labelKey="components.guider.phd2.reverseDecAfterFlip"
          helpKey="components.guider.phd2.help.reverseDecAfterFlip"
          field="phd2ReverseDecAfterFlip"
        />
        <Phd2Toggle
          labelKey="components.guider.phd2.fastRecenter"
          helpKey="components.guider.phd2.help.fastRecenter"
          field="phd2FastRecenter"
        />
        <Phd2Toggle
          labelKey="components.guider.phd2.mountGuideOutput"
          helpKey="components.guider.phd2.help.mountGuideOutput"
          field="phd2MountGuideOutput"
        />
      </div>

      <!-- Guide Star Tracking -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.starDetection') }}
        </h3>
        <Phd2SearchRegion />
        <Phd2MinStarHFD />
        <Phd2MaxStarHFD />
        <Phd2Toggle labelKey="components.guider.phd2.beepForLostStar" field="phd2BeepForLostStar" />

        <!-- Star Mass Detection sub-group -->
        <div class="p-2 flex flex-col gap-2 bg-surface-2 rounded-control border border-line">
          <h4 class="text-sm font-semibold text-content">
            {{ $t('components.guider.phd2.starMassDetection') }}
          </h4>
          <Phd2Toggle
            labelKey="components.guider.phd2.massChangeEnabled"
            helpKey="components.guider.phd2.help.massChangeEnabled"
            field="phd2MassChangeEnabled"
          />
          <Phd2MassChangeThreshold />
        </div>

        <Phd2MinStarSNR />
        <Phd2Toggle
          labelKey="components.guider.phd2.useMultipleStars"
          helpKey="components.guider.phd2.help.useMultipleStars"
          field="phd2UseMultipleStars"
        />
        <Phd2AutoSelectDownsample />
      </div>

      <!-- Camera Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.camera') }}
        </h3>
        <Phd2CameraGain />
        <Phd2CameraBinning />
        <Phd2Toggle
          labelKey="components.guider.phd2.saturationByADU"
          helpKey="components.guider.phd2.help.saturationByADU"
          field="phd2SaturationByADU"
        />
        <Phd2SaturationADUValue />
      </div>

      <!-- Calibration Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.calibration') }}
        </h3>
        <Phd2FocalLength />
        <Phd2CalibrationStep />
        <Phd2RestoreCalibration />
        <Phd2Toggle
          labelKey="components.guider.phd2.assumeDecOrthogonal"
          helpKey="components.guider.phd2.help.assumeDecOrthogonal"
          field="phd2AssumeDecOrthogonal"
        />
        <Phd2Toggle
          labelKey="components.guider.phd2.useDecCompensation"
          helpKey="components.guider.phd2.help.useDecCompensation"
          field="phd2UseDecCompensation"
        />
      </div>

      <!-- Backlash Compensation -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.backlash.title') }}
        </h3>
        <Phd2Toggle
          labelKey="components.guider.phd2.backlash.enabled"
          helpKey="components.guider.phd2.help.backlashEnabled"
          field="phd2BacklashEnabled"
          fetchAction="fetchPHD2BacklashComp"
          loadingField="phd2BacklashLoading"
        />
        <Phd2BacklashAmount />
        <Phd2BacklashMin />
        <Phd2BacklashMax />
      </div>

      <!-- Guide Algorithm Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.guideAlgorithm') }}
        </h3>
        <Phd2GuideAlgorithmRA />
        <Phd2GuideAlgorithmDEC />
      </div>

      <!-- Dither Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.dither') }}
        </h3>
        <Phd2DitherMode />
        <Phd2Toggle
          labelKey="components.guider.phd2.ditherRaOnly"
          helpKey="components.guider.phd2.help.ditherRaOnly"
          field="phd2DitherRaOnly"
        />
        <Phd2DitherScale />
      </div>

      <!-- Mount Settings -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.mountSettings') }}
        </h3>
        <MountGuideRate />
      </div>

      <!-- Dark Library -->
      <div class="tns-card flex flex-col gap-2 sm:gap-3">
        <h3 class="tns-section-title">
          {{ $t('components.guider.phd2.darkLibrary.title') }}
        </h3>
        <Phd2DarkLibrary />
      </div>
    </template>
  </div>
</template>

<script setup>
import { useGuiderStore } from '@/store/guiderStore';
import { useSettingsStore } from '@/store/settingsStore';
import SetExposure from '@/components/guider/PHD2/SetExposure.vue';
import SetRaAlgoPara from '@/components/guider/PHD2/SetRaAlgoPara.vue';
import SetDecAlgoPara from '@/components/guider/PHD2/SetDecAlgoPara.vue';
import PHD2Profil from '@/components/guider/PHD2/PHD2Profil.vue';
import toggleButton from '@/components/helpers/toggleButton.vue';
import Phd2FocalLength from '@/components/guider/PHD2/pins/Phd2FocalLength.vue';
import Phd2CalibrationStep from '@/components/guider/PHD2/pins/Phd2CalibrationStep.vue';
import Phd2Toggle from '@/components/guider/PHD2/pins/Phd2Toggle.vue';
import Phd2GuideAlgorithmRA from '@/components/guider/PHD2/pins/Phd2GuideAlgorithmRA.vue';
import Phd2GuideAlgorithmDEC from '@/components/guider/PHD2/pins/Phd2GuideAlgorithmDEC.vue';
import Phd2CameraGain from '@/components/guider/PHD2/pins/Phd2CameraGain.vue';
import Phd2CameraBinning from '@/components/guider/PHD2/pins/Phd2CameraBinning.vue';
import Phd2RestoreCalibration from '@/components/guider/PHD2/pins/Phd2RestoreCalibration.vue';
import Phd2DarkLibrary from '@/components/guider/PHD2/pins/Phd2DarkLibrary.vue';
import MountGuideRate from '@/components/guider/PHD2/pins/MountGuideRate.vue';
import Phd2SearchRegion from '@/components/guider/PHD2/pins/Phd2SearchRegion.vue';
import Phd2MinStarHFD from '@/components/guider/PHD2/pins/Phd2MinStarHFD.vue';
import Phd2MaxStarHFD from '@/components/guider/PHD2/pins/Phd2MaxStarHFD.vue';
import Phd2MinStarSNR from '@/components/guider/PHD2/pins/Phd2MinStarSNR.vue';
import Phd2AutoSelectDownsample from '@/components/guider/PHD2/pins/Phd2AutoSelectDownsample.vue';
import Phd2MassChangeThreshold from '@/components/guider/PHD2/pins/Phd2MassChangeThreshold.vue';
import Phd2BacklashAmount from '@/components/guider/PHD2/pins/Phd2BacklashAmount.vue';
import Phd2BacklashMin from '@/components/guider/PHD2/pins/Phd2BacklashMin.vue';
import Phd2BacklashMax from '@/components/guider/PHD2/pins/Phd2BacklashMax.vue';
import Phd2SaturationADUValue from '@/components/guider/PHD2/pins/Phd2SaturationADUValue.vue';
import Phd2DitherMode from '@/components/guider/PHD2/pins/Phd2DitherMode.vue';
import Phd2DitherScale from '@/components/guider/PHD2/pins/Phd2DitherScale.vue';
import { computed } from 'vue';
import { apiStore } from '@/store/store';

const guiderStore = useGuiderStore();
const settingsStore = useSettingsStore();
const store = apiStore();

const showImageDisplay = computed(
  () => store.isPINS || store.checkVersionNewerOrEqual(store.currentTnsPluginVersion, '1.2.7.3')
);
</script>
