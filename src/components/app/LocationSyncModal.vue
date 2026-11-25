<template>
  <!-- Blocks the mount connect until answered, so it has to sit above every other
       surface it can be triggered from - including the PINS setup wizard (z-overlay). -->
  <Modal :show="showLocationSyncModal" zIndex="z-overlay-blocking" @close="cancelLocationSync">
    <template #header>
      <h2 class="text-xl font-bold">{{ $t('components.mount.location_sync.title') }}</h2>
    </template>

    <template #body>
      <div class="text-center">
        <p v-if="profileHasLocation" class="text-content mb-6">
          {{ $t('components.mount.location_sync.confirmationMessage') }}
        </p>
        <!-- Without a location in the profile "sync to telescope" would send 0°/0° and overwrite
             a location the mount already knows, so the recommendation moves to "no sync". -->
        <p v-else class="text-content mb-6">
          {{ $t('components.mount.location_sync.noLocationHint') }}
        </p>

        <!-- Sync Options -->
        <div class="space-y-3 mb-6">
          <button
            v-for="option in options"
            :key="option.value"
            @click="selectOption(option.value)"
            :class="[
              option.value === recommended ? 'tns-btn-primary' : 'tns-btn-secondary',
              'justify-start! text-left!',
            ]"
          >
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
              :class="option.value === recommended ? 'bg-white/20 text-white' : option.iconClass"
            >
              <component :is="option.icon" class="w-3.5 h-3.5" />
            </span>
            <span class="flex-1">{{ $t(option.labelKey) }}</span>
            <span
              v-if="option.value === recommended"
              class="text-xs font-semibold uppercase opacity-90"
            >
              {{ $t('components.mount.location_sync.recommended') }}
            </span>
          </button>
        </div>

        <!-- Cancel Button -->
        <button @click="cancelLocationSync" class="tns-btn-secondary w-auto! mx-auto px-6!">
          {{ $t('general.cancel') }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import Modal from '@/components/helpers/Modal.vue';
import { ArrowUpIcon, ArrowDownIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import { apiStore } from '@/store/store';
import { hasProfileLocation } from '@/utils/profileLocation';
import {
  showLocationSyncModal,
  selectLocationSyncOption,
  cancelLocationSync,
} from '@/utils/locationSyncUtils';

// NINA's TelescopeLocationSyncDirection values.
const TO_APPLICATION = 1;
const TO_TELESCOPE = 2;
const NO_SYNC = 3;

const store = apiStore();
const profileHasLocation = computed(() => hasProfileLocation(store.profileInfo));
const recommended = computed(() => (profileHasLocation.value ? TO_TELESCOPE : NO_SYNC));

const options = [
  {
    value: TO_TELESCOPE,
    labelKey: 'components.mount.location_sync.toTelescope.label',
    icon: ArrowUpIcon,
    iconClass: 'bg-accent/20 text-accent',
  },
  {
    value: TO_APPLICATION,
    labelKey: 'components.mount.location_sync.toApplication.label',
    icon: ArrowDownIcon,
    iconClass: 'bg-accent/20 text-accent',
  },
  {
    value: NO_SYNC,
    labelKey: 'components.mount.location_sync.noSync.label',
    icon: XMarkIcon,
    iconClass: 'bg-surface-1 text-content-muted',
  },
];

function selectOption(value) {
  selectLocationSyncOption(value);
}
</script>
