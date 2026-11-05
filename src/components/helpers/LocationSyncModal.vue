<!-- src/components/helpers/LocationSyncModal.vue -->
<template>
  <!-- Blocks the mount connect until answered, so it has to sit above every other
       surface it can be triggered from - including the PINS setup wizard (z-overlay). -->
  <Modal :show="showLocationSyncModal" zIndex="z-overlay-blocking" @close="cancelLocationSync">
    <template #header>
      <h2 class="text-xl font-bold">{{ $t('components.mount.location_sync.title') }}</h2>
    </template>
    <template #body>
      <div class="text-center">
        <p class="text-gray-300 mb-6">
          {{ $t('components.mount.location_sync.confirmationMessage') }}
        </p>

        <!-- Sync Options -->
        <div class="space-y-3 mb-6">
          <!-- Sync to Telescope -->
          <button
            @click="selectOption(2)"
            class="w-full p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-left group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center group-hover:bg-green-400"
              >
                <ArrowUpIcon class="w-3 h-3" />
              </div>
              <div class="font-medium">
                {{ $t('components.mount.location_sync.toTelescope.label') }}
              </div>
            </div>
          </button>

          <!-- Sync to Application -->
          <button
            @click="selectOption(1)"
            class="w-full p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-left group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center group-hover:bg-blue-400"
              >
                <ArrowDownIcon class="w-3 h-3" />
              </div>
              <div class="font-medium">
                {{ $t('components.mount.location_sync.toApplication.label') }}
              </div>
            </div>
          </button>

          <!-- No Sync -->
          <button
            @click="selectOption(3)"
            class="w-full p-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-left group"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-5 h-5 bg-gray-500 rounded-full flex items-center justify-center group-hover:bg-gray-400"
              >
                <XMarkIcon class="w-3 h-3" />
              </div>
              <div class="font-medium">
                {{ $t('components.mount.location_sync.noSync.label') }}
              </div>
            </div>
          </button>
        </div>

        <!-- Cancel Button -->
        <button
          @click="cancelLocationSync"
          class="px-6 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors border border-gray-600"
        >
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
