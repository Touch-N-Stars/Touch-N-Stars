<template>
  <Modal :show="show" max-width="max-w-md" @close="$emit('cancel')">
    <template #header>
      <h2 class="text-lg font-bold text-content">{{ title }}</h2>
    </template>
    <template #body>
      <p class="text-sm text-content-muted mb-4">{{ text }}</p>
      <div class="flex gap-2">
        <button class="tns-btn-secondary" @click="$emit('cancel')">
          {{ $t('common.cancel') }}
        </button>
        <button class="tns-btn-primary" @click="$emit('confirm')">
          {{ confirmLabel }}
        </button>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import Modal from '@/components/helpers/Modal.vue';

defineProps({
  show: { type: Boolean, default: false },
  title: { type: String, required: true },
  text: { type: String, required: true },
  confirmLabel: { type: String, required: true },
});

defineEmits(['confirm', 'cancel']);
</script>
