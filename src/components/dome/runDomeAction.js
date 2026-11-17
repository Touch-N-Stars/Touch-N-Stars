import apiService from '@/services/apiService';
import { isBackendRefusal, toastBackendError } from '@/utils/backendErrors';

/**
 * Sends a dome action and flashes the button green or red. The dome refuses some actions with
 * HTTP 200 and `Success: false` (e.g. StatusCode 409 while the shutter is closing), so the body
 * decides the outcome; a refusal shows the server's reason in a toast. A request canceled on app
 * resume says nothing about the dome, so it flashes neither colour.
 */
export async function runDomeAction(action, statusClass, errorTitleKey) {
  const response = await apiService.domeAction(action);
  if (response?.Success) {
    statusClass.value = 'glow-green';
  } else if (isBackendRefusal(response)) {
    statusClass.value = 'glow-red';
    toastBackendError(response, errorTitleKey);
  }
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
  return response;
}
