<template>
  <div class="flex flex-col items-center w-full px-4">
    <div class="flex flex-col w-full max-w-lg landscape:max-w-3xl items-center justify-center">
      <h5 class="text-xl font-bold text-content mb-4">{{ $t('pages.equipment.title') }}</h5>
      <div class="flex flex-col w-full items-center justify-center">
        <div class="tns-card flex items-center justify-center mb-4 w-full">
          <profilSelect />
        </div>
        <div v-if="store.isPINS" class="tns-card flex items-center justify-center mb-4 w-full">
          <button @click="showIndiModal = true" class="tns-btn-secondary">
            <Cog6ToothIcon class="w-5 h-5" />
            {{ $t('pages.equipment.indiSetup') }}
          </button>
        </div>
        <div class="tns-card mb-24 w-full">
          <connectEquipment />
        </div>
      </div>
    </div>
  </div>

  <!-- INDI Setup Modal -->
  <Modal :show="showIndiModal" @close="showIndiModal = false">
    <template #header>
      <h2 class="text-xl font-bold">{{ $t('pages.equipment.indiSetup') }}</h2>
    </template>
    <template #body>
      <selectIndi v-if="store.isPINS" />
    </template>
  </Modal>
</template>

<script setup>
import { ref } from 'vue';
import { Cog6ToothIcon } from '@heroicons/vue/24/outline';
import profilSelect from '@/components/profil/profilSelect.vue';
import connectEquipment from '@/components/equipment/connectEquipment.vue';
import selectIndi from '@/components/equipment/selectIndi.vue';
import Modal from '@/components/helpers/Modal.vue';
import { apiStore } from '@/store/store';
const store = apiStore();
const showIndiModal = ref(false);
</script>

<style scoped></style>
