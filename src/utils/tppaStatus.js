// The status lines the TPPA plugin sends are English and fixed (read from
// NINA.Plugins.PolarAlignment.dll). The common ones get a translation key; anything else is
// shown as it comes.
const EXACT = {
  'Capturing new image to solve...': 'capturing',
  'Solving image...': 'solving',
  'Image capture failed. Retrying...': 'captureRetry',
  'Plate solve failed. Retrying...': 'solveRetry',
  'Moving to next point': 'nextPoint',
  'Retrieving first measurement point': 'firstPoint',
  'Retrieving second measurement point': 'secondPoint',
  'Retrieving final measurement point': 'finalPoint',
  'Waiting for mount to stop slewing': 'waitMount',
  'Waiting for dome to synchronize': 'waitDome',
  Settling: 'settling',
};

// Lines that carry a number or name after a fixed start
const PREFIXES = [
  ['Slewing to initial position', 'slewInitial'],
  ['Moving axis by', 'movingAxis'],
  ['Plate solve attempt', 'solveAttempt'],
];

/** Translation key (under components.tppa.status) for a TPPA status line, or null. */
export function tppaStatusKey(status) {
  const text = String(status ?? '').trim();
  if (!text) return null;
  if (EXACT[text]) return EXACT[text];
  const prefix = PREFIXES.find(([start]) => text.startsWith(start));
  return prefix ? prefix[1] : null;
}
