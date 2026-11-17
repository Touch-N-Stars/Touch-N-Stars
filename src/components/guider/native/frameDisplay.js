// Display options shared by the live guide frame and the incident replay, so both offer the same
// stretch levels and remember the same choice.

/** Stretch levels of the backend's auto-stretched JPEG (the `stretch` query parameter). */
export const STRETCH_OPTIONS = [
  { id: 'low', value: 0.1 },
  { id: 'medium', value: 0.2 },
  { id: 'high', value: 0.33 },
];
export const DEFAULT_STRETCH_ID = 'medium';
/** localStorage key of the chosen stretch level (one choice for live view and replay). */
export const STRETCH_STORAGE_KEY = 'nativeGuider.frame.stretch';

/** The stretch value of a level; an unknown (e.g. outdated stored) id gets the default. */
export function stretchValue(id) {
  const option =
    STRETCH_OPTIONS.find((o) => o.id === id) ||
    STRETCH_OPTIONS.find((o) => o.id === DEFAULT_STRETCH_ID);
  return option.value;
}

/** Rendered JPEG widths: a few fixed sizes keep the backend's JPEG cache effective. */
export const FRAME_WIDTHS = [512, 768, 1024, 1536, 2048];

/** The smallest fixed width that covers `needed` device pixels (the largest one otherwise). */
export function frameWidthFor(needed) {
  return FRAME_WIDTHS.find((w) => w >= needed) || FRAME_WIDTHS[FRAME_WIDTHS.length - 1];
}
