// src/utils/mountDriverCatalog.js

/**
 * Curated mount -> INDI driver table for PINS.
 *
 * The plugin server only offers INDI labels ("EQMod Mount", "SynScan Telescope") and nobody
 * searching for "EQ6" finds anything useful there - "Skywatcher" even leads to the alt-az
 * driver, which is the wrong one for an equatorial Sky-Watcher mount. This table lets the
 * user search for the hardware they own and tells them which driver fits the cable they use.
 *
 * It ships with the app on purpose: users sit on the PINS access point without internet
 * often enough that an online lookup would fail exactly when it is needed.
 *
 * Every driver name below was checked against the driver list of a real PINS (2026-11-21):
 * the ones without `package` are part of PINS' INDI core, the ones with `package` come from
 * the 3rd party release the pinsdaemon installs from (`/packages/indi3rdparty`).
 */

// INDI driver name -> how to present it and, for 3rd party drivers, which package brings it.
// `label` is what the install writes into PINS' driver registry, so the list entry reads the
// same as the driver's own INDI label.
export const MOUNT_DRIVERS = Object.freeze({
  indi_eqmod_telescope: { label: 'EQMod Mount', package: 'indi-eqmod' },
  indi_synscan_telescope: { label: 'SynScan Telescope' },
  indi_celestron_gps: { label: 'Celestron NexStar' },
  indi_celestron_aux: { label: 'Celestron AUX', package: 'indi-celestronaux' },
  indi_ioptronv3_telescope: { label: 'iOptron v3' },
  indi_ieq_telescope: { label: 'iOptron iEQ' },
  indi_lx200zeq25: { label: 'iOptron ZEQ25' },
  indi_lx200am5: { label: 'ZWO AM5' },
  indi_lx200gemini: { label: 'Losmandy Gemini' },
  indi_lx200_10micron: { label: '10Micron' },
  indi_lx200_OnStep: { label: 'OnStep' },
  indi_lx200_pegasus_nyx101: { label: 'Pegasus NYX-101' },
  indi_lx200_OpenAstroTech: { label: 'OpenAstroTech' },
  indi_lx200ap_v2: { label: 'Astro-Physics' },
  indi_lx200autostar: { label: 'Meade Autostar' },
  indi_rainbow_telescope: { label: 'Rainbow Astro' },
  indi_pmc8_telescope: { label: 'PMC-Eight' },
  indi_temma_telescope: { label: 'Takahashi Temma' },
  indi_bresserexos2: { label: 'Bresser EXOS-2 GoTo', package: 'indi-bresserexos2' },
  indi_starbook_ten: { label: 'Vixen Starbook Ten', package: 'indi-starbook-ten' },
});

// Connection types. Their title/hint texts live under
// components.mountDriverFinder.connections.<id> in the locales.
export const CONNECTION_IDS = Object.freeze([
  'swDirect',
  'swHandController',
  'celestronUsb',
  'celestronHandController',
  'meadeHandController',
  'usb',
  'network',
]);

// Sky-Watcher's equatorial GoTo mounts all work the same way: EQMod talks to the motor
// controller directly (USB socket on the mount, or an EQDIR cable in the hand controller
// port), SynScan goes through the hand controller. EQMod is the usual choice.
const SKYWATCHER_EQ = [
  { id: 'swDirect', driver: 'indi_eqmod_telescope' },
  { id: 'swHandController', driver: 'indi_synscan_telescope' },
];

// Celestron mounts with a USB socket on the mount head talk AUX directly; every Celestron
// GoTo mount also works through the NexStar hand controller.
const CELESTRON_AUX = [
  { id: 'celestronUsb', driver: 'indi_celestron_aux' },
  { id: 'celestronHandController', driver: 'indi_celestron_gps' },
];
const CELESTRON_HC = [{ id: 'celestronHandController', driver: 'indi_celestron_gps' }];

const usb = (driver) => [{ id: 'usb', driver }];
const network = (driver) => [{ id: 'network', driver }];

/**
 * The models. `aliases` catch the spellings people actually type; vendor and model are
 * searched as well, so they need not be repeated there. Order matters: within the same
 * match quality, earlier entries are listed first.
 */
export const MOUNT_MODELS = Object.freeze([
  // Sky-Watcher
  {
    id: 'sw-eq6r',
    vendor: 'Sky-Watcher',
    model: 'EQ6-R Pro',
    aliases: ['EQ6R', 'EQ6 R'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-eq6',
    vendor: 'Sky-Watcher',
    model: 'EQ6 Pro / NEQ6 Pro',
    aliases: ['NEQ6', 'EQ6 SynScan'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-azeq6',
    vendor: 'Sky-Watcher',
    model: 'AZ-EQ6 GT / Pro',
    aliases: ['AZEQ6'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-heq5',
    vendor: 'Sky-Watcher',
    model: 'HEQ5 Pro',
    aliases: ['HEQ5', 'HEQ-5', 'HEQ5 SynScan'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-eq5',
    vendor: 'Sky-Watcher',
    model: 'EQ5 Pro / EQ5 GoTo',
    aliases: ['EQ5 SynScan'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-azeq5',
    vendor: 'Sky-Watcher',
    model: 'AZ-EQ5 GT',
    aliases: ['AZEQ5'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-eq8',
    vendor: 'Sky-Watcher',
    model: 'EQ8 / EQ8-R Pro',
    aliases: ['EQ8R'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-eqm35',
    vendor: 'Sky-Watcher',
    model: 'EQM-35 Pro',
    aliases: ['EQM35'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-eq3',
    vendor: 'Sky-Watcher',
    model: 'EQ3 Pro / EQ3 GoTo',
    aliases: ['EQ3-2 GoTo', 'EQ3 SynScan'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-cq350',
    vendor: 'Sky-Watcher',
    model: 'CQ350 Pro',
    aliases: ['CQ350'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-sagti',
    vendor: 'Sky-Watcher',
    model: 'Star Adventurer GTi',
    aliases: ['SA GTi', 'StarAdventurer GTi'],
    connections: SKYWATCHER_EQ,
  },
  {
    id: 'sw-wave',
    vendor: 'Sky-Watcher',
    model: 'Wave 100i / 150i',
    aliases: ['Wave100i', 'Wave150i'],
    connections: [{ id: 'swDirect', driver: 'indi_eqmod_telescope' }],
  },

  // Celestron
  {
    id: 'cel-avx',
    vendor: 'Celestron',
    model: 'Advanced VX (AVX)',
    aliases: ['AVX', 'Advanced GT'],
    connections: CELESTRON_HC,
  },
  {
    id: 'cel-cgx',
    vendor: 'Celestron',
    model: 'CGX / CGX-L',
    aliases: ['CGXL'],
    connections: CELESTRON_AUX,
  },
  {
    id: 'cel-cgem2',
    vendor: 'Celestron',
    model: 'CGEM II',
    aliases: ['CGEM2', 'CGEM 2'],
    connections: CELESTRON_AUX,
  },
  {
    id: 'cel-cgem',
    vendor: 'Celestron',
    model: 'CGEM / CGEM DX',
    aliases: ['CGEMDX'],
    connections: CELESTRON_HC,
  },

  // iOptron
  {
    id: 'io-cem',
    vendor: 'iOptron',
    model: 'CEM26 / CEM40 / CEM70 / CEM120',
    aliases: ['CEM25P', 'CEM60', 'CEM 40', 'CEM 70'],
    connections: usb('indi_ioptronv3_telescope'),
  },
  {
    id: 'io-gem',
    vendor: 'iOptron',
    model: 'GEM28 / GEM45',
    aliases: ['GEM 28', 'GEM 45'],
    connections: usb('indi_ioptronv3_telescope'),
  },
  {
    id: 'io-hem',
    vendor: 'iOptron',
    model: 'HEM27 / HEM44',
    aliases: ['HEM 27', 'HEM 44'],
    connections: usb('indi_ioptronv3_telescope'),
  },
  {
    id: 'io-ieq',
    vendor: 'iOptron',
    model: 'iEQ30 Pro / iEQ45 Pro',
    aliases: ['iEQ30', 'iEQ45'],
    connections: usb('indi_ieq_telescope'),
  },
  {
    id: 'io-zeq25',
    vendor: 'iOptron',
    model: 'ZEQ25',
    aliases: [],
    connections: usb('indi_lx200zeq25'),
  },

  // ZWO
  {
    id: 'zwo-am',
    vendor: 'ZWO',
    model: 'AM3 / AM5 / AM5N',
    aliases: ['AM 5', 'AM 3'],
    connections: usb('indi_lx200am5'),
  },

  // Others, alphabetical by vendor
  {
    id: 'ap',
    vendor: 'Astro-Physics',
    model: 'Mach1 / Mach2 / 1100 (GTOCP4/5)',
    aliases: ['GTOCP4', 'GTOCP5', 'AstroPhysics'],
    connections: usb('indi_lx200ap_v2'),
  },
  {
    id: 'bresser-exos2',
    vendor: 'Bresser',
    model: 'Messier EXOS-2 GoTo',
    aliases: ['EXOS2', 'EXOS 2'],
    connections: usb('indi_bresserexos2'),
  },
  {
    id: 'es-pmc8',
    vendor: 'Explore Scientific',
    model: 'iEXOS-100 / EXOS-2 PMC-Eight',
    aliases: ['PMC8', 'PMC-8', 'iEXOS100'],
    connections: usb('indi_pmc8_telescope'),
  },
  {
    id: 'losmandy',
    vendor: 'Losmandy',
    model: 'G11 / GM811 / Titan (Gemini 2)',
    aliases: ['Gemini2', 'Gemini 2'],
    connections: usb('indi_lx200gemini'),
  },
  {
    id: 'meade-autostar',
    vendor: 'Meade',
    model: 'LX90 / LX85 / ETX (AutoStar)',
    aliases: ['AutoStar', 'AudioStar'],
    connections: [{ id: 'meadeHandController', driver: 'indi_lx200autostar' }],
  },
  {
    id: 'micron',
    vendor: '10Micron',
    model: 'GM1000 / GM2000 / GM3000',
    aliases: ['10 Micron'],
    connections: network('indi_lx200_10micron'),
  },
  {
    id: 'oat',
    vendor: 'OpenAstroTech',
    model: 'OpenAstroTracker / OpenAstroMount',
    aliases: ['OAT', 'OAM'],
    connections: usb('indi_lx200_OpenAstroTech'),
  },
  {
    id: 'onstep',
    vendor: 'OnStep',
    model: 'OnStep / OnStepX',
    aliases: [],
    connections: usb('indi_lx200_OnStep'),
  },
  {
    id: 'pegasus-nyx',
    vendor: 'Pegasus Astro',
    model: 'NYX-101',
    aliases: ['NYX101', 'NYX 101'],
    connections: usb('indi_lx200_pegasus_nyx101'),
  },
  {
    id: 'rainbow',
    vendor: 'Rainbow Astro',
    model: 'RST-135 / RST-300',
    aliases: ['RST135', 'RST300'],
    connections: usb('indi_rainbow_telescope'),
  },
  {
    id: 'takahashi-temma',
    vendor: 'Takahashi',
    model: 'EM-200 / EM-11 (Temma2)',
    aliases: ['Temma', 'EM200'],
    connections: usb('indi_temma_telescope'),
  },
  {
    id: 'vixen-starbook-ten',
    vendor: 'Vixen',
    model: 'SXP / SXD2 / AXJ (STAR BOOK TEN)',
    aliases: ['Starbook Ten', 'Starbook10'],
    connections: network('indi_starbook_ten'),
  },
]);

// Spellings of the same vendor that should all match each other.
const VENDOR_SYNONYMS = [
  [/sky[\s-]*watcher/g, 'skywatcher'],
  [/ten\s*micron/g, '10micron'],
];

/** Lowercase, vendor synonyms unified, everything that is not a letter or digit removed. */
export function compactSearchText(value) {
  let text = String(value ?? '').toLowerCase();
  for (const [pattern, replacement] of VENDOR_SYNONYMS) {
    text = text.replace(pattern, replacement);
  }
  return text.replace(/[^a-z0-9]/g, '');
}

function queryTokens(query) {
  let text = String(query ?? '').toLowerCase();
  for (const [pattern, replacement] of VENDOR_SYNONYMS) {
    text = text.replace(pattern, replacement);
  }
  return text
    .split(/[\s/,]+/)
    .map((token) => token.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
}

// The strings one model can be found by. Each stays separate so a match can never stretch
// across the boundary between two of them.
function searchTargets(model) {
  const modelParts = String(model.model)
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  // The parts, not the whole "EQ5 Pro / EQ5 GoTo": joined, that would match "proeq5".
  return [
    ...modelParts,
    ...modelParts.map((part) => `${model.vendor} ${part}`),
    ...(model.aliases || []),
    ...(model.aliases || []).map((alias) => `${model.vendor} ${alias}`),
  ].map(compactSearchText);
}

/**
 * Finds the models matching what the user typed.
 *
 * A hit is ranked by how well it matches:
 *   3 - one name starts with the whole query ("eq6" -> "EQ6-R Pro"),
 *   2 - the whole query appears in one name ("eq6" -> "AZ-EQ6"),
 *   1 - every word of the query appears somewhere ("skywatcher eq6" -> "AZ-EQ6 GT").
 * Equal ranks keep the catalog order, which lists the common mounts first.
 *
 * @param {string} query
 * @param {Array} [models] defaults to MOUNT_MODELS; injectable for tests
 * @returns {Array} matching models, best first; empty for queries shorter than 2 characters
 */
export function searchMountModels(query, models = MOUNT_MODELS) {
  const compactQuery = compactSearchText(query);
  if (compactQuery.length < 2) return [];
  const tokens = queryTokens(query);

  const ranked = [];
  models.forEach((model, index) => {
    const targets = searchTargets(model);
    let rank = 0;
    if (targets.some((target) => target.startsWith(compactQuery))) rank = 3;
    else if (targets.some((target) => target.includes(compactQuery))) rank = 2;
    else if (
      tokens.length > 1 &&
      tokens.every((token) => targets.some((target) => target.includes(token)))
    )
      rank = 1;
    if (rank > 0) ranked.push({ model, rank, index });
  });

  ranked.sort((a, b) => b.rank - a.rank || a.index - b.index);
  return ranked.map((entry) => entry.model);
}

/** Vendors in catalog order, each once - offered as shortcuts while the search is empty. */
export function mountVendors(models = MOUNT_MODELS) {
  return [...new Set(models.map((model) => model.vendor))];
}

/**
 * What it takes to use a driver on this PINS.
 *
 * @param {string} driver INDI driver name
 * @param {Iterable<string>} installedDrivers names from the plugin's INDI driver list
 * @returns {'installed'|'installable'|'unavailable'}
 *   installed   - in the driver list, can be selected right away
 *   installable - not in the list, but a 3rd party package brings it
 *   unavailable - neither; the user has to fall back to the full driver list
 */
export function driverAvailability(driver, installedDrivers) {
  const installed = new Set(installedDrivers || []);
  if (installed.has(driver)) return 'installed';
  if (MOUNT_DRIVERS[driver]?.package) return 'installable';
  return 'unavailable';
}

/** The display label of a driver: the catalog's name, else the raw driver name. */
export function mountDriverLabel(driver) {
  return MOUNT_DRIVERS[driver]?.label || driver;
}

/**
 * Picks the asset to install for a package out of the pinsdaemon's package list.
 * Matches the package name exactly: a substring search would also pick e.g. 'indi-eqmod-dbg'
 * style variants or a neighbouring package.
 */
export function findPackageAsset(packageName, packages) {
  if (!packageName || !Array.isArray(packages)) return null;
  return packages.find((pkg) => pkg?.name === packageName && pkg?.assetName) || null;
}
