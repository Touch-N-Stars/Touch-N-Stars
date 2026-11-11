<template>
  <button
    @click="showModal = true"
    class="p-2 text-content-faint hover:text-status-danger transition-colors"
  >
    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
      <path
        fill-rule="evenodd"
        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  <Modal :show="showModal" @close="showModal = false" maxWidth="max-w-md">
    <template #header>
      <h2 class="text-lg font-bold text-status-danger">
        {{ $t('components.RemoveFilter.confirmTitle') }}
      </h2>
    </template>
    <template #body>
      <div class="flex flex-col gap-4">
        <p class="text-content">
          {{ $t('components.RemoveFilter.confirmMessage') }}
        </p>
        <div class="flex gap-3 justify-end">
          <button @click="showModal = false" class="tns-btn-secondary">
            {{ $t('common.cancel') }}
          </button>
          <button @click="confirmRemoveFilter" class="tns-btn-danger">
            {{ $t('common.delete') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>
<script setup>
import { ref } from 'vue';
import apiServeice from '@/services/apiService';
import { apiStore } from '@/store/store';
import Modal from '@/components/helpers/Modal.vue';

const props = defineProps({
  filterId: {
    type: [String, Number],
    required: true,
  },
});

const store = apiStore();
const showModal = ref(false);

async function confirmRemoveFilter() {
  try {
    await apiServeice.removeFilter(props.filterId);
    await store.fetchProfilInfos();
    showModal.value = false;
  } catch (error) {
    console.error('[Filtersettings] Error removing filter:', error);
  }
}
</script>
