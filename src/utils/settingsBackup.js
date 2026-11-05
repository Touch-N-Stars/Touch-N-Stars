// Backup and restore of everything Touch-N-Stars keeps in localStorage.
//
// Deliberately a deny-list over the whole storage instead of a curated list of
// keys: settings live in the Pinia persistence plugin, in several plugin stores
// and in about two dozen hand-written keys, and every new plugin adds more. An
// allow-list would go stale silently, while a deny-list only has to name the
// few things that must NOT travel to another device.

export const BACKUP_SCHEMA_VERSION = 1;

// Per-device identities, live connection state and pure caches. Restoring these
// onto a second device would either clone an identity that has to stay unique
// or replay state belonging to the machine the backup came from.
const DENY_EXACT = new Set([
  'tns.pins.network-transition.v1', // in-flight PINS network handover
  'tns.sessionNotifications.cursor.v1', // last rig event this device has seen
  'hardwareDb_installId', // per-device submission identity, must stay unique
  'hardwareDb_submissions', // report tokens tied to that identity - denied with it
  'hardwareDb_knowledgeCache', // cache, refetched on demand
  'tilterIsConnected', // live HocusFocus tilter connection state
  'tilterDevicesList', // device cache of the machine it was scanned on
  'tppaStore', // legacy pre-instance-scoping key, migration source only
  // Override slots for the PINS daemon token. Nothing in the UI writes these
  // today - the shipped default in services/pinsConfig.js is a public device
  // token, not a user secret - but if they ever get used they are host-specific.
  'PINS_API_TOKEN',
  'pinsApiToken',
  'API_TOKEN',
  'apiToken',
]);

// PlateSolvePlus caches its secondary driver list per base URL. TPPA settings
// moved to the backend key-value store (rig-shared, not per device) - the
// instance-scoped key only still exists as a one-time migration source on
// devices that haven't reconnected since the move, and must not be revived by
// a restore.
const DENY_PREFIX = ['psp.secondaryDrivers.v1:', 'tppaStore.settings:'];

export function isBackupKey(key) {
  if (typeof key !== 'string' || key === '') return false;
  if (DENY_EXACT.has(key)) return false;
  return !DENY_PREFIX.some((prefix) => key.startsWith(prefix));
}

/**
 * Snapshot the backup-eligible part of a Web Storage.
 *
 * Values stay raw strings on purpose: not every key holds JSON ('true' for
 * useImperialUnits, a bare number for the loupe zoom), so parsing here would
 * mangle them on the way back out.
 *
 * appVersion is injected rather than imported from @/version: that module
 * imports package.json, which the node --test loader cannot resolve.
 */
export function collectBackupPayload({ storage = localStorage, appVersion = '' } = {}) {
  const entries = {};
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!isBackupKey(key)) continue;
    const value = storage.getItem(key);
    if (value !== null) entries[key] = value;
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion,
    entries,
  };
}

export function buildBackupFilename(date = new Date()) {
  return `tns-backup-${date.toISOString().slice(0, 10)}.json`;
}

/**
 * Write a backup payload back into storage.
 *
 * Additive: keys that exist locally but are absent from the backup are left
 * alone, so a restore never wipes unrelated state. The deny-list is applied
 * here as well - a hand-edited or older backup must not be able to inject an
 * install id or a stale token.
 */
export function applyBackupPayload(payload, storage = localStorage) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Backup file is not a valid Touch-N-Stars backup.');
  }
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error(`Unsupported backup version: ${payload.schemaVersion}`);
  }
  if (!payload.entries || typeof payload.entries !== 'object') {
    throw new Error('Backup file contains no settings.');
  }

  let restored = 0;
  for (const [key, value] of Object.entries(payload.entries)) {
    if (!isBackupKey(key) || typeof value !== 'string') continue;
    storage.setItem(key, value);
    restored += 1;
  }
  return restored;
}

export async function exportSettingsBackup({ appVersion = '' } = {}) {
  // Imported lazily so the pure payload helpers above stay free of the
  // file-saver / Capacitor dependency chain, which cannot load under node --test.
  const { downloadBlob } = await import('@/utils/blobDownloader');

  const payload = collectBackupPayload({ appVersion });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const result = await downloadBlob(blob, buildBackupFilename(), {
    fallbackFilename: 'tns-backup.json',
  });
  return { ...result, keyCount: Object.keys(payload.entries).length };
}

export function importSettingsBackup(jsonText) {
  let payload;
  try {
    payload = JSON.parse(jsonText);
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }
  return applyBackupPayload(payload);
}
