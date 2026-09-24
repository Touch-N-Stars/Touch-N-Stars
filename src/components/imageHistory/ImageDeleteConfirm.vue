<template>
  <!-- z-[80]: must sit above the full-size image modal (z-50), which can trigger it. -->
  <Modal :show="pending.length > 0" max-width="max-w-md" z-index="z-[80]" @close="emit('cancel')">
    <template #header>
      <h2 class="text-xl font-bold text-red-400">
        {{
          pending.length === 1
            ? t('components.sequence.imageHistoryDelete.confirmTitle')
            : t('components.sequence.imageHistoryDelete.confirmTitleMany', {
                count: pending.length,
              })
        }}
      </h2>
    </template>
    <template #body>
      <div class="w-full flex flex-col gap-6">
        <p>
          {{
            pending.length === 1
              ? t('components.sequence.imageHistoryDelete.confirmMessage')
              : t('components.sequence.imageHistoryDelete.confirmMessageMany')
          }}
        </p>
        <ul class="text-sm text-gray-300 break-all flex flex-col gap-1">
          <li v-for="item in listed" :key="item.index">
            <span v-if="item.stats?.Filename" class="font-medium text-gray-100">
              {{ item.stats.Filename }}
            </span>
            <span v-if="item.stats?.Date" class="block text-gray-400">
              {{ formatDateTime(item.stats.Date) }}
            </span>
          </li>
          <li v-if="pending.length > listed.length" class="text-gray-400">
            {{
              t('components.sequence.imageHistoryDelete.moreFiles', {
                count: pending.length - listed.length,
              })
            }}
          </li>
        </ul>
        <div class="flex justify-end gap-3">
          <button class="tns-btn-secondary" :disabled="isDeleting" @click="emit('cancel')">
            {{ t('general.cancel') }}
          </button>
          <button
            class="tns-btn-danger"
            :disabled="isDeleting"
            data-testid="image-history-delete-confirm"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import Modal from '@/components/helpers/Modal.vue';

const props = defineProps({
  pending: { type: Array, required: true }, // [{ index, stats }]
  isDeleting: { type: Boolean, default: false },
  progress: { type: Object, default: () => ({ done: 0, total: 0 }) },
});

const emit = defineEmits(['confirm', 'cancel']);
const { t } = useI18n();

const MAX_LISTED = 5;
const listed = computed(() => props.pending.slice(0, MAX_LISTED));

const confirmLabel = computed(() => {
  if (!props.isDeleting) return t('general.delete');
  if (props.progress.total > 1) {
    return t('components.sequence.imageHistoryDelete.deletingProgress', {
      done: props.progress.done,
      total: props.progress.total,
    });
  }
  return t('components.sequence.imageHistoryDelete.deleting');
});

function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? String(dateStr) : date.toLocaleString();
}
</script>
