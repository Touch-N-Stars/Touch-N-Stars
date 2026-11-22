import apiService from '@/services/apiService';
import { useCameraStore } from '@/store/cameraStore';
import { useImagetStore } from '@/store/imageStore';

// Takes one frame through the camera page's capture path and measures its stars. NINA's image
// history only lists saved frames, so with the snapshot "Save" option off it never sees these;
// the statistics endpoints describe the last capture whether it was saved or not. They carry no
// focuser position, so the focuser is read before and after the frame instead.

const CAPTURE_DONE_TIMEOUT_MS = 90000;
const POLL_MS = 500;
const CAPTURE_IN_PROGRESS = 'Capture already in progress';
// Drivers may stop a step or two short of the requested position.
export const POSITION_TOLERANCE = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readFocuser() {
  const response = await apiService.focusAction('info');
  return response?.Response || {};
}

// PINS keeps the raw-image statistics of every capture (/statistics/full); upstream ninaAPI only
// has /statistics. Within one measurement the same endpoint answers every frame, so the values
// stay comparable.
async function lastFrameStatistics() {
  for (const fetch of [apiService.getCaptureStatisticsFull, apiService.getLastCaptureStatistics]) {
    try {
      const result = await fetch.call(apiService);
      if (result?.Success && result.Response) return result.Response;
    } catch {
      // Not offered by this backend, try the next one.
    }
  }
  throw new Error('noStatistics');
}

export function useFocusFrame() {
  const cameraStore = useCameraStore();
  const imageStore = useImagetStore();

  // The image arrives before NINA has finished the star detection of the capture.
  async function waitForCaptureDone(checkAborted) {
    const deadline = Date.now() + CAPTURE_DONE_TIMEOUT_MS;
    for (;;) {
      checkAborted();
      const result = await apiService.getImageData().catch(() => null);
      if (result?.Response !== CAPTURE_IN_PROGRESS) return;
      if (Date.now() > deadline) throw new Error('timeout');
      await sleep(POLL_MS);
    }
  }

  // Resolves to { hfr, stars, position }. `position` is null when the focuser moved or was
  // moving during the frame, so the frame cannot be tied to one position. A frame without stars
  // counts as HFR 0. Throws 'aborted' (checkAborted), 'noImage' (the camera store has already
  // told the user why), 'timeout' (the capture never finished) or 'noStatistics'.
  async function capture(exposure, gain, checkAborted = () => {}) {
    const before = await readFocuser();
    checkAborted();
    const previousImage = imageStore.imageData;
    await cameraStore.capturePhoto(apiService, exposure, gain);
    checkAborted();
    // capturePhoto() reports its own failures and returns without a new image.
    if (imageStore.imageData === previousImage) throw new Error('noImage');
    await waitForCaptureDone(checkAborted);
    const after = await readFocuser();
    const stats = await lastFrameStatistics();

    const settled =
      !before.IsMoving &&
      !after.IsMoving &&
      Math.abs(Number(after.Position) - Number(before.Position)) <= POSITION_TOLERANCE;
    const position = Number(after.Position);
    return {
      hfr: Number(stats.HFR) || 0,
      stars: Number(stats.Stars) || 0,
      position: settled && Number.isFinite(position) ? position : null,
    };
  }

  return { capture };
}
