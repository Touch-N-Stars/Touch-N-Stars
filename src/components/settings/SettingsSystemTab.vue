<template>
  <div class="space-y-6">
    <!-- set beta -->
    <div
      class="tns-card flex flex-col gap-2 sm:gap-3"
      v-if="['android', 'ios'].includes(Capacitor.getPlatform())"
    >
      <h3 class="tns-section-title">
        {{ $t('components.settings.beta.title') }}
      </h3>
      <SetBeta />
      <SetDevChannel v-if="settingsStore.devChannelUnlocked" />
      <CheckForUpdateButton />
    </div>

    <!-- Tutorial Button -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">Tutorial</h3>
      <button @click="showTutorial" class="tns-btn-secondary w-full">
        {{ $t('components.settings.showTutorial') }}
      </button>
      <button @click="restartSetupWizard" class="tns-btn-secondary w-full">
        {{ $t('components.setupWizard.restart') }}
      </button>
    </div>

    <!-- Backup / restore of the device-local settings -->
    <BackupRestoreSettings />

    <!-- Debug settings -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.debug.title') }}
      </h3>
      <SetDebug />
      <div v-if="store.isPINS" class="flex items-center justify-between">
        <p class="text-content text-sm mr-4">{{ $t('components.settings.debug.logLevel') }}</p>
        <SetLogLevel />
      </div>
    </div>

    <!-- System Controls -->
    <div class="tns-card flex flex-col gap-2 sm:gap-3">
      <h3 class="tns-section-title">
        {{ $t('components.settings.system.title') }}
      </h3>
      <p class="text-content-muted text-sm mb-2">
        {{ $t('components.settings.system.description') }}
      </p>
      <p class="text-content-muted text-sm mb-4">{{ $t('components.settings.system.info') }}</p>

      <div class="flex justify-center gap-3">
        <!-- Restart Button -->
        <button
          @click="restartSystem"
          class="tns-btn-danger gap-2 max-w-40"
          :title="$t('components.settings.system.restart')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {{ $t('components.settings.system.restart') }}
        </button>

        <!-- Shutdown Button -->
        <button
          @click="shutdownSystem"
          class="tns-btn-danger gap-2 max-w-40"
          :title="$t('components.settings.system.shutdown')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            viewBox="0 0 325.214 325.214"
            fill="currentColor"
          >
            <path
              d="M288.777,93.565c-15.313-23.641-36.837-42.476-62.243-54.472c-1.616-0.763-3.109-1.134-4.564-1.134
            c-1.969,0-8.392,0.833-8.392,11.541v17.75c0,8.998,5.479,13.113,7.159,14.16c32.613,20.33,52.083,55.317,52.083,93.59
            c0,60.772-49.442,110.214-110.214,110.214S52.393,235.772,52.393,175c0-38.872,19.942-74.144,53.346-94.353
            c4.475-2.707,6.839-7.426,6.839-13.647V49c0-7.959-5.077-10.783-9.424-10.783c-1.714,0-3.542,0.422-5.144,1.188
            C72.781,51.471,51.42,70.305,36.237,93.872C20.638,118.084,12.393,146.137,12.393,175c0,82.828,67.386,150.214,150.214,150.214
            S312.821,257.828,312.821,175C312.821,146.008,304.507,117.848,288.777,93.565z"
            />
            <path
              d="M152.579,117h21c5.514,0,10-4.486,10-10V10c0-5.514-4.486-10-10-10h-21c-5.514,0-10,4.486-10,10v97
            C142.579,112.514,147.064,117,152.579,117z"
            />
          </svg>
          {{ $t('components.settings.system.shutdown') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { apiStore } from '@/store/store';
import { useSettingsStore } from '@/store/settingsStore';
import { Capacitor } from '@capacitor/core';
import SetBeta from '@/components/settings/general/SetBeta.vue';
import SetDevChannel from '@/components/settings/general/SetDevChannel.vue';
import CheckForUpdateButton from '@/components/settings/general/CheckForUpdateButton.vue';
import SetDebug from '@/components/settings/general/SetDebug.vue';
import SetLogLevel from '@/components/settings/general/SetLogLevel.vue';
import BackupRestoreSettings from '@/components/settings/general/BackupRestoreSettings.vue';

const settingsStore = useSettingsStore();
const store = apiStore();

const emit = defineEmits(['show-tutorial', 'restart-system', 'shutdown-system']);

const showTutorial = () => {
  emit('show-tutorial');
};

// resetSetupWizard() bumps openRequest, which is what App.vue watches to reopen
// the overlay - clearing `completed` alone would not re-fire after a cancel.
const restartSetupWizard = () => {
  settingsStore.resetSetupWizard();
};

// System actions
const restartSystem = async () => {
  emit('restart-system');
};

const shutdownSystem = async () => {
  emit('shutdown-system');
};
</script>
