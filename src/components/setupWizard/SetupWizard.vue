<template>
  <!-- Hidden while the global PINS upgrade overlay (App.vue, z-[80]) owns the screen,
       so the two never stack. The wizard state survives in settingsStore. -->
  <teleport to="body">
    <div
      v-if="!pinsStore.shouldShowUpgradeOverlay"
      class="fixed inset-0 z-70 bg-ground/95 overflow-y-auto overscroll-contain"
    >
      <div class="min-h-full flex items-start sm:items-center justify-center p-4 py-8">
        <div class="w-full max-w-xl flex flex-col gap-4">
          <!-- Header -->
          <div class="flex items-start justify-between gap-3">
            <div>
              <h1 class="text-2xl font-bold text-content">
                {{ t('components.setupWizard.title') }}
              </h1>
              <p class="text-sm text-content-muted">
                {{
                  t('components.setupWizard.stepCounter', {
                    current: currentStepIndex + 1,
                    total: steps.length,
                  })
                }}
                — {{ t(currentStep.labelKey) }}
              </p>
            </div>
            <button
              class="tns-btn-ghost shrink-0"
              :title="t('components.setupWizard.cancel')"
              @click="cancel"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <!-- Progress dots -->
          <div class="flex justify-center gap-2">
            <div
              v-for="(step, index) in steps"
              :key="step.id"
              class="h-2 rounded-full transition-all duration-300"
              :class="
                index === currentStepIndex
                  ? 'w-6 bg-accent'
                  : index < currentStepIndex
                    ? 'w-2 bg-accent/50'
                    : 'w-2 bg-line-strong'
              "
            ></div>
          </div>

          <!-- Step body -->
          <transition name="wizard-fade" mode="out-in">
            <div :key="currentStep.id" class="tns-card">
              <!-- Welcome -->
              <div v-if="currentStep.id === 'welcome'" class="flex flex-col gap-4">
                <h2 class="text-xl font-semibold text-content">
                  {{ t('components.setupWizard.welcome.title') }}
                </h2>
                <p class="text-sm text-content-muted">
                  {{ t('components.setupWizard.welcome.description') }}
                </p>
                <ul class="flex flex-col gap-2 text-sm text-content-muted">
                  <li v-for="step in steps.slice(1, -1)" :key="step.id" class="flex gap-2">
                    <span class="text-accent">•</span>
                    <span>{{ t(step.labelKey) }}</span>
                  </li>
                </ul>
                <p class="text-xs text-content-faint">
                  {{ t('components.setupWizard.welcome.cancelHint') }}
                </p>
              </div>

              <WizardLanguageStep v-else-if="currentStep.id === 'language'" />

              <WizardInfoStep v-else-if="currentStep.id === 'info'" />

              <WizardInstanceStep v-else-if="currentStep.id === 'instance'" />

              <WizardLocalizationStep v-else-if="currentStep.id === 'localization'" />

              <WizardWifiStep v-else-if="currentStep.id === 'wifi'" />

              <WizardUpdatesStep v-else-if="currentStep.id === 'updates'" />

              <WizardMountStep v-else-if="currentStep.id === 'mount'" />

              <WizardSlewRateStep v-else-if="currentStep.id === 'slewRate'" />

              <WizardLocationStep v-else-if="currentStep.id === 'location'" />

              <WizardTelescopeStep v-else-if="currentStep.id === 'telescope'" />

              <WizardCameraStep v-else-if="currentStep.id === 'camera'" />

              <WizardFocuserStep v-else-if="currentStep.id === 'focuser'" />

              <WizardFilterWheelStep v-else-if="currentStep.id === 'filterWheel'" />

              <WizardGuiderStep v-else-if="currentStep.id === 'guider'" />

              <WizardDitherStep v-else-if="currentStep.id === 'dither'" />

              <!-- Done -->
              <div v-else class="flex flex-col gap-4">
                <h2 class="text-xl font-semibold text-content">
                  {{ t('components.setupWizard.done.title') }}
                </h2>
                <p class="text-sm text-content-muted">
                  {{
                    store.isPINS
                      ? t('components.setupWizard.done.description')
                      : t('components.setupWizard.done.descriptionPlain')
                  }}
                </p>
                <p class="text-sm text-content-faint">
                  {{ t('components.setupWizard.done.moreDevicesHint') }}
                </p>
                <!-- Anyone who skipped the instance step lands on the connection
                     splash afterwards; say where to fix that. -->
                <p v-if="!store.isBackendReachable" class="text-sm text-status-warn">
                  {{ t('components.setupWizard.done.noConnectionHint') }}
                </p>
              </div>
            </div>
          </transition>

          <!-- Footer navigation -->
          <div class="flex items-center gap-2">
            <button
              v-if="currentStepIndex > 0"
              class="tns-btn-secondary flex-1"
              @click="previousStep"
            >
              {{ t('components.setupWizard.back') }}
            </button>
            <button v-if="isLastStep" class="tns-btn-primary flex-1" @click="finish">
              {{ t('components.setupWizard.finish') }}
            </button>
            <button v-else class="tns-btn-primary flex-1" @click="nextStep">
              {{ t('components.setupWizard.next') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { XMarkIcon } from '@heroicons/vue/24/outline';
import { Capacitor } from '@capacitor/core';
import { useSettingsStore } from '@/store/settingsStore';
import { apiStore } from '@/store/store';
import { usePinsStore } from '@/plugins/pins/store/pinsStore';
import WizardLanguageStep from './steps/WizardLanguageStep.vue';
import WizardInfoStep from './steps/WizardInfoStep.vue';
import WizardInstanceStep from './steps/WizardInstanceStep.vue';
import WizardLocalizationStep from './steps/WizardLocalizationStep.vue';
import WizardWifiStep from './steps/WizardWifiStep.vue';
import WizardUpdatesStep from './steps/WizardUpdatesStep.vue';
import WizardMountStep from './steps/WizardMountStep.vue';
import WizardSlewRateStep from './steps/WizardSlewRateStep.vue';
import WizardLocationStep from './steps/WizardLocationStep.vue';
import WizardTelescopeStep from './steps/WizardTelescopeStep.vue';
import WizardCameraStep from './steps/WizardCameraStep.vue';
import WizardFocuserStep from './steps/WizardFocuserStep.vue';
import WizardFilterWheelStep from './steps/WizardFilterWheelStep.vue';
import WizardGuiderStep from './steps/WizardGuiderStep.vue';
import WizardDitherStep from './steps/WizardDitherStep.vue';

const emit = defineEmits(['close']);

const { t } = useI18n();
const settingsStore = useSettingsStore();
const store = apiStore();
const pinsStore = usePinsStore();

const isMobile = ['android', 'ios'].includes(Capacitor.getPlatform());

function step(id) {
  return { id, labelKey: `components.setupWizard.steps.${id}` };
}

/**
 * The list is dynamic: the instance step only exists on mobile, and the rig-only
 * steps depend on isPINS - which flips once the instance step established a
 * connection. Adding a device step means one entry here plus one v-else-if
 * branch above; nothing else in the shell is step-aware.
 *
 * Five steps are genuinely PINS-only. Mount, camera, focuser and filter
 * wheel connect through the NINA Advanced API and work on any backend - they
 * hide their own INDI blocks instead of disappearing entirely.
 */
const steps = computed(() => [
  step('welcome'),
  step('language'),
  step('info'),
  ...(isMobile ? [step('instance')] : []),
  // Set the rig's regional defaults before Wi-Fi regulatory settings are used.
  // These steps talk to the PINS daemon on port 8000.
  ...(store.isPINS ? [step('localization'), step('wifi'), step('updates')] : []),
  // Mount before location: the location sync needs a connected mount.
  step('mount'),
  // IndiMaxSlewRateDps is an INDI driver limit and meaningless without it.
  ...(store.isPINS ? [step('slewRate')] : []),
  step('location'),
  // Telescope before camera on purpose: the camera step's image-scale readout
  // needs TelescopeSettings.FocalLength to be set.
  step('telescope'),
  // Guiding runs through PHD2, which is only reachable on PINS. It needs a
  // connected mount, and it has to come before the camera step: once the imaging
  // camera is connected, PHD2 can no longer scan for the guide camera.
  ...(store.isPINS ? [step('guider')] : []),
  step('camera'),
  step('focuser'),
  step('filterWheel'),
  // Dither last: the calculator needs the imaging camera and telescope values as
  // well as the guide setup from the steps above.
  ...(store.isPINS ? [step('dither')] : []),
  step('done'),
]);

// Tracked by id, not by index: the list grows underneath the user when isPINS
// flips, and an index would then point at a different step than they were on.
const currentStepId = ref(settingsStore.setupWizard.currentStepId || steps.value[0].id);

const currentStepIndex = computed(() => {
  const index = steps.value.findIndex((entry) => entry.id === currentStepId.value);
  // The step disappeared (a persisted id from another mode, or isPINS went
  // false) - fall back to the beginning rather than rendering nothing.
  return index === -1 ? 0 : index;
});
const currentStep = computed(() => steps.value[currentStepIndex.value]);
const isLastStep = computed(() => currentStepIndex.value === steps.value.length - 1);

watch(currentStepId, (id) => settingsStore.setSetupWizardStep(id));

function goToIndex(index) {
  const target = steps.value[index];
  if (target) currentStepId.value = target.id;
}

function nextStep() {
  goToIndex(currentStepIndex.value + 1);
}

function previousStep() {
  goToIndex(currentStepIndex.value - 1);
}

// Cancel and finish are the same transaction - completeSetupWizard() also marks
// the setup itself complete, so the app is usable either way. Only the wording
// the user saw beforehand differs.
function cancel() {
  settingsStore.completeSetupWizard();
  emit('close');
}

function finish() {
  settingsStore.completeSetupWizard();
  emit('close');
}
</script>

<style scoped>
.wizard-fade-enter-active,
.wizard-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.wizard-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.wizard-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
