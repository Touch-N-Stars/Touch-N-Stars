import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LIVE_COMET_CATALOG_URL,
  downloadLiveCometCatalog,
  loadCachedCometCatalog,
  saveCachedCometCatalog,
  validateCometCatalogRelease,
} from '../cometCatalog.js';

const payload = {
  meta: {
    schemaVersion: 1,
    generatedAt: '2026-09-08T04:44:33.000Z',
    sourceSha256: 'a'.repeat(64),
    objectCount: 1,
  },
  objects: [
    {
      id: 'comet:1p-halley',
      name: '1P/Halley',
      perihelionTt: 100,
      qAu: 0.58,
      eccentricity: 0.97,
      argumentPerihelionDeg: 112,
      ascendingNodeDeg: 59,
      inclinationDeg: 162,
    },
  ],
};

test('downloads and validates the rolling Atlas comet release through the plugin proxy', async () => {
  let requestedUrl;
  const result = await downloadLiveCometCatalog(async (url) => {
    requestedUrl = url;
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  });
  assert.equal(requestedUrl, LIVE_COMET_CATALOG_URL);
  assert.equal(result.meta.objectCount, 1);
});

test('rejects inconsistent or unsupported comet release envelopes', () => {
  assert.throws(() => validateCometCatalogRelease({ ...payload, objects: [] }), /does not match/);
  assert.throws(
    () => validateCometCatalogRelease({ ...payload, meta: { ...payload.meta, schemaVersion: 2 } }),
    /Unsupported comet schema/
  );
});

test('persists validated comet data and removes corrupt cached data', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  saveCachedCometCatalog(payload, storage);
  assert.deepEqual(loadCachedCometCatalog(storage), payload);
  values.set([...values.keys()][0], '{broken');
  assert.equal(loadCachedCometCatalog(storage), null);
  assert.equal(values.size, 0);
});
