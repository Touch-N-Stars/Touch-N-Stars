import { ref } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { parseJobIdFromResponse, pollJobUntilFinished } from './pinsJobPolling';

export function usePinsRepository({ t, status, pinsStore, appendLog, refreshPackages }) {
  const repository = ref(null);
  const repositoryLoading = ref(false);
  const repositorySwitching = ref(false);
  const repositoryError = ref('');

  function errorMessage(error) {
    if ([404, 503].includes(error.response?.status)) {
      return t('plugins.pins.repositoryUnavailable');
    }
    return error.response?.data?.detail || error.message;
  }

  async function loadRepository() {
    if (repositoryLoading.value) return;
    repositoryLoading.value = true;
    try {
      repository.value = await apiPinsService.getPinsRepository();
      repositoryError.value = '';
    } catch (error) {
      repository.value = null;
      repositoryError.value = errorMessage(error);
    } finally {
      repositoryLoading.value = false;
    }
  }

  async function switchRepository(channel) {
    if (status.value === 'Running' || repositorySwitching.value) return;
    repositorySwitching.value = true;
    repositoryError.value = '';
    status.value = 'Running';
    pinsStore.setActiveOperation('repository');
    appendLog(t('plugins.pins.repositorySwitching'));
    let failure = '';
    try {
      const response = await apiPinsService.setPinsRepository(channel);
      const jobId = parseJobIdFromResponse(response);
      if (!jobId) throw new Error(t('plugins.pins.repositorySwitchFailed'));
      const result = await pollJobUntilFinished(jobId);
      if (!result.success) throw new Error(t('plugins.pins.repositorySwitchFailed'));
      status.value = 'Success';
      appendLog(t('plugins.pins.repositorySwitched'));
    } catch (error) {
      status.value = 'Failed';
      failure = errorMessage(error);
      appendLog(failure);
    } finally {
      // Read the actual configuration on success and after a rolled-back failure.
      await loadRepository();
      if (failure) repositoryError.value = failure;
      try {
        await refreshPackages();
      } finally {
        repositorySwitching.value = false;
      }
    }
  }

  return {
    repository,
    repositoryLoading,
    repositorySwitching,
    repositoryError,
    loadRepository,
    switchRepository,
  };
}
