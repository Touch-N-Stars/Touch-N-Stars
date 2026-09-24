import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useImagetStore } from '@/store/imageStore';
import { useToastStore } from '@/store/toastStore';
import { runDeleteBatch } from '@/utils/imageHistoryUtils';

/**
 * Delete flow for image-history entries, shared by the history grid, the last
 * image panel and the full-size modal: request → confirmation dialog
 * (ImageDeleteConfirm.vue) → sequential delete with progress → toast on errors.
 *
 * Items are `{ index, stats }`: the absolute history index for the local
 * bookkeeping (cache, hiding) and the entry itself, whose `Id` addresses the
 * file on the backend.
 */
export function useImageHistoryDelete() {
  const { t } = useI18n();
  const store = apiStore();
  const imageStore = useImagetStore();
  const toastStore = useToastStore();

  // Only the PINS fork of the Advanced API serves the delete action, and only
  // its builds that give every history entry an Id, the key the action needs.
  // Official ninaAPI builds and older PINS builds get no controls at all.
  const canDelete = computed(
    () => store.isPINS && (store.imageHistoryInfo ?? []).some((entry) => Boolean(entry?.Id))
  );

  const pending = ref([]); // items awaiting confirmation
  const isDeleting = ref(false);
  const progress = ref({ done: 0, total: 0 });

  function request(items) {
    if (isDeleting.value) return;
    const list = (Array.isArray(items) ? items : [items]).filter(
      (item) => item && Number.isInteger(item.index) && item.index >= 0 && item.stats?.Id
    );
    pending.value = list;
  }

  function cancel() {
    if (isDeleting.value) return;
    pending.value = [];
  }

  async function deleteOne(item) {
    await imageStore.deleteHistoryImage({ absIdx: item.index, entry: item.stats });
  }

  /**
   * Runs the pending batch. Resolves with `{ deleted, failed }`; the dialog is
   * closed either way and failures are reported with a toast.
   */
  async function confirm() {
    const items = pending.value;
    if (items.length === 0 || isDeleting.value) return { deleted: [], failed: [] };

    isDeleting.value = true;
    progress.value = { done: 0, total: items.length };
    let result;
    try {
      result = await runDeleteBatch(items, deleteOne, {
        onProgress: (done, total) => {
          progress.value = { done, total };
        },
      });
    } finally {
      isDeleting.value = false;
      pending.value = [];
    }

    if (result.failed.length > 0) {
      const first = result.failed[0].error;
      console.error('[imageHistoryDelete] Deleting failed:', result.failed);
      toastStore.showToast({
        type: 'error',
        title: t('components.sequence.imageHistoryDelete.errorTitle'),
        message:
          items.length === 1
            ? describeDeleteError(first)
            : `${t('components.sequence.imageHistoryDelete.partialError', {
                failed: result.failed.length,
                total: items.length,
              })} ${describeDeleteError(first)}`,
      });
    }
    return result;
  }

  function describeDeleteError(error) {
    // 404 means the route itself is missing: an Advanced API without the delete action.
    if (error?.response?.status === 404) {
      return t('components.sequence.imageHistoryDelete.unsupported');
    }
    return (
      error?.response?.data?.Error ||
      error?.message ||
      t('components.sequence.imageHistoryDelete.errorGeneric')
    );
  }

  return { canDelete, pending, isDeleting, progress, request, cancel, confirm };
}
