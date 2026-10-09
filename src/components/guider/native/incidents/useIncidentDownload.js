import { ref } from 'vue';
import { Capacitor } from '@capacitor/core';
import apiService from '@/services/apiService';
import { useToastStore } from '@/store/toastStore';
import { downloadBlob } from '@/utils/blobDownloader';
import { useIncidentText } from './useIncidentText';

// Only one zip at a time in the native app: it is held in memory until it is saved.
const downloading = ref(null);

/**
 * Saves an incident as pins-incident-<id>.zip. In the browser a plain link lets the browser's
 * download manager stream the zip (it can be tens of MB); the Android/iOS WebView cannot download
 * links reliably, so there it is fetched and written to the app's documents (blobDownloader).
 */
export function useIncidentDownload() {
  const { k } = useIncidentText();
  const toastStore = useToastStore();

  function downloadWithLink(id) {
    const link = document.createElement('a');
    link.href = apiService.getNativeGuiderIncidentDownloadUrl(id);
    link.download = `pins-incident-${id}.zip`;
    // An error answer (JSON) opens in a new tab instead of replacing the app.
    link.target = '_blank';
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function downloadNative(id) {
    downloading.value = id;
    try {
      const blob = await apiService.downloadNativeGuiderIncident(id);
      const result = await downloadBlob(blob, `pins-incident-${id}.zip`, {
        folderName: 'TouchNStars/Incidents',
        fallbackFilename: 'pins-incident.zip',
      });
      toastStore.showToast({
        type: 'success',
        title: k('download'),
        message: k('downloadSaved', { file: result?.path || result?.filename }),
      });
    } catch (error) {
      if (!error?.cancelled) {
        toastStore.showToast({
          type: 'error',
          title: k('downloadFailed'),
          message: error?.message || String(error),
        });
      }
    } finally {
      downloading.value = null;
    }
  }

  async function download(id) {
    if (!id || downloading.value) return;
    if (Capacitor.getPlatform() === 'web') downloadWithLink(id);
    else await downloadNative(id);
  }

  return { downloading, download };
}
