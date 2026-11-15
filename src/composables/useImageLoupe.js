import { onBeforeUnmount, ref } from 'vue';
import { clientPointToNaturalPoint } from '@/utils/imageGeometry';

const LOUPE_STORAGE_KEY = 'tns:image-loupe-active';
const LOUPE_ZOOM_STORAGE_KEY = 'tns:image-loupe-zoom';
const ZOOM_STEPS = [1, 2, 4];

function getStoredLoupeActive() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(LOUPE_STORAGE_KEY) === 'true';
}

function setStoredLoupeActive(active) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOUPE_STORAGE_KEY, String(active));
}

function getStoredLoupeZoom() {
  if (typeof window === 'undefined') return ZOOM_STEPS[0];
  const raw = Number(window.localStorage.getItem(LOUPE_ZOOM_STORAGE_KEY));
  return ZOOM_STEPS.includes(raw) ? raw : ZOOM_STEPS[0];
}

function setStoredLoupeZoom(factor) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOUPE_ZOOM_STORAGE_KEY, String(factor));
}

export function useImageLoupe({ containerRef, imageRef, imageRotationRef }) {
  const isLoupeActive = ref(getStoredLoupeActive());
  const loupePreview = ref(null);
  const loupeZoomFactor = ref(getStoredLoupeZoom());

  let attachedElement = null;
  let previousTouchAction = '';
  let activePointerId = null;

  const updateFromPointer = (event) => {
    if (!containerRef.value || !imageRef.value) return;

    const point = clientPointToNaturalPoint({
      clientX: event.clientX,
      clientY: event.clientY,
      imageElement: imageRef.value,
      containerElement: containerRef.value,
      imageRotation: imageRotationRef.value,
    });

    if (!point) {
      loupePreview.value = null;
      return;
    }

    loupePreview.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      naturalX: point.naturalX,
      naturalY: point.naturalY,
      naturalWidth: point.naturalWidth,
      naturalHeight: point.naturalHeight,
    };
  };

  const handlePointerDown = (event) => {
    if (!isLoupeActive.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    activePointerId = event.pointerId;
    event.preventDefault();
    event.stopPropagation();

    if (event.target && typeof event.target.setPointerCapture === 'function') {
      try {
        event.target.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture failures (e.g., not supported in some contexts)
      }
    }

    updateFromPointer(event);
  };

  const handlePointerMove = (event) => {
    if (!isLoupeActive.value) return;
    if (activePointerId !== null && event.pointerId !== activePointerId) return;
    if (activePointerId === null) return;

    event.preventDefault();
    updateFromPointer(event);
  };

  const endPointer = (event) => {
    if (activePointerId !== null && event.pointerId !== activePointerId) return;

    if (event.target && typeof event.target.releasePointerCapture === 'function') {
      try {
        event.target.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    }

    activePointerId = null;
    loupePreview.value = null;
  };

  // A long press on an <img> starts a native image drag (Android WebView,
  // ~500ms) or opens the image context menu (Chrome on Android). Both cancel
  // the pointer, so the preview would vanish before the user starts moving.
  const preventNativeLongPress = (event) => {
    event.preventDefault();
  };

  const attachLoupePointerHandlers = (element) => {
    if (!element || attachedElement === element) return;
    detachLoupePointerHandlers();

    // Without touch-action: none the browser takes over the drag as a native
    // pan and fires pointercancel, which closes the preview right away. This
    // used to work only by accident when Panzoom had set it before.
    previousTouchAction = element.style.touchAction;
    element.style.touchAction = 'none';

    element.addEventListener('pointerdown', handlePointerDown, { passive: false });
    element.addEventListener('pointermove', handlePointerMove, { passive: false });
    element.addEventListener('pointerup', endPointer);
    element.addEventListener('pointercancel', endPointer);
    element.addEventListener('pointerleave', endPointer);
    element.addEventListener('dragstart', preventNativeLongPress);
    element.addEventListener('contextmenu', preventNativeLongPress);
    attachedElement = element;
  };

  const detachLoupePointerHandlers = () => {
    if (!attachedElement) return;

    attachedElement.removeEventListener('pointerdown', handlePointerDown);
    attachedElement.removeEventListener('pointermove', handlePointerMove);
    attachedElement.removeEventListener('pointerup', endPointer);
    attachedElement.removeEventListener('pointercancel', endPointer);
    attachedElement.removeEventListener('pointerleave', endPointer);
    attachedElement.removeEventListener('dragstart', preventNativeLongPress);
    attachedElement.removeEventListener('contextmenu', preventNativeLongPress);
    attachedElement.style.touchAction = previousTouchAction;
    attachedElement = null;
    activePointerId = null;
    loupePreview.value = null;
  };

  const setLoupeActive = (active) => {
    isLoupeActive.value = active;
    setStoredLoupeActive(active);
    if (!active) {
      loupePreview.value = null;
      activePointerId = null;
    }
  };

  const toggleLoupe = () => {
    setLoupeActive(!isLoupeActive.value);
  };

  const cycleLoupeZoom = () => {
    const currentIndex = ZOOM_STEPS.indexOf(loupeZoomFactor.value);
    const next = ZOOM_STEPS[(currentIndex + 1) % ZOOM_STEPS.length];
    loupeZoomFactor.value = next;
    setStoredLoupeZoom(next);
  };

  onBeforeUnmount(() => {
    detachLoupePointerHandlers();
  });

  return {
    isLoupeActive,
    loupePreview,
    loupeZoomFactor,
    toggleLoupe,
    setLoupeActive,
    cycleLoupeZoom,
    attachLoupePointerHandlers,
    detachLoupePointerHandlers,
  };
}
