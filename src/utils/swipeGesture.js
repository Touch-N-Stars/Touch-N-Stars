// A horizontal drag counts as a swipe once it is this long and clearly more
// sideways than up or down.
export const SWIPE_MIN_PX = 50;
const SWIPE_MIN_RATIO = 2;

/**
 * Which way a finished one-finger drag browses: -1 to the previous item (finger moved
 * right), +1 to the next one (finger moved left), 0 when it was no swipe.
 */
export function swipeStep(dx, dy) {
  if (Math.abs(dx) < SWIPE_MIN_PX) return 0;
  if (Math.abs(dx) < SWIPE_MIN_RATIO * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
