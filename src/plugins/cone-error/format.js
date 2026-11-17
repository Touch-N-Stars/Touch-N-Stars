// Number formatting shared by the result, the history and the shim diagram, so that all three
// show the same values.

/** Arcminutes with an explicit sign, e.g. "+1.23"; "—" when there is no value. */
export function signedArcmin(value) {
  if (typeof value !== 'number') return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

/** Shim thickness rounded to 0.05 mm, the finest step a shim stack realistically has. */
export function shimMm(value) {
  return (Math.round(value * 20) / 20).toFixed(2);
}

/** A pier side the backend reports as "East" or "West", translated; "—" when unknown. */
export function sideLabel(t, side, short = false) {
  if (side !== 'East' && side !== 'West') return side || '—';
  return t(`plugins.coneError.side.${short ? `${side.toLowerCase()}Short` : side}`);
}
