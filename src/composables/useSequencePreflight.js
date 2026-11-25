// The rig check before a sequence starts, shared by the plan page and the simple mode's start
// page. Silent when everything looks fine; otherwise SequencePreflightDialog shows the warnings
// and the user decides. It never blocks: many sequences unpark, cool and guide by themselves.
import { onBeforeUnmount, ref } from 'vue';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { sequencePreflight } from '@/utils/rigChecks';

export function useSequencePreflight() {
  const store = apiStore();
  // The dialog is open while the list is not empty.
  const preflightWarnings = ref([]);
  let resolver = null;

  function answerPreflight(start) {
    preflightWarnings.value = [];
    resolver?.(start);
    resolver = null;
  }

  /** Whether to start: true without warnings, otherwise the user's answer. */
  async function confirmPreflight(sequenceItems) {
    const imageDisk = await apiService.fetchImageDisk().catch(() => null);
    const warnings = sequencePreflight(
      {
        mountInfo: store.mountInfo,
        cameraInfo: store.cameraInfo,
        guiderInfo: store.guiderInfo,
        safetyInfo: store.safetyInfo,
      },
      sequenceItems,
      imageDisk
    );
    if (warnings.length === 0) return true;
    answerPreflight(false);
    return new Promise((resolve) => {
      resolver = resolve;
      preflightWarnings.value = warnings;
    });
  }

  // Leaving the page is a "no": the caller must not wait forever.
  onBeforeUnmount(() => answerPreflight(false));

  return { preflightWarnings, answerPreflight, confirmPreflight };
}
