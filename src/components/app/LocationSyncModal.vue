<template>
  <!-- Blocks the mount connect until answered, so it has to sit above every other
       surface it can be triggered from - including the PINS setup wizard (z-overlay). -->
  <Modal :show="showLocationSyncModal" zIndex="z-overlay-blocking" @close="cancelLocationSync">
    <template #header>
      <h2 class="text-xl font-bold">{{ $t('components.mount.location_sync.title') }}</h2>
    </template>
    <template #body>
      <div class="text-center">
        <p class="text-content mb-6">
          {{ $t('components.mount.location_sync.confirmationMessage') }}
        </p>

        <!-- Sync Options -->
        <div class="space-y-3 mb-6">
          <!-- Sync to Telescope: the recommendation of the text above, so it is the primary
               button and says so - before it looked exactly like the other two. -->
          <button @click="selectOption(2)" class="tns-btn-primary justify-start! text-left!">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-white/20 text-white"
            >
              <ArrowUpIcon class="w-3.5 h-3.5" />
            </span>
            <span class="flex-1">{{ $t('components.mount.location_sync.toTelescope.label') }}</span>
            <span class="text-xs font-semibold uppercase opacity-90">
              {{ $t('components.mount.location_sync.recommended') }}
            </span>
          </button>

          <!-- Sync to Application -->
          <button @click="selectOption(1)" class="tns-btn-secondary justify-start! text-left!">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-accent/20 text-accent"
            >
              <ArrowDownIcon class="w-3.5 h-3.5" />
            </span>
            {{ $t('components.mount.location_sync.toApplication.label') }}
          </button>

          <!-- No Sync -->
          <button @click="selectOption(3)" class="tns-btn-secondary justify-start! text-left!">
            <span
              class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-surface-1 text-content-muted"
            >
              <XMarkIcon class="w-3.5 h-3.5" />
            </span>
            {{ $t('components.mount.location_sync.noSync.label') }}
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
import Modal from '@/components/helpers/Modal.vue';
import { ArrowUpIcon, ArrowDownIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import {
  showLocationSyncModal,
  selectLocationSyncOption,
  cancelLocationSync,
} from '@/utils/locationSyncUtils';

function selectOption(value) {
  selectLocationSyncOption(value);
}
</script>
