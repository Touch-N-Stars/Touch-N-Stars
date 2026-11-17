// localStorage for per-viewer conveniences (a remembered tab, filter or option). Storage can be
// missing or throw (private mode, blocked site data, tests); then the value is simply not
// remembered and the fallback is used - never an error.

function storageOf(storage) {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

/** The stored string, else `fallback`. */
export function readStored(key, fallback = null, storage) {
  try {
    return storageOf(storage)?.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Stores String(value); does nothing when storage is unavailable. */
export function writeStored(key, value, storage) {
  try {
    storageOf(storage)?.setItem(key, String(value));
  } catch {
    // not remembered without storage
  }
}

/** The stored JSON object, else `fallback` (also for broken or non-object JSON). */
export function readStoredJson(key, fallback = {}, storage) {
  try {
    const raw = storageOf(storage)?.getItem(key);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredJson(key, value, storage) {
  try {
    storageOf(storage)?.setItem(key, JSON.stringify(value));
  } catch {
    // not remembered without storage
  }
}
