import apiService from '@/services/apiService';
import { useToastStore } from '@/store/toastStore';

/**
 * Sends a dome action and flashes the button green or red. The dome refuses some actions with
 * HTTP 200 and `Success: false` (e.g. StatusCode 409 while the shutter is closing), so the body
 * decides the outcome; a refusal shows the server's reason in a toast.
 */
export async function runDomeAction(action, statusClass, errorTitle) {
  const response = await apiService.domeAction(action);
  if (response?.Success) {
    statusClass.value = 'glow-green';
  } else {
    statusClass.value = 'glow-red';
    useToastStore().showToast({
      type: 'error',
      title: errorTitle,
      message: response?.Error || errorTitle,
    });
  }
  setTimeout(() => {
    statusClass.value = '';
  }, 1000);
  return response;
}
