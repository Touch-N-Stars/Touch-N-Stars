// Helpers for reading the DSO targets out of a /sequence/current tree.
//
// The tree the plugin server returns looks like this:
//   [ { GlobalTriggers }, StartAreaContainer, TargetAreaContainer, EndAreaContainer ]
// and the DSO containers live inside the TargetAreaContainer.

export const DSO_CONTAINER_TYPE = 'NINA.Sequencer.Container.DeepSkyObjectContainer';
export const TARGET_AREA_CONTAINER_TYPE = 'NINA.Sequencer.Container.TargetAreaContainer';

/**
 * All DSO containers in sequence order.
 *
 * A DSO container is collected but not descended into -- this mirrors what
 * `sequence/set-target` addresses via GetAllTargetsInAdvancedSequence(), so the position
 * in this list is the `index` that endpoint expects.
 */
export function collectDsoContainers(items) {
  const result = [];
  const walk = (list) => {
    for (const item of list ?? []) {
      if (item?.FullTypeName === DSO_CONTAINER_TYPE) {
        result.push(item);
      } else {
        walk(item?.Items);
      }
    }
  };
  walk(items);
  return result;
}

/** The container new targets are added to when the sequence has none yet. */
export function findTargetAreaContainer(items) {
  for (const item of items ?? []) {
    if (item?.FullTypeName === TARGET_AREA_CONTAINER_TYPE) return item;
    const found = findTargetAreaContainer(item?.Items);
    if (found) return found;
  }
  return null;
}

/**
 * The API returns Target as a string:
 * "RA: 00:42:44; Dec: 41° 16' 07\"; Epoch: J2000; Position Angle: 0"
 * An object is passed through untouched (future-proof), anything unparsable yields null.
 */
export function parseDsoTargetString(target, name = '') {
  if (!target) return null;
  if (typeof target !== 'string') return target;
  const raMatch = target.match(/RA:\s*(\d+):(\d+):([\d.]+)/);
  const decMatch = target.match(/Dec:\s*(-?)(\d+)°\s*(\d+)'\s*([\d.]+)"/);
  const paMatch = target.match(/Position Angle:\s*([\d.-]+)/);
  if (!raMatch || !decMatch) return null;
  return {
    RAHours: parseInt(raMatch[1]),
    RAMinutes: parseInt(raMatch[2]),
    RASeconds: parseFloat(raMatch[3]),
    NegativeDec: decMatch[1] === '-',
    DecDegrees: parseInt(decMatch[2]),
    DecMinutes: parseInt(decMatch[3]),
    DecSeconds: parseFloat(decMatch[4]),
    PositionAngle: paMatch ? parseFloat(paMatch[1]) : 0,
    TargetName: name,
  };
}

/** Sexagesimal parts of a DSO container, from either the string or the object form. */
export function dsoContainerCoordinates(item) {
  const target = item?.Target;
  if (target && typeof target === 'object') return target.InputCoordinates ?? {};
  return parseDsoTargetString(target, item?.Name ?? '') ?? {};
}

/** Zero-padded "HH:MM:SS" for a DSO container, or '' when it carries no coordinates. */
export function dsoContainerRaString(item) {
  const co = dsoContainerCoordinates(item);
  if (!co.RAHours && co.RAHours !== 0) return '';
  return [co.RAHours, co.RAMinutes, Math.round(co.RASeconds)]
    .map((v) => String(v).padStart(2, '0'))
    .join(':');
}

/** Zero-padded "+DD°MM'SS\"" for a DSO container, or '' when it carries no coordinates. */
export function dsoContainerDecString(item) {
  const co = dsoContainerCoordinates(item);
  if (!co.DecDegrees && co.DecDegrees !== 0) return '';
  const sign = co.NegativeDec || (co.DecDegrees ?? 0) < 0 ? '-' : '+';
  const deg = String(Math.abs(co.DecDegrees)).padStart(2, '0');
  const min = String(co.DecMinutes).padStart(2, '0');
  const sec = String(Math.round(co.DecSeconds)).padStart(2, '0');
  return `${sign}${deg}°${min}'${sec}"`;
}

// Names NINA gives a DSO container before it has a target (its instruction set's type name).
export const DEFAULT_CONTAINER_NAMES = [
  'Deep Sky Object Instruction Set',
  'DeepSkyObjectContainer',
];

/** The object name of a DSO container, or '' while it carries NINA's type name. */
export function dsoContainerName(item) {
  const name = item?.Target?.TargetName || item?.Name;
  return name && !DEFAULT_CONTAINER_NAMES.includes(name) ? name : '';
}

/** Declination of a DSO container in degrees, or null when it carries no coordinates. */
export function dsoContainerDecDegrees(item) {
  const co = dsoContainerCoordinates(item);
  if (!Number.isFinite(co.DecDegrees)) return null;
  const abs = Math.abs(co.DecDegrees) + (co.DecMinutes ?? 0) / 60 + (co.DecSeconds ?? 0) / 3600;
  return co.NegativeDec || co.DecDegrees < 0 ? -abs : abs;
}

/** Right ascension of a DSO container in degrees, or null when it carries no coordinates. */
export function dsoContainerRaDegrees(item) {
  const co = dsoContainerCoordinates(item);
  if (!Number.isFinite(co.RAHours)) return null;
  return (co.RAHours + (co.RAMinutes ?? 0) / 60 + (co.RASeconds ?? 0) / 3600) * 15;
}

/**
 * Whether a DSO container was given a target. A fresh container holds NINA's type name and
 * RA 0 / Dec 0; a target set from the atlas, a search or by hand changes at least one of them.
 */
export function dsoContainerHasTarget(item) {
  if (dsoContainerName(item)) return true;
  const ra = dsoContainerRaDegrees(item);
  const dec = dsoContainerDecDegrees(item);
  return (ra !== null && ra !== 0) || (dec !== null && dec !== 0);
}
