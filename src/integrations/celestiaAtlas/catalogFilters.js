import {
  deepSkyCatalogueGroupKeys,
  deepSkyObjectTypeKey,
  starCatalogueMask,
  STAR_CATALOGUE_BITS,
} from '@acocalypso/celestia-atlas';

const STAR_CATALOGUE_LABELS = {
  curated: 'Named stars',
  hyg: 'HYG / HIP',
  hd: 'Henry Draper (HD)',
  sao: 'SAO',
  wr: 'Wolf-Rayet (WR)',
};

export function buildAtlasStarFacets(stars) {
  const counts = new Map(Object.keys(STAR_CATALOGUE_BITS).map((key) => [key, 0]));
  for (const star of stars) {
    const mask = starCatalogueMask(star);
    for (const [key, bit] of Object.entries(STAR_CATALOGUE_BITS)) {
      if (mask & bit) counts.set(key, counts.get(key) + 1);
    }
  }
  return facetEntries(counts, STAR_CATALOGUE_LABELS);
}

export const ATLAS_OBJECT_TYPE_LABELS = Object.freeze({
  '*ass': 'Stellar association',
  'cl+n': 'Cluster with nebulosity',
  doublestar: 'Double star',
  drkn: 'Dark nebula',
  emn: 'Emission nebula',
  g: 'Galaxy',
  gcl: 'Globular cluster',
  gcluster: 'Galaxy cluster',
  ggroup: 'Galaxy group',
  gpair: 'Galaxy pair',
  gtrpl: 'Galaxy triplet',
  hii: 'H II region',
  neb: 'Nebula',
  ocl: 'Open cluster',
  other: 'Deep-sky object',
  pn: 'Planetary nebula',
  rfn: 'Reflection nebula',
  snr: 'Supernova remnant',
});

export const ATLAS_CATALOGUE_GROUP_LABELS = Object.freeze({
  abell: 'Abell / ACO galaxy clusters',
  'abell-pn': 'Abell planetary nebulae (A66)',
  barnard: 'Barnard',
  lbn: 'LBN',
  ldn: 'LDN',
  messier: 'Messier',
  openngc: 'OpenNGC',
  rcw: 'RCW',
  sharpless: 'Sharpless 2',
  vdb: 'vdB',
});

function canonicalFacetKey(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function facetEntries(counts, labels) {
  return Object.freeze(
    [...counts]
      .sort(([left], [right]) => left.localeCompare(right, 'en-US'))
      .map(([key, count]) =>
        Object.freeze({
          key,
          label: labels[key] ?? key,
          count,
        })
      )
  );
}

function availableFacetKeys(availableFacets) {
  if (!Array.isArray(availableFacets)) {
    throw new TypeError('Available Atlas facets must be an array');
  }

  return [
    ...new Set(
      availableFacets
        .map((facet) => canonicalFacetKey(typeof facet === 'string' ? facet : facet?.key))
        .filter(Boolean)
    ),
  ];
}

/**
 * Derives renderer filter facets from the exact catalogue supplied to Atlas.
 * Keys use the same normalized representation as the public Atlas helpers.
 */
export function buildAtlasCatalogFacets(catalog) {
  if (!Array.isArray(catalog)) throw new TypeError('Atlas catalogue must be an array');

  const objectTypeCounts = new Map();
  const catalogueGroupCounts = new Map();

  for (const object of catalog) {
    const objectType = deepSkyObjectTypeKey(object);
    if (objectType) {
      objectTypeCounts.set(objectType, (objectTypeCounts.get(objectType) ?? 0) + 1);
    }

    for (const catalogueGroup of deepSkyCatalogueGroupKeys(object)) {
      catalogueGroupCounts.set(catalogueGroup, (catalogueGroupCounts.get(catalogueGroup) ?? 0) + 1);
    }
  }

  return Object.freeze({
    objectTypes: facetEntries(objectTypeCounts, ATLAS_OBJECT_TYPE_LABELS),
    catalogueGroups: facetEntries(catalogueGroupCounts, ATLAS_CATALOGUE_GROUP_LABELS),
  });
}

/**
 * Sanitizes persisted allowlists against the facets in the loaded catalogue.
 * `null` means all, while an empty array intentionally means none.
 */
export function normalizeAtlasFacetSelection(value, availableFacets) {
  if (value === null || value === undefined) return null;
  if (!Array.isArray(value)) return null;
  if (value.length === 0) return [];

  const availableKeys = availableFacetKeys(availableFacets);
  const availableSet = new Set(availableKeys);
  const requested = new Set(
    value.map(canonicalFacetKey).filter((key) => key && availableSet.has(key))
  );
  const normalized = availableKeys.filter((key) => requested.has(key));

  if (normalized.length === 0) return null;
  return availableKeys.length > 0 && normalized.length === availableKeys.length ? null : normalized;
}

/**
 * Returns a new allowlist after changing one facet without mutating persisted
 * state. Selecting every available facet collapses back to the future-safe
 * `null` representation.
 */
export function toggleAtlasFacetSelection(value, facetKey, enabled, availableFacets) {
  if (typeof enabled !== 'boolean') throw new TypeError('Facet enabled state must be boolean');

  const availableKeys = availableFacetKeys(availableFacets);
  const key = canonicalFacetKey(facetKey);
  if (!key || !availableKeys.includes(key)) {
    throw new RangeError(`Unknown Atlas facet: ${String(facetKey ?? '')}`);
  }

  const normalized = normalizeAtlasFacetSelection(value, availableKeys);
  const selected = new Set(normalized === null ? availableKeys : normalized);
  if (enabled) selected.add(key);
  else selected.delete(key);

  const next = availableKeys.filter((availableKey) => selected.has(availableKey));
  return next.length === availableKeys.length ? null : next;
}
