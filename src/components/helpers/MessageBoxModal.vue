<template>
  <Modal
    :show="showMessageBox"
    :zIndex="'z-messagebox'"
    :disableClose="true"
    :closeOnBackdropClick="false"
  >
    <template #header>
      <h2 class="text-xl font-bold text-white">
        {{ currentMessageBox?.title || 'MessageBox' }}
      </h2>
    </template>
    <template #body>
      <div class="space-y-4">
        <!-- MessageBox Text -->
        <div class="text-white">
          {{ currentMessageBox?.text }}
        </div>

        <!-- Buttons -->
        <div class="flex flex-col sm:flex-row gap-2 mt-6">
          <button
            v-for="btn in messageBoxButtons"
            :key="btn.label"
            @click="handleButtonClick(btn.result)"
            class="tns-btn-secondary flex-1 px-4 py-3 rounded-lg font-medium transition-all"
          >
            {{ btn.label }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useMessageboxStore } from '@/store/messageboxStore';
import Modal from '@/components/helpers/Modal.vue';

const messageboxStore = useMessageboxStore();

const showMessageBox = computed(() => {
  return messageboxStore.messageboxes && messageboxStore.messageboxes.length > 0;
});

const currentMessageBox = computed(() => {
  if (!messageboxStore.messageboxes || messageboxStore.messageboxes.length === 0) return null;

  // Zeige die letzte MessageBox aus dem Array (neueste)
  return messageboxStore.messageboxes[messageboxStore.messageboxes.length - 1];
});

const buttonConfigs = {
  OK: [{ label: 'OK', result: 'OK' }],
  OKCancel: [
    { label: 'OK', result: 'OK' },
    { label: 'Cancel', result: 'Cancel' },
  ],
  YesNoCancel: [
    { label: 'Yes', result: 'Yes' },
    { label: 'No', result: 'No' },
    { label: 'Cancel', result: 'Cancel' },
  ],
  YesNo: [
    { label: 'Yes', result: 'Yes' },
    { label: 'No', result: 'No' },
  ],
};

const messageBoxButtons = computed(() => {
  const buttonType = currentMessageBox.value?.button;
  return buttonConfigs[buttonType] || buttonConfigs['OK'];
});

async function handleButtonClick(result) {
  const messageBoxId = currentMessageBox.value?.id;

  console.log('[MessageBoxModal] Clicking button:', result, 'MessageBox ID:', messageBoxId);

  if (messageBoxId) {
    await messageboxStore.respondToMessageBox(messageBoxId, result);
    await messageboxStore.closeMessagebox(messageBoxId);
  }
}
</script>
