import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';

test('loads Celestia Atlas as the only sky renderer', async () => {
  const app = await readFile(new URL('../../../App.vue', import.meta.url), 'utf8');

  assert.match(
    app,
    /defineAsyncComponent\(\(\) => import\('\.\/views\/CelestiaAtlasView\.vue'\)\)/
  );
  assert.doesNotMatch(app, /VITE_STELLARIUM_ROLLBACK/);
  assert.doesNotMatch(app, /StellariumView\.vue/);
  assert.doesNotMatch(app, /VITE_CELESTIA_ATLAS_POC/);
  await assert.rejects(readFile(new URL('../../../views/StellariumView.vue', import.meta.url)));
  await assert.rejects(readFile(new URL('../../../store/stellariumStore.js', import.meta.url)));
});

test('connects the existing display settings through the host-managed Atlas adapter', async () => {
  const [view, settings, settingsStore, settingsMigration] = await Promise.all([
    readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../components/celestiaAtlas/CelestiaAtlasSettings.vue', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../../../store/settingsStore.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../store/utils/celestiaAtlasSettingsMigration.js', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(
    view,
    /<CelestiaAtlasSettings[\s\S]*:catalog-object-types="catalogFacets\.objectTypes"[\s\S]*:catalogue-groups="catalogFacets\.catalogueGroups"/
  );
  assert.doesNotMatch(settings, /rendererManaged|useStellariumStore|refresh-stellarium/);
  assert.match(settingsStore, /celestiaAtlas: createDefaultCelestiaAtlasSettings\(\)/);
  assert.match(settingsMigration, /hideBelowHorizon: true/);
  assert.match(settings, /settingsStore\.celestiaAtlas\.hideBelowHorizon !== false/);
  assert.match(view, /hideBelowHorizon: settingsStore\.celestiaAtlas\.hideBelowHorizon !== false/);
  assert.match(view, /calculateCameraFieldOfView/);
  assert.match(view, /CameraSettings\?\.PixelSize/);
  assert.match(view, /TelescopeSettings\?\.FocalLength/);
  assert.match(view, /FramingAssistantSettings\?\.CameraWidth/);
  assert.match(view, /FramingAssistantSettings\?\.CameraHeight/);
  assert.match(view, /rotationDeg: Number\(framingStore\.rotationAngle \?\? 0\)/);
  assert.match(view, /rotationConvention: ATLAS_POSITION_ANGLE_CONVENTION/);
  assert.doesNotMatch(view, /computeCameraFovDeg/);
  assert.match(view, /starMagnitudeLimit: normalizeAtlasMagnitudeLimit/);
  assert.match(view, /galaxyMagnitudeLimit: normalizeAtlasMagnitudeLimit/);
  assert.match(view, /deepSkyMagnitudeLimit: normalizeAtlasMagnitudeLimit/);
  const viewerCreation = view.indexOf('viewer = createCelestiaAtlasViewer({');
  const horizontalMode = view.indexOf("viewer.setCoordinateMode('horizontal')");
  const savedViewRestore = view.indexOf('const savedView = sessionStorage.getItem');
  assert.ok(
    viewerCreation >= 0 && viewerCreation < horizontalMode && horizontalMode < savedViewRestore
  );
});

test('shows selected-target images through the shared Framing Assistant cache', async () => {
  const selectedObject = await readFile(
    new URL('../../../components/celestiaAtlas/SelectedObject.vue', import.meta.url),
    'utf8'
  );

  assert.match(selectedObject, /apiService\.searchTargetPic\(/);
  assert.match(selectedObject, /Number\(framingStore\.width\) \|\| 200/);
  assert.match(selectedObject, /Number\(framingStore\.height\) \|\| 200/);
  assert.match(selectedObject, /Number\(framingStore\.fov\) \|\| 5/);
  assert.match(selectedObject, /props\.selectedObjectDecDeg,\s*true/);
  assert.match(selectedObject, /URL\.revokeObjectURL/);
  assert.match(selectedObject, /targetPreviewHasContent/);
  assert.match(selectedObject, /document\.createElement\('canvas'\)/);
  assert.match(selectedObject, /v-if="targetPreviewUrl"/);
});

test('uses app-owned photographic survey data without any public online tile source', async () => {
  const [view, settings, about, settingsMigration, offlineSurvey, packageJson, vite] =
    await Promise.all([
      readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
      readFile(
        new URL('../../../components/celestiaAtlas/CelestiaAtlasSettings.vue', import.meta.url),
        'utf8'
      ),
      readFile(
        new URL('../../../components/celestiaAtlas/CelestiaAtlasAbout.vue', import.meta.url),
        'utf8'
      ),
      readFile(
        new URL('../../../store/utils/celestiaAtlasSettingsMigration.js', import.meta.url),
        'utf8'
      ),
      readFile(new URL('../offlineSkySurvey.js', import.meta.url), 'utf8'),
      readFile(new URL('../../../../package.json', import.meta.url), 'utf8'),
      readFile(new URL('../../../../vite.config.js', import.meta.url), 'utf8'),
    ]);

  assert.match(settingsMigration, /skySurveyVisible: true/);
  assert.match(view, /skySurvey: settingsStore\.celestiaAtlas\.skySurveyVisible !== false/);
  assert.match(view, /milkyWay: false/);
  assert.match(view, /cardinals: true/);
  assert.match(view, /milkyWayPanoramaUrl: null/);
  assert.match(view, /settingsStore\.celestiaAtlas\.skySurveyVisible/);
  assert.match(view, /skySurveySource: createDssSkySurveySource\(atlasDataBaseUrl\(\)\)/);
  assert.match(view, /native: Capacitor\.isNativePlatform\(\)/);
  assert.match(view, /host: settingsStore\.connection\.ip/);
  assert.match(view, /port: settingsStore\.connection\.port/);
  assert.match(offlineSurvey, /CELESTIA_ATLAS_DATA_PATH = '\/celestia-atlas-data'/);
  assert.match(offlineSurvey, /createDssSkySurveySource/);
  assert.match(offlineSurvey, /minOrder: 3/);
  assert.match(offlineSurvey, /maxOrder: 4/);
  assert.match(offlineSurvey, /blendStartFovDeg: 170/);
  assert.match(offlineSurvey, /blendFullFovDeg: 130/);
  assert.doesNotMatch(offlineSurvey, /url:\s*'https?:\/\//);
  assert.match(packageJson, /EXCLUDE_CELESTIA_ATLAS_DATA=true/);
  assert.match(vite, /celestiaAtlasDataExclude/);
  assert.match(vite, /'celestia-atlas-data'/);
  assert.match(settings, /sky_survey_visible/);
  assert.match(settings, /sky_survey_hint/);
  assert.match(settings, /settingsStore\.celestiaAtlas\.skySurveyVisible !== false/);
  assert.match(view, /:deep\(\.celestia-atlas-survey-credit\)/);
  assert.match(view, /display: none !important/);
  assert.match(view, /<CelestiaAtlasAbout/);
  assert.match(about, /Photographic sky survey/);
  assert.match(about, /STScI\/NASA/);
  assert.match(about, /does not fetch\s+public survey tiles/);
  assert.match(view, /\.celestia-atlas-portrait\s*{[\s\S]*top: 5rem/);

  const localeDirectory = new URL('../../../locales/', import.meta.url);
  const localeFiles = (await readdir(localeDirectory)).filter((name) => name.endsWith('.json'));
  assert.ok(localeFiles.length > 1);
  for (const localeFile of localeFiles) {
    const locale = JSON.parse(await readFile(new URL(localeFile, localeDirectory), 'utf8'));
    const messages = locale.components.celestiaAtlas.settings;
    assert.ok(messages.sky_survey_visible?.trim(), `${localeFile} is missing the survey label`);
    assert.ok(messages.sky_survey_hint?.trim(), `${localeFile} is missing the survey hint`);
  }

  const english = JSON.parse(await readFile(new URL('en.json', localeDirectory), 'utf8'));
  const hint = english.components.celestiaAtlas.settings.sky_survey_hint;
  assert.match(hint, /packaged/i);
  assert.match(hint, /DSS/i);
  assert.match(hint, /offline/i);
  assert.match(hint, /never fetches/i);
});

test('keeps mobile Atlas controls touch-sized and above the shared status bar', async () => {
  const [view, settings] = await Promise.all([
    readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../components/celestiaAtlas/CelestiaAtlasSettings.vue', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(
    view,
    /:deep\(\.celestia-atlas-icon-button\)\s*{[\s\S]*width: var\(--spacing-touch\)/
  );
  assert.match(view, /\.celestia-atlas-controls\s*{[\s\S]*bottom: var\(--above-statusbar\)/);
  assert.match(view, /\.celestia-atlas-mount-controls\s*{[\s\S]*bottom: var\(--above-statusbar\)/);
  assert.match(view, /\.celestia-atlas-clock\s*{[\s\S]*bottom: var\(--above-statusbar\)/);
  assert.match(view, /<PauseIcon v-else/);
  assert.match(view, /<PlayIcon v-if="clockPaused"/);
  assert.match(view, /<ViewfinderCircleIcon/);
  assert.match(view, /<ArrowPathIcon/);
  assert.match(settings, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(settings, /grid min-h-24/);
  assert.match(settings, /break-words whitespace-normal/);
  assert.match(settings, /@click="\$emit\('refresh-comets'\)"/);
  assert.match(settings, /cometRefreshState === 'loading'/);
  assert.match(view, /@refresh-comets="refreshCometData"/);
  assert.doesNotMatch(view, /aria-label="Refresh comet data"/);
  assert.match(view, /@media \(max-width: 390px\)[\s\S]*var\(--spacing-touch\)/);
});

test('localizes the contextual comet refresh settings for every supported locale', async () => {
  const localeDirectory = new URL('../../../locales/', import.meta.url);
  const localeFiles = (await readdir(localeDirectory)).filter((name) => name.endsWith('.json'));
  const requiredKeys = [
    'comet_data_title',
    'comet_data_hint',
    'refresh_comet_data',
    'refreshing_comet_data',
    'comet_data_updated',
    'comet_data_failed',
  ];
  for (const localeFile of localeFiles) {
    const locale = JSON.parse(await readFile(new URL(localeFile, localeDirectory), 'utf8'));
    const messages = locale.components.celestiaAtlas.settings;
    for (const key of requiredKeys) {
      assert.ok(messages[key]?.trim(), `${localeFile} is missing ${key}`);
    }
    assert.match(messages.comet_data_updated, /\{count\}/);
    assert.match(messages.comet_data_failed, /\{message\}/);
  }
});

test('defers Atlas resources until first open and guards late async initialization', async () => {
  const [app, view, vite] = await Promise.all([
    readFile(new URL('../../../App.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
    readFile(new URL('../../../../vite.config.js', import.meta.url), 'utf8'),
  ]);

  assert.match(app, /v-if="settingsStore\.setupCompleted && skyAtlasMounted"/);
  assert.match(app, /const skyAtlasMounted = ref\(Boolean\(store\.showSkyAtlas\)\)/);
  assert.match(app, /if \(visible\) skyAtlasMounted\.value = true/);
  assert.match(view, /void store\.fetchProfilInfos\(\)\.catch/);
  assert.match(
    view,
    /Promise\.all\(\[[\s\S]*viewer-catalog-data[\s\S]*abell-pn-data[\s\S]*stellarium-supplement-data[\s\S]*bright-sky-data[\s\S]*hyg-star-data[\s\S]*western-constellation-data/
  );
  assert.match(view, /buildEmbeddedAtlasCatalog/);
  assert.match(view, /const \{ catalog, stars, constellations \}/);
  assert.doesNotMatch(view, /object\.ra \* 15/);
  assert.match(view, /if \(disposed\) return;[\s\S]*createCelestiaAtlasViewer/);
  assert.match(view, /onBeforeUnmount\(\(\) => \{[\s\S]*disposed = true[\s\S]*viewer\?\.destroy/);

  const supplementGroup = vite.indexOf("name: 'celestia-catalog-supplement'");
  const starCatalogGroup = vite.indexOf("name: 'celestia-star-catalog'");
  const catalogGroup = vite.indexOf("name: 'celestia-catalog'");
  const engineGroup = vite.indexOf("name: 'celestia-engine'");
  const catchAllVendor = vite.indexOf("name: 'vendor'");
  assert.ok(supplementGroup > 0 && supplementGroup < catalogGroup);
  assert.ok(starCatalogGroup > supplementGroup && starCatalogGroup < catalogGroup);
  assert.ok(catalogGroup > 0 && catalogGroup < catchAllVendor);
  assert.ok(engineGroup > catalogGroup && engineGroup < catchAllVendor);
});

test('persists touch-sized brightness controls for all three Atlas categories', async () => {
  const [settingsDefaults, settingsView, englishLocale] = await Promise.all([
    readFile(
      new URL('../../../store/utils/celestiaAtlasSettingsMigration.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../../../components/celestiaAtlas/CelestiaAtlasSettings.vue', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../../../locales/en.json', import.meta.url), 'utf8'),
  ]);

  assert.match(settingsDefaults, /starMagnitudeLimit: 6\.5/);
  assert.match(settingsDefaults, /galaxyMagnitudeLimit: 30/);
  assert.match(settingsDefaults, /deepSkyMagnitudeLimit: 30/);
  assert.match(settingsView, /brightness_filters/);
  assert.match(settingsView, /v-model\.number="starMagnitudeLimit"/);
  assert.match(settingsView, /v-model\.number="galaxyMagnitudeLimit"/);
  assert.match(settingsView, /v-model\.number="deepSkyMagnitudeLimit"/);
  assert.match(settingsView, /class="w-full h-11 accent-cyan-500"/);
  const messages = JSON.parse(englishLocale).components.celestiaAtlas.settings;
  assert.equal(messages.magnitude_limit_auto, 'Auto');
  assert.match(messages.magnitude_limit_hint, /Lower values show only brighter objects/);
});

test('persists touch-sized Atlas type and catalogue filters without limiting offline search', async () => {
  const [view, settingsView, filterView, facetView, settingsStore, settingsDefaults] =
    await Promise.all([
      readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
      readFile(
        new URL('../../../components/celestiaAtlas/CelestiaAtlasSettings.vue', import.meta.url),
        'utf8'
      ),
      readFile(
        new URL('../../../components/celestiaAtlas/AtlasCatalogFilters.vue', import.meta.url),
        'utf8'
      ),
      readFile(
        new URL('../../../components/celestiaAtlas/AtlasFacetGroup.vue', import.meta.url),
        'utf8'
      ),
      readFile(new URL('../../../store/settingsStore.js', import.meta.url), 'utf8'),
      readFile(
        new URL('../../../store/utils/celestiaAtlasSettingsMigration.js', import.meta.url),
        'utf8'
      ),
    ]);

  assert.match(settingsDefaults, /deepSkyObjectTypes: null/);
  assert.match(settingsDefaults, /deepSkyCatalogueGroups: null/);
  assert.match(settingsStore, /persist: true/);
  assert.doesNotMatch(settingsStore, /settings-store/);
  assert.match(view, /buildAtlasCatalogFacets\(catalog\)/);
  assert.match(view, /buildAtlasStarFacets\(stars\)/);
  assert.match(view, /starCatalogueGroups: normalizeAtlasFacetSelection/);
  assert.match(settingsDefaults, /starCatalogueGroups: null/);
  assert.match(view, /synchronizeCatalogFilterSettings\(\)/);
  assert.match(view, /deepSkyObjectTypes: normalizeAtlasFacetSelection/);
  assert.match(view, /deepSkyCatalogueGroups: normalizeAtlasFacetSelection/);
  assert.match(view, /settingsStore\.celestiaAtlas\.deepSkyObjectTypes/);
  assert.match(view, /settingsStore\.celestiaAtlas\.deepSkyCatalogueGroups/);
  assert.match(view, /searchResults\.value = viewer\?\.search\(searchQuery\.value\) \?\? \[\]/);
  assert.match(view, /result\.displayName \|\| result\.name \|\| result\.id/);
  assert.match(settingsView, /<AtlasCatalogFilters/);
  assert.match(settingsView, /:disabled="!settingsStore\.celestiaAtlas\.dsosVisible"/);
  assert.match(filterView, /toggleAtlasFacetSelection/);
  assert.match(filterView, /settingsStore\.celestiaAtlas\[setting\] = value/);
  assert.match(facetView, /<details/);
  assert.match(facetView, /type="checkbox"/);
  assert.match(facetView, /:id="`atlas-\$\{kind\}-\$\{facet\.key\}`"/);
  assert.match(facetView, /:name="`atlas-\$\{kind\}`"/);
  assert.match(facetView, /data-filter-action="all"/);
  assert.match(facetView, /data-filter-action="none"/);
  assert.match(facetView, /:data-facet-key="facet\.key"/);
  assert.ok((facetView.match(/min-h-11/g) ?? []).length >= 4);

  const localeDirectory = new URL('../../../locales/', import.meta.url);
  const localeFiles = (await readdir(localeDirectory)).filter((name) => name.endsWith('.json'));
  const requiredKeys = [
    'catalog_filters',
    'catalog_filter_hint',
    'catalog_filter_types',
    'catalog_filter_sources',
    'catalog_filter_selected',
    'catalog_filter_all',
    'catalog_filter_none',
  ];
  for (const localeFile of localeFiles) {
    const locale = JSON.parse(await readFile(new URL(localeFile, localeDirectory), 'utf8'));
    const messages = locale.components.celestiaAtlas.settings;
    for (const key of requiredKeys) {
      assert.ok(messages[key]?.trim(), `${localeFile} is missing ${key}`);
    }
    assert.deepEqual(
      [...messages.catalog_filter_selected.matchAll(/\{([^}]+)\}/g)]
        .map((match) => match[1])
        .sort(),
      ['selected', 'total'],
      `${localeFile} has mismatched catalogue-filter placeholders`
    );
  }

  const english = JSON.parse(await readFile(new URL('en.json', localeDirectory), 'utf8'));
  assert.match(english.components.celestiaAtlas.settings.catalog_filter_hint, /offline search/i);
  assert.match(
    english.components.celestiaAtlas.settings.catalog_filter_hint,
    /every catalogue object/i
  );
});

test('routes every Atlas view-center action through the J2000 command boundary', async () => {
  const [view, actions] = await Promise.all([
    readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../components/celestiaAtlas/AtlasFovRotation.vue', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(view, /function getAtlasViewCenter\(\)[\s\S]*toNinaJ2000Coordinates\(center\)/);
  assert.match(view, /target = atlasSearchResultToTarget\(result\)/);
  assert.doesNotMatch(view, /result\.frame \|\| 'ICRS'/);
  assert.match(actions, /setCommandCoordinates\(props\.getViewCenter\(\)\)/);
  assert.match(actions, /toNinaJ2000Coordinates\(value \?\? \{\}\)/);
  assert.match(actions, /function invalidateCoordinates\(\)[\s\S]*raDeg\.value = null/);
  assert.match(actions, /<fieldset[\s\S]*:disabled="!hasValidCoordinates"/);
});

test('reuses the complete selected-target workflow at the Atlas J2000 command boundary', async () => {
  const [view, selectedObject, selectionModel, favorites] = await Promise.all([
    readFile(new URL('../../../views/CelestiaAtlasView.vue', import.meta.url), 'utf8'),
    readFile(
      new URL('../../../components/celestiaAtlas/SelectedObject.vue', import.meta.url),
      'utf8'
    ),
    readFile(new URL('../selectionModel.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../components/favTargets/SaveFavTargets.vue', import.meta.url), 'utf8'),
  ]);

  assert.match(view, /<SelectedSkyObject/);
  assert.match(view, /const selectedObjectCommand = computed/);
  assert.match(view, /atlasSelectionToCommandModel\(selectedTarget\.value\)/);
  assert.match(view, /:command-target="selectedObjectCommand\.commandTarget"/);
  assert.match(view, /dismissible/);
  assert.match(view, /@dismiss="hideSelectedTargetDetails"/);
  assert.doesNotMatch(view, /sendSelectionToFraming/);
  assert.doesNotMatch(view, /store\.mount\.currentTab = 'showSlew'/);
  assert.doesNotMatch(view, /router\.push\('\/mount'\)/);

  assert.match(selectionModel, /const commandTarget = atlasSelectionToFraming\(target\)/);
  assert.match(selectionModel, /raString: degreesToHMS\(commandTarget\.RA\)/);
  assert.match(selectionModel, /decString: degreesToDMS\(commandTarget\.Dec\)/);

  assert.match(selectedObject, /selectedObject: Array/);
  assert.match(selectedObject, /commandTarget:[\s\S]*default: null/);
  assert.match(selectedObject, /<fieldset[\s\S]*:disabled="!actionControlsEnabled"/);
  assert.match(selectedObject, /<SaveFavTargets/);
  assert.match(selectedObject, /@click="openFramingModal"/);
  assert.match(selectedObject, /<setSequenceTarget/);
  assert.match(selectedObject, /<ButtonSlewCenterRotate/);
  assert.match(selectedObject, /<ButtomSyncCoordinatesToMount/);
  assert.match(selectedObject, /\.\.\.\(props\.commandTarget \?\? \{\}\)/);
  assert.match(selectedObject, /router\.push\('\/framing'\)/);
  assert.match(selectedObject, /defineEmits\(\['dismiss'\]\)/);
  assert.match(selectedObject, /selected-object-content-landscape/);
  assert.match(selectedObject, /100dvh/);
  assert.match(favorites, /<Teleport to="body">/);
});
