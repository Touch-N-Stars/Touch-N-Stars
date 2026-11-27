<template>
  <!-- Quick mount actions in the status bar's mount panel (simple mode). A field-test user
       looked for "stop tracking and send the mount home" there - tapping the mount is where
       one looks - and found only the status; the actions sat on the mount page under "More"
       and in "End the night". -->
  <div class="grid grid-cols-2 gap-2">
    <template v-if="!store.mountIsParked && store.mountInfo.CanSetTrackingEnabled">
      <button
        v-if="store.mountInfo.TrackingEnabled"
        type="button"
        class="tns-btn-secondary"
        :disabled="busy"
        @click="setTracking(false)"
      >
        {{ t('components.simpleMode.mountActions.stopTracking') }}
      </button>
      <button
        v-else
        type="button"
        class="tns-btn-secondary"
        :disabled="busy"
        @click="setTracking(true)"
      >
        {{ t('components.simpleMode.mountActions.startTracking') }}
      </button>
    </template>
    <ButtonHome v-if="!store.mountIsParked" />
    <ButtonUnpark v-if="store.mountIsParked" />
    <ButtonPark v-else />
    <button type="button" class="tns-btn-ghost col-span-2" @click="openMountPage">
      {{ t('components.simpleMode.mountActions.allFunctions') }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { apiStore } from '@/store/store';
import { useStatusBarStore } from '@/store/statusBarStore';
import apiService from '@/services/apiService';
import { reportBackendRefusal } from '@/utils/backendErrors';
import ButtonHome from '@/components/mount/ButtonHome.vue';
import ButtonPark from '@/components/mount/ButtonPark.vue';
import ButtonUnpark from '@/components/mount/ButtonUnpark.vue';

const { t } = useI18n();
const router = useRouter();
const store = apiStore();
const statusBarStore = useStatusBarStore();

const busy = ref(false);

// NINA's tracking modes: 0 = sidereal, 4 = stopped
async function setTracking(on) {
  busy.value = true;
  try {
    const response = await apiService.setTrackingMode(on ? 0 : 4);
    reportBackendRefusal(response, 'components.backendErrors.mountTracking');
  } finally {
    busy.value = false;
  }
}

function openMountPage() {
  statusBarStore.closePanel();
  store.mount.currentTab = 'showMount';
  router.push('/mount');
}
</script>
