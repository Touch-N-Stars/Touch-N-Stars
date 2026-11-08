// Answers of the PINS daemon (port 8000) for the browser tests, shaped after a real PINS host
// with two Wi-Fi adapters. Names, addresses and MACs are made up. Only GET routes exist:
// every write the app sends ends up unanswered, so a test can assert that none went out.
const now = () => new Date().toISOString();

const CLIENT = {
  role: 'client',
  connected: true,
  ssid: 'Observatory',
  band: '5GHz',
  interface: 'wlan1',
  ipAddress: '192.168.1.50',
  connectionName: 'pins-client-0123456789abcdef',
  signalStrength: 76,
  quality: '76/100',
  channel: 116,
  frequency: 5580.0,
};
const HOTSPOT = {
  role: 'hotspot',
  connected: true,
  ssid: 'Hotspot',
  band: null,
  interface: 'wlan0',
  ipAddress: '10.42.0.1',
  connectionName: 'Hotspot',
  signalStrength: null,
  quality: null,
  channel: null,
  frequency: null,
};

const scannedNetwork = (ssid, signal, encrypted = true) => ({
  ssid,
  signal_strength: signal,
  quality: `${signal}/100`,
  encrypted,
});

const indiPackage = (name, version, installedVersion = null) => ({
  name,
  assetName: `${name}_${version}_arm64.deb`,
  version,
  architecture: 'arm64',
  downloadUrl: `https://example.invalid/${name}_${version}_arm64.deb`,
  installed: Boolean(installedVersion),
  installedVersion,
});

const plugin = (packageName, installedVersion, availableVersion = null) => ({
  packageName,
  installed: Boolean(installedVersion),
  installedVersion,
  availableVersion,
});

const update = (name, installedVersion, latestVersion) => ({
  name,
  installedVersion,
  latestVersion,
  updateAvailable: installedVersion !== latestVersion,
});

export const PINS_DAEMON_ROUTES = {
  '/wifi/status': () => ({
    ...CLIENT,
    connections: [CLIENT, HOTSPOT],
    desiredMode: 'auto',
    observedMode: 'dual',
  }),
  '/wifi/mode': () => ({
    desiredMode: 'auto',
    observedMode: 'dual',
    availableModes: ['auto', 'hotspot'],
  }),
  '/wifi/adapters': () => ({
    adapters: [
      {
        interface: 'wlan0',
        state: 'connected',
        connection: 'Hotspot',
        role: 'hotspot',
        mac: 'D8\\:3A\\:DD\\:00\\:00\\:01',
        driver: 'brcmfmac',
        mtu: 1500,
      },
      {
        interface: 'wlan1',
        state: 'connected',
        connection: CLIENT.connectionName,
        role: 'client',
        mac: '00\\:13\\:EF\\:00\\:00\\:02',
        driver: 'rtw88_8822bu',
        mtu: 1500,
      },
    ],
  }),
  '/wifi/interfaces': () => ({ client_interface: 'wlan1', hotspot_interface: 'wlan0' }),
  '/wifi/clients': () => ({
    clients: [
      { ip: '10.42.0.23', mac: 'A4:83:E7:00:00:03', hostname: 'tablet', expires: '23:41:07' },
      { ip: '10.42.0.57', mac: '3C:22:FB:00:00:04', hostname: '', expires: '23:58:12' },
    ],
  }),
  '/wifi/networks': () => ({
    networks: [
      {
        uuid: '00000000-0000-4000-8000-000000000001',
        name: CLIENT.connectionName,
        ssid: 'Observatory',
        interface: 'wlan1',
        compatible: true,
        auto_connect: true,
        priority: 100,
        last_connected: 1793465446,
        hidden: false,
        band: '',
        connected: true,
      },
      {
        uuid: '00000000-0000-4000-8000-000000000002',
        name: 'Star party',
        ssid: 'Star party',
        interface: 'wlan2',
        compatible: false,
        auto_connect: false,
        priority: 0,
        last_connected: 1790000000,
        hidden: false,
        band: '2.4GHz',
        connected: false,
      },
    ],
  }),
  '/wifi/scan': () => [
    scannedNetwork('Observatory', 76),
    scannedNetwork('Neighbour 5G', 48),
    scannedNetwork('Guest', 21, false),
  ],
  '/wifi/hotspot/settings': () => ({
    configured: true,
    source: 'configured',
    band: '2.4GHz',
    channel: 6,
    hotspotInterface: 'wlan0',
    supportedChannels: {
      '2.4GHz': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      '5GHz': [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128],
      '6GHz': [],
      '60GHz': [],
    },
  }),
  '/samba': () => ({ enabled: true }),
  '/phd2': () => ({ enabled: true, running: true }),
  // Kept on the browser's clock, or the app would correct the host time with a write.
  '/system/time': () => ({ timestamp: Date.now() / 1000, iso: now() }),
  '/system/temperature': () => ({ celsius: 36.0, fahrenheit: 96.8, source: 'vcgencmd' }),
  '/system/localization': () => ({
    locale: 'en_US.UTF-8',
    wifiCountry: 'DE',
    wifiCountryPersistent: 'DE',
    wifiCountryBoot: 'DE',
    wifiCountryRuntime: 'DE',
    wifiCountryConsistent: true,
    timezone: 'Europe/Berlin',
    keyboardLayout: 'us',
  }),
  '/system/localization/options': () => ({
    locales: ['de_DE.UTF-8', 'en_GB.UTF-8', 'en_US.UTF-8', 'fr_FR.UTF-8'],
    wifiCountries: [
      { code: 'AT', name: 'Austria' },
      { code: 'DE', name: 'Germany' },
      { code: 'US', name: 'United States' },
    ],
    timezones: ['America/New_York', 'Europe/Berlin', 'Europe/London', 'UTC'],
    keyboardLayouts: ['de', 'gb', 'us'],
    keyboardLayoutOptions: [
      { code: 'de', name: 'German' },
      { code: 'gb', name: 'English (UK)' },
      { code: 'us', name: 'English (US)' },
    ],
  }),
  '/system/swap': () => ({
    supported: true,
    backend: 'rpi-swap',
    mechanism: 'zram+file',
    configuredSizeMb: 2048,
    activeFileSizeMb: 2048,
    activeSwapSizeMb: 2048,
    availableBytes: 131345993728,
    pendingReboot: false,
    optionsGb: [2, 4, 8],
    defaultSizeGb: 2,
    unsupportedReason: null,
  }),
  // Stable, so switching offers the unstable channel and its two-step confirmation.
  '/repository': () => ({
    channel: 'trixie',
    configured: true,
    suites: ['trixie'],
    repositoryUrl: 'https://repo.touch-n-stars.eu/reprepro',
    options: ['trixie', 'unstable'],
  }),
  '/plugins': () => ({
    checkedAt: now(),
    plugins: [
      plugin('pins-plugin-alpaca', null),
      plugin('pins-plugin-livestack', '1.1.3.0+41460575728.1', '1.1.3.0+41896825267.1'),
      plugin('pins-plugin-ninaapi', '2.2.15.2+41460575728.1'),
      plugin('pins-plugin-orbitals', null),
      plugin('pins-plugin-touch-n-stars', '1.5.0.0+41460575728.1', '1.5.0.0+41896825267.1'),
    ],
  }),
  '/updates/check': () => ({
    checkedAt: now(),
    packages: [
      update('nina', '3.2.0.9001', '3.2.0.9002'),
      update('pins-daemon', '1.4.2', '1.5.0'),
      update('indi-bin', '2.1.6', '2.1.6'),
    ],
  }),
  '/packages/indi3rdparty': () => ({
    checkedAt: now(),
    onlyNotInstalled: false,
    packages: [
      indiPackage('indi-aagcloudwatcher-ng', '1.7-30'),
      indiPackage('indi-asi', '2.6-30', '2.6-30'),
      indiPackage('indi-eqmod', '1.4-30'),
      indiPackage('indi-playerone', '1.6-30'),
    ],
  }),
  '/packages/indi3rdparty/registry': () => ({
    updatedAt: now(),
    totalEntries: 3,
    entriesByType: {
      camera: [
        { Name: 'indi_asi_ccd', Label: 'ASI CCD', Type: 'camera' },
        { Name: 'indi_asi_single_ccd', Label: 'ASI SINGLE CCD', Type: 'camera' },
      ],
      filterwheel: [{ Name: 'indi_asi_wheel', Label: 'ASI WHEEL', Type: 'filterwheel' }],
      flatpanel: [],
      focuser: [],
      rotator: [],
      switches: [],
      telescope: [],
      weather: [],
    },
  }),
  '/jobs/latest': () => ({
    jobId: '00000000-0000-4000-8000-0000000000aa',
    status: 'success',
    exitCode: 0,
    startedAt: 1793645103.66,
    finishedAt: 1793645289.0,
    errorCode: null,
    errorMessage: null,
  }),
};
