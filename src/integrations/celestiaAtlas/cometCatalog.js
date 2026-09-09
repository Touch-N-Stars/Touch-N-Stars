import { validateCometElements } from '@acocalypso/celestia-atlas';

export const LIVE_COMET_CATALOG_URL =
  'https://github.com/acocalypso/celestia_atlas/releases/download/comet-data-live/comets.json';

const CACHE_KEY = 'tns.celestia-atlas.comets';
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function validateCometCatalogRelease(payload) {
  if (!payload || typeof payload !== 'object' || !payload.meta || !Array.isArray(payload.objects)) {
    throw new TypeError('The comet release is missing metadata or objects.');
  }
  if (payload.meta.schemaVersion !== 1) {
    throw new TypeError(`Unsupported comet schema version: ${payload.meta.schemaVersion}`);
  }
  if (!Number.isInteger(payload.meta.objectCount) || payload.meta.objectCount < 1) {
    throw new TypeError('The comet release has an invalid object count.');
  }
  if (payload.meta.objectCount !== payload.objects.length) {
    throw new TypeError('The comet release object count does not match its payload.');
  }
  if (!SHA256_PATTERN.test(payload.meta.sourceSha256 ?? '')) {
    throw new TypeError('The comet release has an invalid source checksum.');
  }
  if (!Number.isFinite(Date.parse(payload.meta.generatedAt))) {
    throw new TypeError('The comet release has an invalid generation time.');
  }
  validateCometElements(payload.objects);
  return payload;
}

export async function downloadLiveCometCatalog(proxyRequest) {
  if (typeof proxyRequest !== 'function')
    throw new TypeError('A proxy request function is required.');
  const body = await proxyRequest(LIVE_COMET_CATALOG_URL);
  const text = typeof body === 'string' ? body : await body.text();
  return validateCometCatalogRelease(JSON.parse(text));
}

export function loadCachedCometCatalog(storage = globalThis.localStorage) {
  try {
    const value = storage?.getItem(CACHE_KEY);
    return value ? validateCometCatalogRelease(JSON.parse(value)) : null;
  } catch {
    storage?.removeItem(CACHE_KEY);
    return null;
  }
}

export function saveCachedCometCatalog(payload, storage = globalThis.localStorage) {
  const validated = validateCometCatalogRelease(payload);
  storage?.setItem(CACHE_KEY, JSON.stringify(validated));
  return validated;
}
