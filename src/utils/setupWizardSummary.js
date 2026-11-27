// The closing card of the setup assistant: what is really set up, per area, instead of a fixed
// "everything is configured" text that was wrong whenever a step had been skipped.
import { hasProfileLocation } from '@/utils/profileLocation';

const NO_DEVICE = ['', 'No_Device', 'No_Guider'];

function hasDevice(id) {
  return typeof id === 'string' && !NO_DEVICE.includes(id);
}

/**
 * @param {object} p
 * @param {object} p.profileInfo store.profileInfo
 * @param {boolean} p.isPINS
 * @param {boolean|null} p.databaseInstalled a star database is installed (null = unknown)
 * @returns {{ id: string, stepId: string, status: 'ok'|'warn'|'none' }[]}
 *   ok = set up; warn = missing and needed for a night; none = optional and not there
 */
export function wizardSummary({ profileInfo, isPINS, databaseInstalled }) {
  const p = profileInfo ?? {};
  const device = (section, key = 'Id') => hasDevice(p[section]?.[key]);
  const required = (ok) => (ok ? 'ok' : 'warn');
  const optional = (ok) => (ok ? 'ok' : 'none');

  const items = [
    { id: 'mount', stepId: 'mount', status: required(device('TelescopeSettings')) },
    { id: 'location', stepId: 'location', status: required(hasProfileLocation(p)) },
    {
      id: 'telescope',
      stepId: 'telescope',
      status: required(Number(p.TelescopeSettings?.FocalLength) > 0),
    },
    { id: 'camera', stepId: 'camera', status: required(device('CameraSettings')) },
    { id: 'focuser', stepId: 'focuser', status: optional(device('FocuserSettings')) },
    { id: 'filterWheel', stepId: 'filterWheel', status: optional(device('FilterWheelSettings')) },
    { id: 'flatPanel', stepId: 'flatPanel', status: optional(device('FlatDeviceSettings')) },
  ];
  if (isPINS) {
    items.push({
      id: 'guider',
      stepId: 'guider',
      status: optional(device('GuiderSettings', 'GuiderName')),
    });
    if (databaseInstalled !== null && databaseInstalled !== undefined) {
      items.push({
        id: 'starDatabase',
        stepId: 'starDatabase',
        status: required(databaseInstalled),
      });
    }
  }
  return items;
}
