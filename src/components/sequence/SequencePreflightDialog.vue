<template>
  <!-- What looks wrong before the start -->
  <Modal :show="warnings.length > 0" max-width="max-w-md" @close="$emit('answer', false)">
    <template #header>
      <h2 class="text-xl font-bold text-status-warn">
        {{ $t('components.rigChecks.preflightTitle') }}
      </h2>
    </template>
    <template #body>
      <div class="w-full flex flex-col gap-4" data-testid="preflight-warnings">
        <ul class="list-disc pl-5 text-sm text-content space-y-1">
          <li v-for="warning in warnings" :key="warning.key">
            {{ $t(`components.rigChecks.${warning.key}`, warning.params) }}
          </li>
        </ul>
        <div class="flex justify-end gap-3">
          <button class="tns-btn-secondary w-auto!" @click="$emit('answer', false)">
            {{ $t('general.cancel') }}
          </button>
          <button
            class="tns-btn-primary w-auto!"
            data-testid="preflight-start-anyway"
            @click="$emit('answer', true)"
          >
            {{ $t('components.rigChecks.startAnyway') }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import Modal from '@/components/helpers/Modal.vue';

defineProps({
  // From useSequencePreflight(): { key, params }
  warnings: { type: Array, required: true },
});
defineEmits(['answer']);
</script>
