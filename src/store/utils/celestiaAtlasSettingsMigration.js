// Landscapes shipped under public/celestia-atlas-data/landscapes/.
export const BUNDLED_LANDSCAPE_KEYS = new Set(['gray', 'guereins', 'touchnstars']);

export const createDefaultCelestiaAtlasSettings = () => ({
  constellationsLinesVisible: true,
  azimuthalLinesVisible: false,
  equatorialLinesVisible: false,
  meridianLinesVisible: false,
  eclipticLinesVisible: false,
  atmosphereVisible: true,
  compassVisible: true,
  landscapesVisible: true,
  hideBelowHorizon: true,
  skySurveyVisible: true,
  // First-open offer to download the DSS survey; set once the user declines it.
  dssSurveyOfferDismissed: false,
  landscapeSourceMode: 'default',
  customLandscapeUrl: '',
  customLandscapeKey: 'custom',
  dsosVisible: true,
  starMagnitudeLimit: 6.5,
  starCatalogueGroups: null,
  galaxyMagnitudeLimit: 30,
  deepSkyMagnitudeLimit: 30,
  deepSkyObjectTypes: null,
  deepSkyCatalogueGroups: null,
});

export function canonicalizeCelestiaAtlasDataUrl(value) {
  if (typeof value !== 'string') return value;

  if (value === '/stellarium-data') return '/celestia-atlas-data';
  if (value.startsWith('/stellarium-data/')) {
    return `/celestia-atlas-data/${value.slice('/stellarium-data/'.length)}`;
  }
  if (value === 'stellarium-data') return 'celestia-atlas-data';
  if (value.startsWith('stellarium-data/')) {
    return `celestia-atlas-data/${value.slice('stellarium-data/'.length)}`;
  }

  return value;
}

function migrateGeneratedLandscapeUrl(value, mode, key) {
  const canonicalUrl = canonicalizeCelestiaAtlasDataUrl(value);
  if (mode !== 'custom' || typeof canonicalUrl !== 'string') return canonicalUrl;

  const normalizedKey = String(key || '')
    .trim()
    .toLowerCase();
  if (BUNDLED_LANDSCAPE_KEYS.has(normalizedKey)) return canonicalUrl;

  return canonicalUrl.replace(
    /^(\/?celestia-atlas-data)\/landscapes\/([^/]+)\/?$/,
    '$1/user-landscapes/$2'
  );
}

export function migratePersistedCelestiaAtlasSettings(persistedState) {
  if (!persistedState || typeof persistedState !== 'object' || Array.isArray(persistedState)) {
    return { state: persistedState, migrated: false };
  }

  const legacySettings =
    persistedState.stellarium && typeof persistedState.stellarium === 'object'
      ? persistedState.stellarium
      : null;
  const currentSettings =
    persistedState.celestiaAtlas && typeof persistedState.celestiaAtlas === 'object'
      ? persistedState.celestiaAtlas
      : null;

  if (!legacySettings && !currentSettings) {
    return { state: persistedState, migrated: false };
  }

  const celestiaAtlas = {
    ...createDefaultCelestiaAtlasSettings(),
    ...(legacySettings ?? {}),
    ...(currentSettings ?? {}),
  };
  celestiaAtlas.customLandscapeUrl = migrateGeneratedLandscapeUrl(
    celestiaAtlas.customLandscapeUrl,
    celestiaAtlas.landscapeSourceMode,
    celestiaAtlas.customLandscapeKey
  );

  const state = { ...persistedState, celestiaAtlas };
  delete state.stellarium;

  return {
    state,
    migrated:
      Boolean(legacySettings) ||
      celestiaAtlas.customLandscapeUrl !== currentSettings?.customLandscapeUrl,
  };
}

export function migrateCelestiaAtlasSettingsStorage(storage = globalThis.localStorage) {
  if (!storage) return false;

  const serialized = storage.getItem('settings');
  if (!serialized) return false;

  try {
    const result = migratePersistedCelestiaAtlasSettings(JSON.parse(serialized));
    if (result.migrated) {
      storage.setItem('settings', JSON.stringify(result.state));
    }
    return result.migrated;
  } catch {
    return false;
  }
}
