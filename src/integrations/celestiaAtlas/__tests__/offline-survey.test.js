import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import {
  DSS_SURVEY_BASE_ORDER,
  DSS_SURVEY_MIN_ORDER,
  createDssSkySurveySource,
  dssSurveyTileCount,
  estimateDssSurveyBytes,
  loadDssSurveyOrder,
  parseHipsProperties,
  readHipsOrder,
  resolveCelestiaAtlasDataBaseUrl,
  resolveDssSurveyUrl,
  createSkySurveySource,
  estimateSkySurveyBytes,
  loadSkySurveyOrder,
  normalizeSkySurveyId,
  skySurveyTileCount,
  SKY_SURVEY_IDS,
} from '../offlineSkySurvey.js';

const SAMPLE_PROPERTIES = `creator_did          = ivo://CDS/P/DSS2/color
#hips_release_date    = 2016-12-13T14:51Z
hips_order           = 5
hips_order_min       = 3
hips_tile_format     = jpeg
hips_service_url     = /celestia-atlas-data/surveys/dss
`;

test('no DSS survey is packaged with the app any more', async () => {
  const packagedSurvey = new URL(
    '../../../../public/celestia-atlas-data/surveys/dss/',
    import.meta.url
  );
  await assert.rejects(access(packagedSurvey), { code: 'ENOENT' });
});

test('the survey source points at the plugin-served route and takes its order from the server', () => {
  const source = createDssSkySurveySource('/celestia-atlas-data', 5);
  assert.equal(source.url, '/celestia-atlas-data/surveys/dss');
  assert.equal(source.minOrder, DSS_SURVEY_MIN_ORDER);
  assert.equal(source.maxOrder, 5);
  assert.equal(source.format, 'jpg');
  assert.equal(source.tileWidth, 512);
  assert.equal(source.blendStartFovDeg, 170);
  assert.equal(source.blendFullFovDeg, 130);
  assert.doesNotMatch(source.url, /^https?:\/\//);

  assert.equal(createDssSkySurveySource('/celestia-atlas-data', 4).maxOrder, 4);
  assert.throws(() => createDssSkySurveySource('/celestia-atlas-data', 2), RangeError);
  assert.throws(() => createDssSkySurveySource('/celestia-atlas-data'), RangeError);
});

test('native apps load Atlas data from the selected NINA plugin', () => {
  const dataBaseUrl = resolveCelestiaAtlasDataBaseUrl({
    native: true,
    protocol: 'http',
    host: '192.168.1.42',
    port: 5000,
  });
  assert.equal(dataBaseUrl, 'http://192.168.1.42:5000/celestia-atlas-data');
  assert.equal(
    createDssSkySurveySource(dataBaseUrl, 4).url,
    'http://192.168.1.42:5000/celestia-atlas-data/surveys/dss'
  );
  assert.equal(resolveDssSurveyUrl(`${dataBaseUrl}/`), `${dataBaseUrl}/surveys/dss`);
});

test('web builds keep using the same-origin Atlas data tree', () => {
  assert.equal(
    resolveCelestiaAtlasDataBaseUrl({
      native: false,
      host: '192.168.1.42',
      port: 5000,
    }),
    '/celestia-atlas-data'
  );
});

test('HiPS properties are parsed line by line and comments are ignored', () => {
  const properties = parseHipsProperties(SAMPLE_PROPERTIES);
  assert.equal(properties.hips_order, '5');
  assert.equal(properties.hips_order_min, '3');
  assert.equal(properties.hips_service_url, '/celestia-atlas-data/surveys/dss');
  assert.equal(properties.hips_release_date, undefined);

  assert.equal(readHipsOrder(SAMPLE_PROPERTIES), 5);
  assert.equal(readHipsOrder('hips_order=4\r\nhips_frame = equatorial'), 4);
  assert.equal(readHipsOrder('hips_order_min = 3'), null);
  assert.equal(readHipsOrder('hips_order = four'), null);
  assert.equal(readHipsOrder(''), null);
  assert.equal(readHipsOrder(undefined), null);
});

test('tile counts and size estimates follow the HiPS layout', () => {
  assert.equal(dssSurveyTileCount(3), 768);
  assert.equal(dssSurveyTileCount(4), 3072);
  assert.equal(dssSurveyTileCount(7), 196608);

  const base = estimateDssSurveyBytes(DSS_SURVEY_MIN_ORDER, DSS_SURVEY_BASE_ORDER);
  assert.equal(base, 768 * 42_000 + 3072 * 55_000);
  assert.equal(estimateDssSurveyBytes(5, 5), 12288 * 75_000);
  assert.ok(estimateDssSurveyBytes(3, 7) > estimateDssSurveyBytes(3, 6));
  assert.throws(() => estimateDssSurveyBytes(3, 8), RangeError);
});

test('loadDssSurveyOrder reads the served properties and treats 404/network errors as not installed', async () => {
  const requests = [];
  const fetchOk = async (url, options) => {
    requests.push([url, options]);
    return { ok: true, text: async () => SAMPLE_PROPERTIES };
  };
  assert.equal(await loadDssSurveyOrder('http://nina:5000/celestia-atlas-data', fetchOk), 5);
  assert.equal(requests[0][0], 'http://nina:5000/celestia-atlas-data/surveys/dss/properties');
  assert.equal(requests[0][1].cache, 'no-store');

  const fetchMissing = async () => ({ ok: false, status: 404, text: async () => '' });
  assert.equal(await loadDssSurveyOrder('/celestia-atlas-data', fetchMissing), null);

  const fetchBroken = async () => {
    throw new TypeError('Failed to fetch');
  };
  assert.equal(await loadDssSurveyOrder('/celestia-atlas-data', fetchBroken), null);

  // An order below the minimum the source can render is unusable as maxOrder.
  const fetchTooLow = async () => ({ ok: true, text: async () => 'hips_order = 1' });
  assert.equal(await loadDssSurveyOrder('/celestia-atlas-data', fetchTooLow), null);
});

test('NSNS is a second plugin-served survey with its own route, orders and credit', () => {
  assert.deepEqual(SKY_SURVEY_IDS, ['dss', 'nsns']);
  const source = createSkySurveySource('nsns', 'http://nina:5000/celestia-atlas-data', 6);
  assert.equal(source.url, 'http://nina:5000/celestia-atlas-data/surveys/nsns');
  assert.equal(source.key, 'local-nsns-ohs8');
  assert.equal(source.format, 'jpg');
  assert.equal(source.minOrder, 3);
  assert.match(source.attribution, /CC BY-NC-SA 4\.0/);
  assert.throws(() => createSkySurveySource('nsns', '/celestia-atlas-data', 2), RangeError);
});

test('unknown survey ids fall back to DSS', () => {
  assert.equal(normalizeSkySurveyId('nsns'), 'nsns');
  assert.equal(normalizeSkySurveyId(undefined), 'dss');
  assert.equal(normalizeSkySurveyId('toString'), 'dss');
  assert.equal(createSkySurveySource('bogus', '/celestia-atlas-data', 4).key, 'local-dss-color');
});

test('NSNS estimates count only the tiles inside its northern coverage', () => {
  assert.equal(skySurveyTileCount('nsns', 3), 528);
  assert.equal(skySurveyTileCount('nsns', 6), 31872);
  assert.equal(skySurveyTileCount('dss', 6), 49152);
  assert.equal(estimateSkySurveyBytes('nsns', 3, 4), 528 * 68_000 + 2016 * 78_000);
  assert.throws(() => estimateSkySurveyBytes('nsns', 3, 7), RangeError);
});

test('loadSkySurveyOrder reads the properties of the requested survey', async () => {
  const requests = [];
  const fetchOk = async (url) => {
    requests.push(url);
    return { ok: true, text: async () => 'hips_order = 6' };
  };
  assert.equal(await loadSkySurveyOrder('nsns', '/celestia-atlas-data', fetchOk), 6);
  assert.equal(requests[0], '/celestia-atlas-data/surveys/nsns/properties');
});
