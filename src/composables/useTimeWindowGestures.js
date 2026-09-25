import { panView, zoomView } from '@/utils/timeWindow';

export const DRAG_THRESHOLD_PX = 5;
const MIN_PINCH_PX = 24;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;

/** Pointer position relative to an element. */
export function localPoint(element, event) {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

/**
 * Zoom and pan gestures for a plot with a time axis: one pointer drags the
 * view, two pinch it, Ctrl/Cmd + wheel (which is also what a trackpad pinch
 * sends) zooms around the cursor, a horizontal or Shift + wheel pans and a
 * double tap resets. A plain vertical wheel is left to the page.
 *
 * The caller binds the returned handlers to the element; `onWheel` needs a
 * non-passive listener.
 *
 * @param {{
 *   element: () => Element|null,
 *   getView: () => {start: number, end: number},
 *   getBounds: () => {start: number, end: number},
 *   getPlot: () => {left: number, width: number},
 *   onChange: (view: {start: number, end: number}) => void,
 *   onReset: () => void,
 * }} options
 */
export function useTimeWindowGestures({ element, getView, getBounds, getPlot, onChange, onReset }) {
  const pointers = new Map(); // pointerId -> { x, y }
  let gesture = null;
  let lastTap = null;
  let dragEndedAt = 0;

  const fractionAt = (x) => {
    const { left, width } = getPlot();
    return Math.min(1, Math.max(0, (x - left) / width));
  };

  function startGesture() {
    const points = [...pointers.values()];
    if (points.length === 1) {
      gesture = { kind: 'pan', view: { ...getView() }, x: points[0].x, dragging: false };
    } else if (points.length === 2) {
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      // Fingers too close together make the ratio of distances explode
      gesture =
        dist >= MIN_PINCH_PX
          ? {
              kind: 'pinch',
              view: { ...getView() },
              dist,
              x: (points[0].x + points[1].x) / 2,
              dragging: true,
            }
          : null;
    }
  }

  function end(event) {
    pointers.delete(event.pointerId);
    if (gesture?.dragging) dragEndedAt = event.timeStamp;
    if (element()?.hasPointerCapture?.(event.pointerId)) {
      element().releasePointerCapture(event.pointerId);
    }
    gesture = null;
    if (pointers.size === 1) {
      // One finger of a pinch stays down: carry on as a pan
      startGesture();
      gesture.dragging = true;
    }
  }

  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointers.set(event.pointerId, localPoint(element(), event));
    startGesture();
  }

  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    // The button was released outside the element, without a pointerup here
    if (event.pointerType === 'mouse' && event.buttons === 0) return end(event);
    pointers.set(event.pointerId, localPoint(element(), event));
    if (!gesture) return;

    const points = [...pointers.values()];
    const { width } = getPlot();
    const bounds = getBounds();
    if (gesture.kind === 'pinch' && points.length >= 2) {
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const centre = (points[0].x + points[1].x) / 2;
      const factor = gesture.dist / Math.max(dist, MIN_PINCH_PX);
      const zoomed = zoomView(gesture.view, factor, fractionAt(gesture.x), bounds);
      const shift = -((centre - gesture.x) / width) * (zoomed.end - zoomed.start);
      onChange(panView(zoomed, shift, bounds));
    } else if (gesture.kind === 'pan') {
      const dx = points[0].x - gesture.x;
      if (!gesture.dragging) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        gesture.dragging = true;
        // Touch pointers are captured implicitly; the mouse has to be, to keep
        // the drag alive outside the element
        if (event.pointerType === 'mouse') element()?.setPointerCapture?.(event.pointerId);
      }
      const span = gesture.view.end - gesture.view.start;
      onChange(panView(gesture.view, -(dx / width) * span, bounds));
    }
  }

  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    const point = pointers.get(event.pointerId);
    const tapped = event.type === 'pointerup' && pointers.size === 1 && !gesture?.dragging;
    end(event);
    if (!tapped) {
      lastTap = null;
      return;
    }
    // `dblclick` is unreliable in the iOS WebView, so double taps are detected here
    const isDouble =
      lastTap &&
      event.timeStamp - lastTap.time < DOUBLE_TAP_MS &&
      Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < DOUBLE_TAP_PX;
    lastTap = isDouble ? null : { time: event.timeStamp, x: point.x, y: point.y };
    if (isDouble) onReset();
  }

  function onWheel(event) {
    const view = getView();
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const x = localPoint(element(), event).x;
      onChange(zoomView(view, Math.exp(event.deltaY * 0.002), fractionAt(x), getBounds()));
    } else if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // Only a mostly horizontal wheel pans: a vertical scroll drifts sideways a little
      event.preventDefault();
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      onChange(panView(view, delta * ((view.end - view.start) / getPlot().width), getBounds()));
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    /** The click that follows a drag belongs to the drag. */
    isClickAfterDrag: (event) => event.timeStamp - dragEndedAt < 50,
    /** Lets another gesture on the same element (a brush) claim the following click. */
    markDragEnd: (event) => (dragEndedAt = event.timeStamp),
  };
}
