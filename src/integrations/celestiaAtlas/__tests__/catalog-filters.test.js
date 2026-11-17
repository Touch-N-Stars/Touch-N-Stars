import test from 'node:test';
import assert from 'node:assert/strict';
import { passesDeepSkyCatalogFilter } from '@acocalypso/celestia-atlas';
import { buildEmbeddedAtlasCatalog } from '../catalogLayers.js';
import {
  ATLAS_EXTRA_OBJECT_TYPE_KEYS,
  ATLAS_OBJECT_TYPE_LABELS,
  atlasObjectTypeI18nKey,
  buildAtlasCatalogFacets,
  normalizeAtlasFacetSelection,
  toggleAtlasFacetSelection,
} from '../catalogFilters.js';

test('derives normalized type and source facets without merging Abell namespaces', () => {
  const facets = buildAtlasCatalogFacets([
    { typeCode: 'GCluster', catalogueGroups: ['Abell'] },
    { typeCode: 'PN', catalogueGroups: ['abell-pn', 'OpenNGC'] },
    { typeCode: 'PN', catalogSource: 'SIMBAD A66' },
  ]);

  assert.deepEqual(facets.objectTypes, [
    { key: 'gcluster', label: 'Galaxy cluster', count: 1 },
    { key: 'pn', label: 'Planetary nebula', count: 2 },
  ]);
  assert.deepEqual(facets.catalogueGroups, [
    { key: 'abell', label: 'Abell / ACO galaxy clusters', count: 1 },
    { key: 'abell-pn', label: 'Abell planetary nebulae (A66)', count: 1 },
    { key: 'openngc', label: 'OpenNGC', count: 1 },
    { key: 'simbad a66', label: 'simbad a66', count: 1 },
  ]);
  assert.notEqual(facets.catalogueGroups[0].key, facets.catalogueGroups[1].key);
});

test('includes the loaded GCVS search layer in catalogue source controls', () => {
  const facets = buildAtlasCatalogFacets([{ typeCode: 'G', catalogueGroups: ['openngc'] }], {
    rows: [['000001'], ['000002']],
  });
  assert.deepEqual(facets.catalogueGroups, [
    { key: 'gcvs', label: 'GCVS variable stars', count: 2 },
    { key: 'openngc', label: 'OpenNGC', count: 1 },
  ]);
  assert.deepEqual(normalizeAtlasFacetSelection(['openngc'], facets.catalogueGroups), ['openngc']);
});

test('sanitizes persisted selections while preserving all and none semantics', () => {
  const available = [{ key: 'abell' }, { key: 'abell-pn' }, { key: 'openngc' }];

  assert.equal(normalizeAtlasFacetSelection(null, available), null);
  assert.equal(normalizeAtlasFacetSelection(undefined, available), null);
  assert.equal(normalizeAtlasFacetSelection('abell', available), null);
  assert.equal(normalizeAtlasFacetSelection({ key: 'abell' }, available), null);
  assert.deepEqual(normalizeAtlasFacetSelection([], available), []);
  assert.equal(normalizeAtlasFacetSelection(['stale'], available), null);
  assert.deepEqual(
    normalizeAtlasFacetSelection([' ABELL-PN ', 'abell-pn', 'stale', 42], available),
    ['abell-pn']
  );
  assert.equal(normalizeAtlasFacetSelection(['OPENNGC', 'abell-pn', 'Abell'], available), null);
});

test('toggles facets immutably and collapses a complete selection to all', () => {
  const available = ['abell', 'abell-pn', 'openngc'];
  const original = ['abell'];
  const expanded = toggleAtlasFacetSelection(original, 'ABELL-PN', true, available);

  assert.deepEqual(original, ['abell']);
  assert.notStrictEqual(expanded, original);
  assert.deepEqual(expanded, ['abell', 'abell-pn']);
  assert.deepEqual(toggleAtlasFacetSelection(null, 'abell-pn', false, available), [
    'abell',
    'openngc',
  ]);
  assert.deepEqual(toggleAtlasFacetSelection([], 'abell-pn', true, available), ['abell-pn']);
  assert.equal(toggleAtlasFacetSelection(['abell', 'openngc'], 'abell-pn', true, available), null);
  assert.throws(
    () => toggleAtlasFacetSelection(original, 'missing', true, available),
    /Unknown Atlas facet/
  );
});

test('exposes the exact facets and membership counts from every packaged offline layer', async () => {
  const [
    openNgc,
    abellPlanetaryNebulae,
    stellariumSupplement,
    brightSky,
    hygStars,
    westernConstellations,
  ] = await Promise.all([
    import('@acocalypso/celestia-atlas/viewer-catalog-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/abell-pn-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/stellarium-supplement-data', {
      with: { type: 'json' },
    }),
    import('@acocalypso/celestia-atlas/bright-sky-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/hyg-star-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/western-constellation-data', {
      with: { type: 'json' },
    }),
  ]);
  const { catalog } = buildEmbeddedAtlasCatalog({
    openNgc: openNgc.default,
    abellPlanetaryNebulae: abellPlanetaryNebulae.default,
    stellariumSupplement: stellariumSupplement.default,
    brightSky: brightSky.default,
    hygStars: hygStars.default,
    westernConstellations: westernConstellations.default,
  });
  const facets = buildAtlasCatalogFacets(catalog);

  const mergesM8 = stellariumSupplement.default.objects.some((object) =>
    object.mergeKeys?.includes('m:8')
  );
  assert.equal(catalog.length, mergesM8 ? 21_191 : 21_192);
  assert.deepEqual(facets.objectTypes, [
    { key: '*ass', label: 'Stellar association', count: 64 },
    { key: 'cl+n', label: 'Cluster with nebulosity', count: 68 },
    { key: 'doublestar', label: 'Double star', count: 1 },
    { key: 'drkn', label: 'Dark nebula', count: 1_952 },
    { key: 'emn', label: 'Emission nebula', count: 8 },
    { key: 'g', label: 'Galaxy', count: 10_528 },
    { key: 'gcl', label: 'Globular cluster', count: 208 },
    { key: 'gcluster', label: 'Galaxy cluster', count: 5_239 },
    { key: 'ggroup', label: 'Galaxy group', count: 13 },
    { key: 'gpair', label: 'Galaxy pair', count: 231 },
    { key: 'gtrpl', label: 'Galaxy triplet', count: 26 },
    { key: 'hii', label: 'H II region', count: mergesM8 ? 1_174 : 1_175 },
    { key: 'neb', label: 'Nebula', count: 98 },
    { key: 'ocl', label: 'Open cluster', count: 665 },
    { key: 'other', label: 'Deep-sky object', count: 449 },
    { key: 'pn', label: 'Planetary nebula', count: 237 },
    { key: 'rfn', label: 'Reflection nebula', count: 212 },
    { key: 'snr', label: 'Supernova remnant', count: 18 },
  ]);
  assert.deepEqual(facets.catalogueGroups, [
    { key: 'abell', label: 'Abell / ACO galaxy clusters', count: 5_249 },
    { key: 'abell-pn', label: 'Abell planetary nebulae (A66)', count: 86 },
    { key: 'barnard', label: 'Barnard', count: 343 },
    { key: 'lbn', label: 'LBN', count: 1_118 },
    { key: 'ldn', label: 'LDN', count: 1_786 },
    { key: 'messier', label: 'Messier', count: 110 },
    { key: 'openngc', label: 'OpenNGC', count: 12_578 },
    { key: 'rcw', label: 'RCW', count: 186 },
    { key: 'sharpless', label: 'Sharpless 2', count: 316 },
    { key: 'vdb', label: 'vdB', count: 161 },
  ]);
  assert.equal(
    facets.objectTypes.reduce((total, facet) => total + facet.count, 0),
    catalog.length
  );

  const ldn = catalog.find((object) => object.id === 'LDN 1235');
  const abellCluster = catalog.find((object) => object.id === 'Abell 39');
  const abellPlanetary = catalog.find((object) => object.id === 'Abell PN 39');
  assert.equal(passesDeepSkyCatalogFilter(ldn, ['drkn'], ['ldn']), true);
  assert.equal(passesDeepSkyCatalogFilter(ldn, ['drkn'], ['openngc']), false);
  assert.equal(passesDeepSkyCatalogFilter(abellCluster, ['gcluster'], ['abell']), true);
  assert.equal(passesDeepSkyCatalogFilter(abellCluster, ['gcluster'], ['abell-pn']), false);
  assert.equal(passesDeepSkyCatalogFilter(abellPlanetary, ['pn'], ['abell-pn']), true);
  assert.equal(passesDeepSkyCatalogFilter(abellPlanetary, ['pn'], ['abell']), false);
});

test('every object type the target card can show has an English label key', async () => {
  const { readFile } = await import('node:fs/promises');
  const english = JSON.parse(
    await readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8')
  );
  const labels = english.components.celestiaAtlas.object_types;

  for (const typeKey of [
    ...Object.keys(ATLAS_OBJECT_TYPE_LABELS),
    ...ATLAS_EXTRA_OBJECT_TYPE_KEYS,
  ]) {
    const key = atlasObjectTypeI18nKey(typeKey);
    const leaf = key.replace('components.celestiaAtlas.object_types.', '');
    assert.ok(typeof labels[leaf] === 'string' && labels[leaf].trim(), `label for ${typeKey}`);
  }
  assert.equal(atlasObjectTypeI18nKey('*Ass'), 'components.celestiaAtlas.object_types._ass');
  assert.equal(atlasObjectTypeI18nKey(''), '');
});
