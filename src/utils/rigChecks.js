// Checks of the rig state before starting a sequence and before shutting the host down.
//
// Pure functions over the polled device infos, so they can be tested without a store. Each
// returns a list of { key, params } warnings: `key` is the i18n key below
// components.rigChecks, `params` its placeholders. An empty list means nothing to warn about.

import { COOL_CAMERA_TYPE, START_GUIDING_TYPE, UNPARK_SCOPE_TYPE } from './sequenceSimple';

/** Below this the frames of one night may not fit any more. */
export const LOW_DISK_BYTES = 5 * 1024 ** 3;

/** How far the sensor may be off the setpoint before it counts as "not at temperature". */
export const COOLER_TOLERANCE_C = 1.5;

/**
 * Whether the loaded sequence (the /sequence tree, items with FullTypeName and Items) contains an
 * enabled item of this type. Unknown (null) when the tree carries no type names (old plugins).
 */
export function sequenceContains(items, type) {
  let sawType = false;
  const walk = (list) => {
    for (const item of list ?? []) {
      if (typeof item?.FullTypeName === 'string') {
        sawType = true;
        if (item.FullTypeName.split(',')[0].trim() === type && item.Status !== 'DISABLED') {
          return true;
        }
      }
      if (walk(item?.Items)) return true;
    }
    return false;
  };
  if (walk(Array.isArray(items) ? items : [])) return true;
  return sawType ? false : null;
}

const round1 = (value) => Math.round(Number(value) * 10) / 10;

/**
 * Warnings before "Start sequence". A step the sequence does itself (unpark, cool, start
 * guiding) is not warned about.
 *
 * @param {object} rig  { mountInfo, cameraInfo, guiderInfo, safetyInfo }
 * @param {Array} sequenceItems  the loaded sequence tree
 * @param {object|null} imageDisk  { exists, freeBytes } from /preflight/image-disk, or null
 */
export function sequencePreflight(rig, sequenceItems, imageDisk) {
  const warnings = [];
  const { mountInfo = {}, cameraInfo = {}, guiderInfo = {}, safetyInfo = {} } = rig ?? {};

  if (safetyInfo.Connected && safetyInfo.IsSafe === false) {
    warnings.push({ key: 'unsafe', params: {} });
  }

  if (!mountInfo.Connected) {
    warnings.push({ key: 'mountNotConnected', params: {} });
  } else if (mountInfo.AtPark) {
    if (sequenceContains(sequenceItems, UNPARK_SCOPE_TYPE) !== true) {
      warnings.push({ key: 'mountParked', params: {} });
    }
  } else if (mountInfo.TrackingEnabled === false) {
    warnings.push({ key: 'mountNotTracking', params: {} });
  }

  if (!cameraInfo.Connected) {
    warnings.push({ key: 'cameraNotConnected', params: {} });
  } else if (
    cameraInfo.CanSetTemperature &&
    sequenceContains(sequenceItems, COOL_CAMERA_TYPE) !== true
  ) {
    const temperature = Number(cameraInfo.Temperature);
    const setpoint = Number(cameraInfo.TemperatureSetPoint);
    if (!cameraInfo.CoolerOn) {
      warnings.push({ key: 'coolerOff', params: {} });
    } else if (
      Number.isFinite(temperature) &&
      Number.isFinite(setpoint) &&
      Math.abs(temperature - setpoint) > COOLER_TOLERANCE_C
    ) {
      warnings.push({
        key: 'cameraNotAtSetpoint',
        params: { temperature: round1(temperature), setpoint: round1(setpoint) },
      });
    }
  }

  if (!guiderInfo.Connected && sequenceContains(sequenceItems, START_GUIDING_TYPE) === true) {
    warnings.push({ key: 'guiderNotConnected', params: {} });
  }

  if (imageDisk) {
    if (imageDisk.path && imageDisk.exists === false) {
      warnings.push({ key: 'imageFolderMissing', params: { path: imageDisk.path } });
    } else if (Number.isFinite(imageDisk.freeBytes) && imageDisk.freeBytes < LOW_DISK_BYTES) {
      warnings.push({
        key: 'lowDisk',
        params: { free: round1(imageDisk.freeBytes / 1024 ** 3) },
      });
    }
  }

  return warnings;
}

/**
 * What is still running or open before the host is shut down or restarted: shutting down under
 * a running sequence, an unparked mount, a cold camera or an open roof leaves the rig like that
 * until someone gets to it.
 *
 * @param {object} rig  { mountInfo, cameraInfo, domeInfo, flatdeviceInfo }
 * @param {boolean} sequenceRunning
 */
export function shutdownRigCheck(rig, sequenceRunning) {
  const warnings = [];
  const { mountInfo = {}, cameraInfo = {}, domeInfo = {}, flatdeviceInfo = {} } = rig ?? {};

  if (sequenceRunning) warnings.push({ key: 'sequenceRunning', params: {} });
  if (mountInfo.Connected && !mountInfo.AtPark) warnings.push({ key: 'mountUnparked', params: {} });
  if (cameraInfo.Connected && cameraInfo.CanSetTemperature && cameraInfo.CoolerOn) {
    warnings.push({
      key: 'cameraCold',
      params: { temperature: round1(cameraInfo.Temperature ?? 0) },
    });
  }
  if (domeInfo.Connected && domeInfo.ShutterStatus && domeInfo.ShutterStatus !== 'ShutterClosed') {
    warnings.push({ key: 'domeOpen', params: {} });
  }
  if (flatdeviceInfo.Connected && flatdeviceInfo.CoverState === 'Open') {
    warnings.push({ key: 'coverOpen', params: {} });
  }

  return warnings;
}
