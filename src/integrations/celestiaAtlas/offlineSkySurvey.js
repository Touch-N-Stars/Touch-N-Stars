export const CELESTIA_ATLAS_DATA_PATH = '/celestia-atlas-data';
export const DSS_SURVEY_PATH = '/surveys/dss';
export const DSS_SURVEY_MIN_ORDER = 3;
export const DSS_SURVEY_BASE_ORDER = 4;
export const DSS_SURVEY_MAX_ORDER = 7;

// Average bytes per tile, the same table the plugin server uses for its free-space check
// (DssSurveyService.AverageTileBytes). The server stores the source JPEGs unchanged; the
// values are means of 60 random tiles per order sampled from the STScI mirror (2026-09-14).
export const DSS_SURVEY_AVERAGE_TILE_BYTES = Object.freeze({
  3: 42_000,
  4: 55_000,
  5: 75_000,
  6: 93_000,
  7: 97_000,
});

function normalizeDataBaseUrl(value) {
  return String(value || CELESTIA_ATLAS_DATA_PATH)
    .trim()
    .replace(/\/+$/, '');
}

export function resolveCelestiaAtlasDataBaseUrl({
  native = false,
  protocol = 'http',
  host = '',
  port = '',
  location = globalThis.location,
} = {}) {
  if (!native) return CELESTIA_ATLAS_DATA_PATH;

  const resolvedHost = String(host || location?.hostname || '').trim();
  if (!resolvedHost) throw new Error('The NINA host is required for native Atlas data');
  const resolvedPort = String(port || '').trim();
  const authority = resolvedPort ? `${resolvedHost}:${resolvedPort}` : resolvedHost;
  return `${protocol || 'http'}://${authority}${CELESTIA_ATLAS_DATA_PATH}`;
}

// Average stored bytes per NSNS tile (source PNGs re-encoded to JPEG q85 on the server),
// the same table the plugin server uses (SurveyDefinition.Nsns): means of 40 random tiles
// per order measured on 2026-10-03.
export const NSNS_SURVEY_AVERAGE_TILE_BYTES = Object.freeze({
  3: 68_000,
  4: 78_000,
  5: 92_000,
  6: 81_000,
});

// NSNS covers the sky north of Dec -16 deg only; tile counts per order inside its coverage
// map (Moc.fits of DR0.2). Used for the size estimate before the server reports exact counts.
const NSNS_SURVEY_TILE_COUNTS = Object.freeze({ 3: 528, 4: 2016, 5: 8000, 6: 31872 });

export const DEFAULT_SKY_SURVEY_ID = 'dss';

/**
 * The downloadable Atlas surveys. Each is fetched by the plugin server onto the NINA/PINS
 * host and served from `/celestia-atlas-data/surveys/<id>`; the app never loads tiles from
 * the public survey hosts.
 */
const SKY_SURVEYS = Object.freeze({
  dss: Object.freeze({
    id: 'dss',
    key: 'local-dss-color',
    label: 'DSS Color (offline)',
    path: DSS_SURVEY_PATH,
    minOrder: DSS_SURVEY_MIN_ORDER,
    baseOrder: DSS_SURVEY_BASE_ORDER,
    maxOrder: DSS_SURVEY_MAX_ORDER,
    averageTileBytes: DSS_SURVEY_AVERAGE_TILE_BYTES,
    tileCounts: null,
    credit: 'Digitized Sky Survey — STScI/NASA; colored and HiPS-processed by CDS (CNRS/Unistra).',
    attributionUrl:
      'https://alasky.cds.unistra.fr/MocServer/query?ID=CDS%2FP%2FDSS2%2Fcolor&fmt=html&get=record',
    rightsUrl:
      'https://outerspace.stsci.edu/spaces/MASTDATA/pages/176435492/Photographic+Sky+Surveys',
  }),
  nsns: Object.freeze({
    id: 'nsns',
    key: 'local-nsns-ohs8',
    label: 'NSNS [OIII] / H-alpha / [SII] (offline)',
    path: '/surveys/nsns',
    minOrder: 3,
    baseOrder: 4,
    maxOrder: 6,
    averageTileBytes: NSNS_SURVEY_AVERAGE_TILE_BYTES,
    tileCounts: NSNS_SURVEY_TILE_COUNTS,
    credit:
      'Northern Sky Narrowband Survey DR0.2 — Stefan Ziegenbalg, CC BY-NC-SA 4.0 (doi:10.3847/2515-5172/adfec7).',
    attributionUrl: 'https://www.simg.de/nebulae3/dr0_2',
    rightsUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  }),
});

export const SKY_SURVEY_IDS = Object.freeze(Object.keys(SKY_SURVEYS));

/** A known survey id, falling back to DSS for anything else (old settings, typos). */
export function normalizeSkySurveyId(id) {
  return Object.prototype.hasOwnProperty.call(SKY_SURVEYS, id) ? id : DEFAULT_SKY_SURVEY_ID;
}

export function getSkySurveyDefinition(id) {
  return SKY_SURVEYS[normalizeSkySurveyId(id)];
}

export function resolveSkySurveyUrl(id, dataBaseUrl = CELESTIA_ATLAS_DATA_PATH) {
  return `${normalizeDataBaseUrl(dataBaseUrl)}${getSkySurveyDefinition(id).path}`;
}

export function resolveDssSurveyUrl(dataBaseUrl = CELESTIA_ATLAS_DATA_PATH) {
  return resolveSkySurveyUrl('dss', dataBaseUrl);
}

/** Number of HiPS tiles in one order: 12 base pixels, each split in four per order. */
export function dssSurveyTileCount(order) {
  return 12 * 4 ** order;
}

/** Tiles of one order that exist in a survey (full sky, or inside its coverage). */
export function skySurveyTileCount(id, order) {
  const counts = getSkySurveyDefinition(id).tileCounts;
  return counts?.[order] ?? dssSurveyTileCount(order);
}

/**
 * Estimated download size in bytes for orders `fromOrder`..`toOrder` (inclusive).
 * Used for the size hint per selectable order; the server checks the real free space.
 */
export function estimateSkySurveyBytes(id, fromOrder, toOrder) {
  const definition = getSkySurveyDefinition(id);
  let bytes = 0;
  for (let order = fromOrder; order <= toOrder; order += 1) {
    const perTile = definition.averageTileBytes[order];
    if (!perTile) throw new RangeError(`No size estimate for HiPS order ${order}`);
    bytes += perTile * skySurveyTileCount(id, order);
  }
  return bytes;
}

export function estimateDssSurveyBytes(fromOrder, toOrder) {
  return estimateSkySurveyBytes('dss', fromOrder, toOrder);
}

/** Parse a HiPS `properties` file (key = value lines, `#` comments) into an object. */
export function parseHipsProperties(text) {
  const properties = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    properties[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return properties;
}

/** The advertised `hips_order` of a properties file, or null when absent or invalid. */
export function readHipsOrder(text) {
  const value = parseHipsProperties(text).hips_order;
  if (value === undefined) return null;
  const order = Number(value);
  return Number.isInteger(order) && order >= 0 ? order : null;
}

/**
 * Reads the served `properties` file and returns the installed survey order, or null when
 * no survey is installed (404), the server is unreachable or the file is unusable. The
 * plugin server only advertises orders whose tiles are all present, so the returned value
 * can be used as `maxOrder` directly.
 */
export async function loadSkySurveyOrder(id, dataBaseUrl, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`${resolveSkySurveyUrl(id, dataBaseUrl)}/properties`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const order = readHipsOrder(await response.text());
    return order !== null && order >= getSkySurveyDefinition(id).minOrder ? order : null;
  } catch {
    return null;
  }
}

export function loadDssSurveyOrder(dataBaseUrl, fetchImpl = globalThis.fetch) {
  return loadSkySurveyOrder('dss', dataBaseUrl, fetchImpl);
}

/**
 * Survey source for the Atlas viewer. `maxOrder` is the order the plugin server advertises
 * in `properties`; there is no packaged default, so the caller must know what is installed
 * (see loadSkySurveyOrder).
 */
export function createSkySurveySource(id, dataBaseUrl, maxOrder) {
  const definition = getSkySurveyDefinition(id);
  if (!Number.isInteger(maxOrder) || maxOrder < definition.minOrder) {
    throw new RangeError(
      `${definition.id} survey maxOrder must be an integer >= ${definition.minOrder}`
    );
  }
  return Object.freeze({
    key: definition.key,
    label: definition.label,
    url: resolveSkySurveyUrl(definition.id, dataBaseUrl),
    frame: 'ICRS',
    minOrder: definition.minOrder,
    maxOrder,
    tileWidth: 512,
    format: 'jpg',
    blendStartFovDeg: 170,
    blendFullFovDeg: 130,
    creditLabel: definition.credit,
    attribution: definition.credit,
    attributionUrl: definition.attributionUrl,
    rightsUrl: definition.rightsUrl,
  });
}

export function createDssSkySurveySource(dataBaseUrl, maxOrder) {
  return createSkySurveySource('dss', dataBaseUrl, maxOrder);
}
