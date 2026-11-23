// Flats in the simple mode: the pure decisions behind the "Flats" step of the start page.
// The run itself is the plugin-side flat run (flatassistantStore.startServerRun); these helpers
// only pick its inputs from the rig and the plan and read its status for the step.
import { summarizeTargets } from '@/utils/sequenceSimple';
import { dsoContainerName } from '@/utils/sequenceTargets';
import { isInNight } from '@/utils/simpleMode';

/** Flats per filter the step proposes. */
export const SIMPLE_FLAT_COUNT = 20;

/** The flat assistant mode behind each light source the step offers. */
export const LIGHT_SOURCE_MODES = { panel: 'AutoBrightness', tablet: 'AutoExposure' };

/** Whether a flat panel is connected whose brightness the rig can set. */
export function hasDimmablePanel(flatdeviceInfo) {
  return Boolean(flatdeviceInfo?.Connected) && Number(flatdeviceInfo?.MaxBrightness) > 0;
}

/** 'panel' with a dimmable flat panel, otherwise 'tablet' (tablet, light foil, plain panel). */
export function defaultLightSource(flatdeviceInfo) {
  return hasDimmablePanel(flatdeviceInfo) ? 'panel' : 'tablet';
}

/** Names of the filters the plan's light frames use, in plan order, each once. */
export function planFilterNames(tree) {
  const names = [];
  for (const target of summarizeTargets(tree).targets) {
    for (const row of target.rows) {
      if (!row.enabled || !row.filterName) continue;
      if (row.imageType && row.imageType.toUpperCase() !== 'LIGHT') continue;
      if (!names.includes(row.filterName)) names.push(row.filterName);
    }
  }
  return names;
}

/**
 * The target name the flats are saved under, so they land next to the pictures: the target
 * imaged last (one set of flats per night), before anything was taken the first named one,
 * '' without a named target.
 */
export function flatsTargetName(tree) {
  const named = summarizeTargets(tree).targets.filter((target) =>
    dsoContainerName(target.container)
  );
  if (!named.length) return '';
  const imaged = named.filter((target) => target.rows.some((row) => row.completed > 0));
  return dsoContainerName((imaged.at(-1) ?? named[0]).container);
}

/**
 * One filter's run settings from the profile's flat wizard values, in the shape
 * startServerRun() takes (percentages 0-100). filterId null is a run without a filter wheel:
 * it takes the profile's general flat wizard values.
 */
export function flatFilterConfig(profileInfo, filterId, count = SIMPLE_FLAT_COUNT) {
  const pf =
    filterId === null || filterId === undefined
      ? null
      : profileInfo?.FilterWheelSettings?.FilterWheelFilters?.[filterId]?.FlatWizardFilterSettings;

  if (pf) {
    const cameraGain = profileInfo?.CameraSettings?.Gain ?? 0;
    const cameraOffset = profileInfo?.CameraSettings?.Offset ?? 0;
    return {
      count,
      gain: pf.Gain === -1 ? cameraGain : pf.Gain,
      offset: pf.Offset === -1 ? cameraOffset : pf.Offset,
      binning: pf.Binning?.Name ?? '1x1',
      histogramMean: Math.round(pf.HistogramMeanTarget * 100),
      meanTolerance: Math.round(pf.HistogramTolerance * 100),
      minExposure: pf.MinFlatExposureTime,
      maxExposure: pf.MaxFlatExposureTime,
      brightness: 50,
      exposureTime: 2,
      minBrightness: pf.MinAbsoluteFlatDeviceBrightness,
      maxBrightness: pf.MaxAbsoluteFlatDeviceBrightness,
    };
  }

  const general =
    filterId === null || filterId === undefined ? profileInfo?.FlatWizardSettings : null;
  const percent = (fraction, fallback) =>
    Number.isFinite(Number(fraction)) && fraction !== null
      ? Math.round(Number(fraction) * 100)
      : fallback;
  return {
    count,
    gain: -1,
    offset: -1,
    binning: '1x1',
    histogramMean: percent(general?.HistogramMeanTarget, 50),
    meanTolerance: percent(general?.HistogramTolerance, 10),
    minExposure: 0.01,
    maxExposure: 20,
    brightness: 50,
    exposureTime: 2,
    minBrightness: 0,
    maxBrightness: 32000,
  };
}

/**
 * What the plugin-side flat run means for the step: running, or finished successfully in
 * the given night (every filter got its flats). Reads the /api/flats/status payload.
 */
export function flatsRunState(status, night) {
  const filters = status?.Filters ?? [];
  return {
    running: status?.State === 'Running',
    succeededTonight:
      status?.State === 'Finished' &&
      isInNight(status?.FinishedAt, night) &&
      filters.length > 0 &&
      filters.every((filter) => filter.State === 'success'),
  };
}
