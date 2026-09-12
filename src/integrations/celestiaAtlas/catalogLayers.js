import { combineCatalogLayers, composeStarCatalog } from '@acocalypso/celestia-atlas';

function requireArray(payload, property, label) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload[property])) {
    throw new TypeError(`${label} must provide a ${property} array`);
  }
  return payload[property];
}

function uniqueStrings(values) {
  return [
    ...new Set(
      values
        .flatMap((value) => (Array.isArray(value) ? value : [value]))
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
    ),
  ];
}

function sourceCatalogueName(source) {
  if (typeof source === 'string') return source;
  return (
    source?.catalogueGroup ||
    source?.catalogue ||
    source?.catalogueName ||
    source?.catalogName ||
    source?.sourceCatalogue ||
    source?.sourceName ||
    source?.name ||
    source?.group
  );
}

function catalogueGroupsFor(object) {
  const canonicalGroups = (values) =>
    uniqueStrings(values).map((value) => value.toLocaleLowerCase('en-US'));
  const explicitGroups = canonicalGroups(object.catalogueGroups ?? object.catalogGroups ?? []);
  if (explicitGroups.length) return explicitGroups;
  const sources = Array.isArray(object.sources)
    ? object.sources
    : object.sources
      ? [object.sources]
      : [];
  return canonicalGroups([
    sources.map(sourceCatalogueName),
    object.catalogueSource,
    object.catalogSource,
  ]);
}

function normalizeDeepSkyObject(object) {
  const raDeg = Number.isFinite(object.raDeg)
    ? object.raDeg
    : Number.isFinite(object.coordinates?.raDeg)
      ? object.coordinates.raDeg
      : object.ra * 15;
  const decDeg = Number.isFinite(object.decDeg)
    ? object.decDeg
    : Number.isFinite(object.coordinates?.decDeg)
      ? object.coordinates.decDeg
      : object.dec;
  return {
    ...object,
    name: object.name || object.primaryName || object.id,
    raDeg,
    decDeg,
    frame: object.frame || object.coordinates?.frame || 'ICRS',
    typeCode: object.typeCode || object.objectType || object.type,
    catalogueGroups: catalogueGroupsFor(object),
    angularSizeArcMin: object.angularSizeArcMin ?? {
      major: object.major,
      minor: object.minor,
    },
  };
}

export function buildEmbeddedAtlasCatalog({
  openNgc,
  abellPlanetaryNebulae,
  stellariumSupplement,
  brightSky,
  hygStars,
  saoCrossIds = { crossIds: [] },
  wrStars = { stars: [] },
  westernConstellations,
}) {
  const openNgcObjects = requireArray(openNgc, 'objects', 'OpenNGC catalogue');
  const abellObjects = requireArray(
    abellPlanetaryNebulae,
    'objects',
    'Abell planetary-nebula catalogue'
  );
  const supplementObjects = requireArray(
    stellariumSupplement,
    'objects',
    'Stellarium DSO supplement'
  );
  const brightStars = requireArray(brightSky, 'stars', 'Bright-sky catalogue');
  const hygStarObjects = requireArray(hygStars, 'stars', 'HYG star catalogue');
  if (!westernConstellations || !Array.isArray(westernConstellations.constellations))
    throw new TypeError('Western constellation catalogue must provide a constellations array');

  const withAbellPlanetaryNebulae = combineCatalogLayers(
    openNgcObjects,
    abellObjects,
    openNgc.meta ?? {},
    abellPlanetaryNebulae.meta ?? {}
  );
  const layeredCatalog = combineCatalogLayers(
    withAbellPlanetaryNebulae.objects,
    supplementObjects,
    withAbellPlanetaryNebulae.meta,
    stellariumSupplement.meta ?? {}
  );

  return {
    catalog: layeredCatalog.objects.map(normalizeDeepSkyObject),
    stars: composeStarCatalog({
      curated: brightStars,
      hyg: hygStarObjects,
      curatedCrossIds: hygStars.curatedCrossIds ?? [],
      hygSearch: hygStars.searchStars ?? [],
      sao: requireArray(saoCrossIds, 'crossIds', 'SAO cross-identifiers'),
      wr: requireArray(wrStars, 'stars', 'Wolf-Rayet catalogue'),
    }),
    constellations: westernConstellations,
    meta: layeredCatalog.meta,
  };
}
