// Why a star of the guide frame was not used: the guide engine's reject reasons (names of its
// TrackedStarStatus), shown as a sentence instead of the bare name.

/** Reasons that hold for every secondary star of the frame (the guider's state, not the star). */
export const FRAME_WIDE_REASONS = new Set([
  'NotGuiding',
  'Settling',
  'Stabilizing',
  'GuideStarLost',
  'Subframe',
  'MultiStarOff',
]);

/** Reasons that say something is wrong with the star itself. */
const STAR_PROBLEM_REASONS = new Set([
  'Miss',
  'ReferenceReset',
  'Lost',
  'DroppedZero',
  'FallbackRejected',
  'PrimaryLost',
]);

const KNOWN_REASONS = new Set([
  ...FRAME_WIDE_REASONS,
  ...STAR_PROBLEM_REASONS,
  'BeyondMaxStars',
  'Resnapped',
  'NotMeasured',
]);

/** The locale key under `frame.reasons` for a reason, null for one this app doesn't know yet. */
export function reasonKey(reason) {
  return KNOWN_REASONS.has(reason) ? reason : null;
}

/** Whether the reason points at a problem with the star (shown as a warning) rather than the guider's state. */
export function isStarProblem(reason) {
  return STAR_PROBLEM_REASONS.has(reason);
}

/**
 * The reason every secondary star of the frame shares, when it is one that holds for the whole
 * frame (e.g. looping: no secondary star counts); null otherwise.
 */
export function frameWideReason(stars) {
  const secondaries = (stars || []).filter((s) => !s.isPrimary);
  if (secondaries.length === 0) return null;
  const reason = secondaries[0].rejectReason;
  return FRAME_WIDE_REASONS.has(reason) && secondaries.every((s) => s.rejectReason === reason)
    ? reason
    : null;
}
