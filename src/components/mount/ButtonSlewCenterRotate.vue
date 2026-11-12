<template>
  <div class="w-full">
    <div class="flex items-stretch gap-0 border border-line-strong rounded-control overflow-hidden">
      <button
        @click="handleMainAction"
        :disabled="
          (!store.mountIsSlewing &&
            (framingStore.isSlewing ||
              framingStore.isSlewingAndCentering ||
              framingStore.isRotating ||
              props.disabled)) ||
          !store.mountInfo.Connected
        "
        :class="[
          'px-5 flex-1 w-full rounded-none border-0',
          store.mountIsSlewing ? 'tns-btn-danger' : 'tns-btn-primary',
        ]"
      >
        <span
          v-if="
            framingStore.isSlewing || framingStore.isSlewingAndCentering || framingStore.isRotating
          "
          class="loader mr-2"
        ></span>
        <StopCircleIcon v-if="store.mountIsSlewing" class="w-6 h-6" />
        <p v-else-if="label">{{ label }}</p>
        <p
          v-else-if="
            settingsStore.mount.useCenter &&
            settingsStore.mount.useRotate &&
            store.rotatorInfo.Connected
          "
        >
          {{ $t('components.slewAndCenter.slew_and_center') }} &
          {{ $t('components.framing.useRotate') }}
        </p>
        <p v-else-if="settingsStore.mount.useCenter">
          {{ $t('components.slewAndCenter.slew_and_center') }}
        </p>
        <p v-else>{{ $t('components.slewAndCenter.slew') }}</p>
      </button>
      <button
        @click="openSettings"
        :disabled="
          framingStore.isSlewing ||
          framingStore.isSlewingAndCentering ||
          framingStore.isRotating ||
          props.disabled
        "
        :class="[
          'text-content-muted hover:text-content transition-colors duration-200 px-3 min-w-touch flex items-center justify-center rounded-none border-l bg-surface-3 hover:bg-surface-2 border-line-strong disabled:opacity-50 disabled:cursor-not-allowed',
        ]"
        title="Settings"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>
    </div>

    <!-- Settings Modal -->
    <Modal :show="showSettingsModal" @close="showSettingsModal = false" :zIndex="'z-modal-nested'">
      <template #header>
        <h2 class="text-xl font-bold">{{ $t('components.settings.title') }}</h2>
      </template>
      <template #body>
        <div class="space-y-4">
          <div
            class="flex items-center justify-between p-3 bg-surface-3/30 rounded-lg border border-line-strong/30"
          >
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full bg-cyan-400"></div>
              <span class="text-sm font-medium">{{ $t('components.framing.useCenter') }}</span>
            </div>
            <div class="ml-6">
              <toggleButton
                @click="toggleUseCenter"
                :status-value="settingsStore.mount.useCenter"
              />
            </div>
          </div>

          <div
            class="flex items-center justify-between p-3 bg-surface-3/30 rounded-lg border border-line-strong/30"
          >
            <div class="flex items-center gap-3">
              <div class="w-2 h-2 rounded-full bg-purple-400"></div>
              <span class="text-sm font-medium">{{ $t('components.framing.useRotate') }}</span>
            </div>
            <div class="ml-6">
              <toggleButton
                @click="toggleUseRotate"
                :status-value="settingsStore.mount.useRotate"
                :disabled="!store.rotatorInfo.Connected"
              />
            </div>
          </div>

          <div class="border-t border-line-strong/30 pt-4">
            <SettingInput
              labelKey="components.mount.settings.telescope_settle_time"
              settingKey="TelescopeSettings-SettleTime"
              :modelValue="store.profileInfo.TelescopeSettings.SettleTime"
              :max="600"
            />
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useFramingStore } from '@/store/framingStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useI18n } from 'vue-i18n';
import { wait } from '@/utils/utils';
import toggleButton from '@/components/helpers/toggleButton.vue';
import Modal from '@/components/helpers/Modal.vue';
import SettingInput from '@/components/helpers/settings/UpdateProfileNumber.vue';
import { StopCircleIcon } from '@heroicons/vue/24/outline';

const store = apiStore();
const framingStore = useFramingStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();
const showSettingsModal = ref(false);

// While slewing this button turns into the stop action. Stopping a moving mount
// stays a single tap on purpose — no confirmation in front of an emergency stop.
function handleMainAction() {
  if (store.mountIsSlewing) {
    framingStore.slewStop();
    return;
  }
  slew();
}

function toggleUseCenter() {
  settingsStore.mount.useCenter = !settingsStore.mount.useCenter;
  settingsStore.saveMountSettings();
}

function toggleUseRotate() {
  settingsStore.mount.useRotate = !settingsStore.mount.useRotate;
  settingsStore.saveMountSettings();
}

function openSettings() {
  showSettingsModal.value = true;
  settingsStore.mount.settingsVisited = true;
  settingsStore.saveMountSettings();
}

const props = defineProps({
  raAngle: Number,
  decAngle: Number,
  label: String,
  disabled: Boolean,
});
const emit = defineEmits(['finished']);

async function unparkMount() {
  if (store.mountInfo.AtPark) {
    try {
      const response = await apiService.mountAction('unpark');
      if (!response.Success) return;
      await wait(2000);
      console.log(t('components.mount.control.unpark'));
    } catch (error) {
      console.log(t('components.mount.control.errors.unpark'));
    }
  }
}

async function slew() {
  try {
    await unparkMount(); // Überprüfen und Entparken, falls erforderlich
    const center = settingsStore.mount.useCenter;
    const rotate = settingsStore.mount.useRotate && store.rotatorInfo.Connected;
    if (center || rotate) {
      if (framingStore.slewIsStopt) return;
      await framingStore.slewAndCenterRotate(props.raAngle, props.decAngle, center, rotate);
    } else {
      console.log('Slew without centering or rotating');
      await framingStore.slewAndCenterRotate(props.raAngle, props.decAngle, false, false);
    }
    emit('finished'); // Emit Event nach Erfolg
  } catch (error) {
    console.error('Slew error:', error);
  }
}
</script>

<style scoped>
.loader {
  border: 2px solid #f3f3f3;
  border-top: 2px solid #3498db;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
