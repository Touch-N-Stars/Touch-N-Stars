import { ref } from 'vue';

export function useUnstableRepositoryConfirmation({ canSwitch, onSwitch }) {
  const confirmationStep = ref(0);

  function cancelConfirmation() {
    confirmationStep.value = 0;
  }

  function requestSwitch(channel) {
    if (!canSwitch()) return;
    cancelConfirmation();
    if (channel === 'unstable') {
      confirmationStep.value = 1;
    } else if (channel === 'trixie') {
      onSwitch('trixie');
    }
  }

  function confirmUnstable() {
    if (!canSwitch()) {
      cancelConfirmation();
      return;
    }
    if (confirmationStep.value === 1) {
      confirmationStep.value = 2;
    } else if (confirmationStep.value === 2) {
      cancelConfirmation();
      onSwitch('unstable');
    }
  }

  return { confirmationStep, requestSwitch, confirmUnstable, cancelConfirmation };
}
