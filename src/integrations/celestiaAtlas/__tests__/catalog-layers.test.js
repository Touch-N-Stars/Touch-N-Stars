import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deepSkyObjectLabel,
  messierDesignation,
  createCatalogSearchIndex,
  searchCatalogIndex,
} from '@acocalypso/celestia-atlas';
import { buildAtlasStarFacets } from '../catalogFilters.js';
import { buildEmbeddedAtlasCatalog } from '../catalogLayers.js';

const fixturePayloads = () => ({
  openNgc: {
    meta: { name: 'OpenNGC', version: 'fixture', catalogueGroups: ['openngc'] },
    objects: [
      {
        id: 'NGC 1',
        name: 'NGC 1',
        raDeg: 1,
        decDeg: 2,
        frame: 'ICRS',
        typeCode: 'G',
        catalogueGroups: ['openngc'],
      },
    ],
  },
  abellPlanetaryNebulae: {
    meta: { name: 'SIMBAD A66', version: 'fixture', catalogueGroups: ['abell-pn'] },
    objects: [
      {
        id: 'Abell PN 1',
        aliases: ['A66 1'],
        mergeKeys: ['NGC 1'],
        coordinates: { raDeg: 1, decDeg: 2, frame: 'ICRS' },
        typeCode: 'PN',
        catalogueGroups: ['abell-pn'],
      },
    ],
  },
  stellariumSupplement: {
    meta: { name: 'Stellarium', version: 'fixture', catalogueGroups: ['ldn'] },
    objects: [
      {
        id: 'LDN 1',
        primaryName: 'LDN 1',
        aliases: ['LDN1'],
        coordinates: { raDeg: 15, decDeg: -3, frame: 'ICRS' },
        objectType: 'Dark nebula',
        catalogueGroups: ['LDN'],
        major: 12,
        minor: 6,
      },
    ],
  },
  brightSky: {
    stars: [{ id: 'Bright 1', name: 'Bright 1', raDeg: 30, decDeg: 4 }],
  },
  hygStars: {
    stars: [{ id: 'HIP 1', name: 'HYG 1', ra: 3, dec: 5, alias: 'Test star' }],
  },
  westernConstellations: {
    vertices: { 1: [45, 5], 2: [46, 6] },
    constellations: [{ iau: 'Tst', name: 'Test', lines: [[1, 2]] }],
  },
});

test('combines and normalizes the packaged Atlas layers without mutating their payloads', () => {
  const payloads = fixturePayloads();
  const snapshots = structuredClone(payloads);
  const result = buildEmbeddedAtlasCatalog(payloads);

  assert.deepEqual(payloads, snapshots);
  assert.equal(result.catalog.length, 2);
  assert.equal(result.stars.length, 2);
  assert.deepEqual(result.constellations, payloads.westernConstellations);

  const merged = result.catalog.find(({ id }) => id === 'NGC 1');
  assert.ok(merged.aliases.includes('Abell PN 1'));
  assert.ok(merged.aliases.includes('A66 1'));
  assert.deepEqual(merged.catalogueGroups, ['openngc', 'abell-pn']);
  assert.equal(Object.hasOwn(merged, 'mergeKeys'), false);

  const ldn = result.catalog.find(({ id }) => id === 'LDN 1');
  assert.equal(ldn.name, 'LDN 1');
  assert.equal(ldn.raDeg, 15);
  assert.equal(ldn.decDeg, -3);
  assert.equal(ldn.frame, 'ICRS');
  assert.equal(ldn.typeCode, 'Dark nebula');
  assert.deepEqual(ldn.catalogueGroups, ['ldn']);
  assert.deepEqual(ldn.angularSizeArcMin, { major: 12, minor: 6 });

  const hyg = result.stars.find(({ id }) => id === 'HIP 1');
  assert.equal(hyg.raDeg, 45);
  assert.equal(hyg.decDeg, 5);
  assert.equal(hyg.frame, 'ICRS');
  assert.equal(hyg.type, 'Star');
  assert.ok(hyg.aliases.includes('Test star'));
});

test('rejects incomplete catalogue payloads before viewer initialization', () => {
  const payloads = fixturePayloads();
  assert.throws(
    () => buildEmbeddedAtlasCatalog({ ...payloads, hygStars: {} }),
    /HYG star catalogue must provide a stars array/
  );
});

test('loads every packaged offline catalogue and keeps the two Abell namespaces distinct', async () => {
  const [
    openNgc,
    abellPlanetaryNebulae,
    stellariumSupplement,
    brightSky,
    hygStars,
    saoCrossIds,
    wrStars,
    westernConstellations,
  ] = await Promise.all([
    import('@acocalypso/celestia-atlas/viewer-catalog-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/abell-pn-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/stellarium-supplement-data', {
      with: { type: 'json' },
    }),
    import('@acocalypso/celestia-atlas/bright-sky-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/hyg-star-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/sao-star-crossids', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/wr-star-data', { with: { type: 'json' } }),
    import('@acocalypso/celestia-atlas/western-constellation-data', {
      with: { type: 'json' },
    }),
  ]);
  const result = buildEmbeddedAtlasCatalog({
    openNgc: openNgc.default,
    abellPlanetaryNebulae: abellPlanetaryNebulae.default,
    stellariumSupplement: stellariumSupplement.default,
    brightSky: brightSky.default,
    hygStars: hygStars.default,
    westernConstellations: westernConstellations.default,
    saoCrossIds: saoCrossIds.default,
    wrStars: wrStars.default,
  });

  assert.equal(result.catalog.length, 21_192);
  assert.equal(result.meta.objectCount, 21_192);
  assert.deepEqual(result.meta.catalogueGroups, [
    'abell',
    'abell-pn',
    'barnard',
    'lbn',
    'ldn',
    'messier',
    'openngc',
    'rcw',
    'sharpless',
    'vdb',
  ]);
  assert.equal(result.stars.length, 9_437);
  const index = createCatalogSearchIndex(result.stars);
  for (const query of ['HD48915', 'SAO151881', 'HIP32349', 'Sirius']) {
    assert.deepEqual(
      searchCatalogIndex(index, query).map((star) => star.name),
      ['Sirius']
    );
  }
  const [wr] = searchCatalogIndex(index, 'WR104');
  assert.equal(wr.name, 'WR 104');
  assert.equal(wr.mag, 13.155);
  const [unknown] = searchCatalogIndex(index, 'WR99');
  assert.equal(unknown.searchOnly, true);
  assert.equal(unknown.mag, undefined);
  const facets = buildAtlasStarFacets(result.stars);
  assert.equal(facets.find((facet) => facet.key === 'wr').count, 518);
  assert.equal(facets.find((facet) => facet.key === 'sao').count, 8845);
  assert.equal(result.constellations.constellations.length, 88);
  assert.equal(result.constellations.meta.segmentCount, 674);
  assert.doesNotMatch(JSON.stringify(result.constellations.constellations), /\.webp|image/i);

  const messierObjects = result.catalog.filter((object) =>
    object.catalogueGroups.includes('messier')
  );
  assert.equal(messierObjects.length, 110);
  assert.deepEqual(
    messierObjects.map(messierDesignation).sort((left, right) => {
      return Number(left.slice(1)) - Number(right.slice(1));
    }),
    Array.from({ length: 110 }, (_, index) => `M${index + 1}`)
  );
  const m40 = result.catalog.find(({ id }) => id === 'M40');
  const m81 = result.catalog.find(({ id }) => id === 'M81');
  const m102 = result.catalog.find(({ id }) => id === 'M102');
  assert.equal(m40.name, 'Winnecke 4');
  assert.equal(m40.typeCode, 'DoubleStar');
  assert.equal(deepSkyObjectLabel(m81), "M81 · Bode's Galaxy");
  assert.equal(deepSkyObjectLabel(m102), 'M102 · Spindle Galaxy');

  const ldn = result.catalog.find(({ id }) => id === 'LDN 1235');
  assert.equal(ldn.typeCode, 'DrkN');
  assert.deepEqual(ldn.catalogueGroups, ['ldn']);
  assert.ok(ldn.aliases.includes('LDN1235'));

  const cluster = result.catalog.find(({ id }) => id === 'Abell 39');
  const planetaryNebula = result.catalog.find(({ id }) => id === 'Abell PN 39');
  assert.equal(cluster.typeCode, 'GCluster');
  assert.deepEqual(cluster.catalogueGroups, ['abell']);
  assert.equal(planetaryNebula.typeCode, 'PN');
  assert.deepEqual(planetaryNebula.catalogueGroups, ['abell-pn']);
  assert.ok(planetaryNebula.aliases.includes('Abell 39'));
  assert.ok(planetaryNebula.aliases.includes('A66 39'));
  assert.notEqual(cluster.uid, planetaryNebula.uid);

  const fulu = result.stars.find(({ name }) => name === 'Fulu');
  assert.equal(fulu.id, 'HIP 2920');
  assert.equal(fulu.catalogSource, 'HYG');
  assert.equal(fulu.raDeg, 9.24282);
  assert.equal(fulu.decDeg, 53.896909);
  assert.equal(fulu.type, 'Star');
});
