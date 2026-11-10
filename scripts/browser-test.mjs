// Renders every main page of the built app in headless Chrome against a local fake backend,
// because the unit test loader stubs .vue files and never sees a real page. No device is
// connected, so this covers the app shell and each page's disconnected state only.
//
// Screenshots land in .cache/browser-tests/ for before/after comparisons of UI refactors.
// Run `npm run build:app` first.
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, openPage } from './lib/chrome.mjs';
import { PINS_DAEMON_PATH, startFakeBackend } from './lib/fakeBackend.mjs';
import { findPageProblems } from './lib/browserChecks.mjs';
import { PINS_DAEMON_ROUTES } from './lib/pinsDaemonFixtures.mjs';
import { SEQUENCE_ROUTES } from './lib/sequenceFixtures.mjs';

const DIST_DIR = path.resolve('dist');
const SCREENSHOT_DIR = path.resolve('.cache/browser-tests');

const ROUTES = [
  '/equipment',
  '/camera',
  '/mount',
  '/autofocus',
  '/guider',
  '/dome',
  '/settings',
  '/flat',
  '/seq-mon',
  '/switch',
  '/filterwheel',
  '/rotator',
  '/flats',
  '/sequence',
  '/framing',
  '/pins',
];

const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true },
  tablet: { width: 1024, height: 768, mobile: true },
};

const DEVICES = [
  'camera',
  'dome',
  'filterwheel',
  'flatdevice',
  'focuser',
  'guider',
  'mount',
  'rotator',
  'safetymonitor',
  'switch',
  'weather',
];

// Dialogs NINA reports as open. Closing one of them cancels what it stands for, so the
// plate solving dialog below is the case that must never be closed by accident.
let ninaDialogs = [];
const PLATE_SOLVING_DIALOG = {
  Title: 'Plate Solving',
  ContentType: 'NINA.WPF.Base.ViewModel.PlateSolvingStatusVM',
  AvailableCommands: ['PART_CloseButton'],
  Content: {},
};
const TPPA_DIALOG = {
  Title: 'Three Point Polar Alignment',
  ContentType: 'NINA.Plugins.PolarAlignment.TPAPAVM',
  AvailableCommands: ['PART_CloseButton'],
  Content: {},
};
// Extra fields NINA's dialog list carries next to Dialogs while a flip or a centering runs.
let ninaDialogExtras = {};
const SLEW_AND_CENTER = {
  Active: true,
  Status: 'Solving image 3 of 5',
  CurrentMeasurement: {
    Time: '22:14:08',
    Success: true,
    ErrorDistance: 'RA: 00° 00\' 41"; Dec: 00° 00\' 12"; Distance: 00° 00\' 43"',
    Rotation: 91.4,
  },
  Measurements: [
    { Time: '22:13:21', Success: true, ErrorDistance: 'Distance: 01° 12\' 05"', Rotation: 91.2 },
    { Time: '22:13:44', Success: false, ErrorDistance: '--', Rotation: 0 },
    { Time: '22:14:08', Success: true, ErrorDistance: 'Distance: 00° 00\' 43"', Rotation: 91.4 },
  ],
};
const MERIDIAN_FLIP = {
  Steps: [
    { Id: 'pass', Title: 'Pass meridian', Finished: true },
    { Id: 'flip', Title: 'Flip', Finished: false },
    { Id: 'recenter', Title: 'Recenter', Finished: false },
    { Id: 'settle', Title: 'Settle', Finished: false },
  ],
};
// One dialog per migrated dialog component, with the extras each one reads.
const NINA_CONTENT_DIALOGS = [
  {
    name: 'slew-and-center',
    dialog: PLATE_SOLVING_DIALOG,
    extras: { SlewAndCenter: SLEW_AND_CENTER },
  },
  {
    name: 'meridian-flip',
    dialog: {
      Title: 'Meridian Flip',
      ContentType: 'NINA.WPF.Base.ViewModel.MeridianFlipVM',
      AvailableCommands: ['PART_CloseButton'],
      Content: { RemainingTime: '00:01:30' },
    },
    extras: { MeridianFlip: MERIDIAN_FLIP },
  },
  {
    name: 'manual-rotator',
    dialog: {
      Title: 'Manual Rotator',
      ContentType: 'NINA.Equipment.Equipment.MyRotator.ManualRotator',
      AvailableCommands: ['PART_CloseButton'],
      Content: {
        Text1: 'Current position',
        Text2: '12.5',
        Text3: '°',
        Text4: 'Target position',
        Text5: '97.25',
        Text6: '°',
        Text7: '84.75',
        Text8: '°',
        Text9: 'Rotate clockwise',
      },
    },
    extras: {},
  },
];

// A finished session of six frames. Each Id makes an entry deletable under PINS.
const HISTORY_IMAGE = path.join(DIST_DIR, 'Logo_TouchNStars_150x150.png');
const IMAGE_HISTORY = Array.from({ length: 6 }, (_, index) => ({
  Id: `fixture-${index}`,
  Filename: `M31_${index % 2 ? 'Ha' : 'L'}_${String(index + 1).padStart(4, '0')}.fits`,
  Date: new Date(Date.UTC(2026, 10, 7, 21, index * 5)).toISOString(),
  ImageType: 'LIGHT',
  TargetName: 'M 31',
  Filter: index % 2 ? 'Ha' : 'L',
  ExposureTime: 120,
  HFR: 2.1 + index * 0.05,
  HFRStDev: 0.4,
  Stars: 900 + index * 10,
  Mean: 1200.5,
  Median: 1180,
  StDev: 85.2,
  Min: 400,
  Max: 65535,
  Temperature: -10,
  Gain: 100,
  Offset: 50,
  RmsText: 'Tot: 0.62"',
}));

// The PINS version the backend reports, undefined for plain NINA. Setting store.isPINS alone
// does not stick: the store probes again every 15 s and falls back to NINA on two misses.
let pinsVersion;

// A rig with an INDI camera and mount, served only while checkEquipment runs so every other
// page keeps its plain disconnected state.
let equipmentFixtures = false;
const NO_DEVICE = { Id: 'No_Device', DisplayName: 'No Device', Category: 'N.I.N.A.' };
const RIG_DEVICES = {
  camera: [NO_DEVICE, { Id: 'cam-1', DisplayName: 'ZWO ASI2600MM Pro', Category: 'INDI' }],
  mount: [
    NO_DEVICE,
    { Id: 'mount-1', DisplayName: 'EQMod Mount (INDI)', Category: 'INDI', HasSetupDialog: true },
  ],
};
const RIG_PROFILE = {
  Id: 'profile-1',
  Name: 'Main rig',
  CameraSettings: { Id: 'cam-1', IndiDriver: 'indi_asi_ccd' },
  TelescopeSettings: {
    Id: 'mount-1',
    IndiDriver: 'indi_eqmod_telescope',
    IndiConnectionMode: 'CONNECTION_SERIAL',
    IndiPort: '/dev/ttyUSB0',
    IndiBaudRate: 9600,
    IndiAutoSearch: true,
  },
};
const RIG_PROFILES = [
  { Id: 'profile-1', Name: 'Main rig', IsActive: true },
  { Id: 'profile-2', Name: 'Travel rig', IsActive: false },
];
const INDI_TYPES = [
  'camera',
  'focuser',
  'filterwheel',
  'rotator',
  'telescope',
  'weather',
  'switches',
  'flatpanel',
  'dome',
  'safetymonitor',
];
const rigRoute = (fixture) => () => (equipmentFixtures ? fixture : undefined);

// PHD2 connected and looping on a camera and mount, served only while checkGuider runs.
// Looping, not guiding, because the calibration assistant is hidden while PHD2 guides.
let guiderFixtures = false;
const guiderRoute = (fixture) => () => (guiderFixtures ? fixture : undefined);
const GUIDER_PLUGIN_ROUTES = {
  '/api/phd2/all-info': guiderRoute({
    Success: true,
    Response: {
      Connection: { IsConnected: true },
      Status: { AppState: 'Looping' },
      StarLostInfo: null,
      EquipmentProfiles: ['Main rig', 'Travel rig'],
      StarImage: { Available: false },
      StarInfo: null,
    },
  }),
  '/api/phd2/get-current-equipment': guiderRoute({
    Success: true,
    Response: {
      CurrentEquipment: {
        camera: { name: 'ZWO ASI120MM Mini', connected: true },
        mount: { name: 'On-camera', connected: true },
      },
    },
  }),
};

// A connected EAF-style focuser with the PINS-only settings and Hocus Focus installed, served only
// while checkFocuser runs. Hocus Focus is probed under PINS only, so the NINA pass never sees it.
let focuserFixtures = false;
const focuserRoute = (fixture) => () => (focuserFixtures ? fixture : undefined);
const FOCUSER_INFO = {
  Connected: true,
  Name: 'ZWO EAF',
  DisplayName: 'ZWO EAF',
  Position: 12345,
  Temperature: 4.2,
  IsMoving: false,
  CanReverse: true,
  CanSetMaxStep: true,
};
// checkEquipment leaves its rig profile behind, which has no focuser section.
const FOCUSER_PROFILE_SETTINGS = {
  Id: 'focuser-1',
  AutoFocusExposureTime: 4,
  AutoFocusInitialOffsetSteps: 4,
  AutoFocusStepSize: 50,
  FocuserSettleTime: 0,
  AutoFocusTotalNumberOfAttempts: 1,
  AutoFocusNumberOfFramesPerPoint: 1,
  AutoFocusInnerCropRatio: 1,
  AutoFocusOuterCropRatio: 1,
  AutoFocusUseBrightestStars: 0,
  AutoFocusBinning: 1,
  AutoFocusCurveFitting: 'HYPERBOLIC',
  AutoFocusTimeoutSeconds: 600,
  BacklashCompensationModel: 'OVERSHOOT',
  BacklashIn: 0,
  BacklashOut: 0,
  RSquaredThreshold: 0.7,
};
const FOCUSER_PINS_SETTINGS = {
  IsStalled: false,
  HeatingPower: 35,
  BoardTemperature: 18.4,
  DcPower: true,
  StepSize: 2.5,
  MaxStep: 60000,
  HeatingTemperature: 5,
  FocuserAlias: 'Main EAF',
  HasMotorSpeedControl: true,
  MotorSpeeds: ['Slow', 'Normal', 'Fast'],
  MotorSpeed: 1,
};
const FOCUSER_PLUGIN_ROUTES = {
  '/api/autofocus/info': focuserRoute({ Success: true, autofocus_running: false, afError: false }),
  '/api/hocusfocus/status': focuserRoute({ Success: true }),
};

// The PINS daemon answers only while checkPins runs; elsewhere it stays a 404.
let pinsDaemon = false;
const DAEMON_ROUTES = Object.fromEntries(
  Object.entries(PINS_DAEMON_ROUTES).map(([route, answer]) => [
    route,
    (query) => (pinsDaemon ? answer(query) : undefined),
  ])
);
const PINS_DAEMON_PORT = 8000;

// A loaded sequence, served only while checkSequence runs so /sequence stays empty elsewhere.
let sequenceFixtures = false;
const PLUGIN_ROUTES = {
  ...Object.fromEntries(
    Object.entries(SEQUENCE_ROUTES).map(([route, answer]) => [
      route,
      (query) => (sequenceFixtures ? answer(query) : undefined),
    ])
  ),
  ...GUIDER_PLUGIN_ROUTES,
  ...FOCUSER_PLUGIN_ROUTES,
};

const BACKEND_ROUTES = {
  ...Object.fromEntries(
    DEVICES.map((device) => [
      `/v2/api/equipment/${device}/list-devices`,
      () => (equipmentFixtures && RIG_DEVICES[device]) || [],
    ])
  ),
  ...Object.fromEntries(
    INDI_TYPES.map((type) => [
      `/api/indi/${type}`,
      rigRoute([{ Name: `indi_${type}_a`, Label: `${type} A` }]),
    ])
  ),
  '/api/indi/serialports': rigRoute({
    Ports: [{ Port: '/dev/ttyUSB0', Description: 'FT232R' }],
    ByIdLinks: [],
    ByPathLinks: [],
  }),
  '/v2/api/version/pins': () => pinsVersion,
  '/v2/api/profile/show': (query) =>
    equipmentFixtures ? (query.get('active') === 'true' ? RIG_PROFILE : RIG_PROFILES) : undefined,
  ...Object.fromEntries(
    IMAGE_HISTORY.flatMap((_, index) => [
      [`/v2/api/image/${index}`, () => fs.readFileSync(HISTORY_IMAGE)],
      [`/v2/api/image/thumbnail/${index}`, () => fs.readFileSync(HISTORY_IMAGE)],
    ])
  ),
  '/v2/api/equipment/camera/info': () => ({ Connected: true, BinningModes: [], ReadoutModes: [] }),
  '/v2/api/equipment/guider/info': guiderRoute({
    Connected: true,
    Name: 'PHD2',
    DisplayName: 'PHD2',
    DeviceId: 'PHD2_Single',
    State: 'Looping',
  }),
  '/v2/api/equipment/focuser/info': focuserRoute(FOCUSER_INFO),
  '/v2/api/equipment/focuser/get-settings': () =>
    focuserFixtures && pinsVersion ? FOCUSER_PINS_SETTINGS : undefined,
  '/api/dialogs/list': () => ({
    Count: ninaDialogs.length,
    Dialogs: ninaDialogs,
    ...ninaDialogExtras,
  }),
  '/api/dialogs/count': () => ninaDialogs.length,
};

// Resolves once the DOM stayed untouched for a moment, so lazy pages have finished rendering.
const WAIT_FOR_QUIET_DOM = `new Promise((resolve) => {
  let timer = setTimeout(done, 400);
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(done, 400);
  });
  const deadline = setTimeout(done, 5000);
  function done() {
    observer.disconnect();
    clearTimeout(deadline);
    resolve();
  }
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
})`;

const READ_PAGE_STATE = `({
  text: document.body.innerText,
  scrollWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
})`;

const SUBNAV_BUTTONS = `document.querySelectorAll('.subnav-button')`;
const INFO_TOGGLE = `document.querySelector('[data-testid="info-modal-toggle"]')`;
const DIALOG = `document.querySelector('[role="dialog"]')`;
const CONSOLE_TOGGLE = `document.querySelector('[data-testid="debug-console-toggle"]')`;
const STORES = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value`;
// imageHistoryInfo is no declared state, so it lives on the store instance only.
const API_STORE = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('store')`;
const TOAST_STORE = `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('toastStore')`;
const SET_DEBUG_CONSOLE = (visible) => `${STORES}.settings.showDebugConsole = ${visible}`;
const DIALOG_BACKDROP = `${DIALOG}.parentElement`;
const LOG_BUTTON = `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Log')`;
const MINIMIZED_CHIP = `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === ${JSON.stringify(
  PLATE_SOLVING_DIALOG.Title
)})`;
const DIALOG_ON_TOP = `${DIALOG}.contains(
  document.elementFromPoint(innerWidth / 2, innerHeight / 2))`;
const READ_DIALOG = `({
  ariaModal: ${DIALOG}.getAttribute('aria-modal'),
  name: document.getElementById(${DIALOG}.getAttribute('aria-labelledby'))?.innerText.trim(),
})`;
// Stands in for the overlays that are no Modal, like the number picker or the screen lock.
const COVER_SCREEN = `document.body.insertAdjacentHTML('beforeend',
  '<div id="cover" class="fixed inset-0 z-lock"></div>')`;
const SETTLE = 'new Promise((resolve) => setTimeout(resolve, 200))';

const CONNECT_CAMERA = (connected) => `Object.assign(${STORES}.store, {
  isCameraConnected: ${connected},
  cameraInfo: { Connected: ${connected}, BinningModes: [], ReadoutModes: [] },
})`;
const TPPA_ACTIONS = `document.querySelector('[data-testid="tppa-actions"]')`;
const TPPA_BUTTON = (index) => `${TPPA_ACTIONS}.querySelectorAll('button')[${index}]`;
const SET_TPPA_RUNNING = (running) => `Object.assign(${STORES}.tppaStore, {
  isRunning: ${running},
  showAltitudeError: "00° 12' 34''",
  showAzimuthError: "-00° 09' 21''",
  showTotalError: "00° 15' 42''",
  totalErrorDeg: 0.26,
  AzimuthErrorDeg: 0.21,
  AltitudeErrorDEG: 0.156,
  initialErrorLarge: true,
  declinationSpreadLarge: true,
  declinationSpreadArcsec: 12.5,
  currentMessage: { message: { Response: { Status: 'Capturing image', Progress: 0.4 } } },
})`;
const SET_TPPA_WAITING = `Object.assign(${STORES}.tppaStore, {
  isRunning: true,
  showAltitudeError: '',
  showAzimuthError: '',
  showTotalError: '',
  totalErrorDeg: 0,
  AzimuthErrorDeg: 0,
  AltitudeErrorDEG: 0,
  initialErrorLarge: false,
  declinationSpreadLarge: false,
  currentMessage: null,
})`;
// TppaPage also runs inside the NINA dialog, so its own dialogs can open over another one.
const DIALOGS = `document.querySelectorAll('[role="dialog"]')`;
const LAST_DIALOG = `[...${DIALOGS}].at(-1)`;
const READ_LAST_DIALOG = `(() => {
  const dialog = ${LAST_DIALOG};
  const { left, right } = dialog.getBoundingClientRect();
  // Dialogs that are no Modal have no scrolling body of their own.
  const body = dialog.querySelector('.overflow-y-auto') ?? dialog;
  return {
    onTop: dialog.contains(document.elementFromPoint(innerWidth / 2, innerHeight / 2)),
    name: document.getElementById(dialog.getAttribute('aria-labelledby'))?.innerText.trim(),
    fitsScreen: left >= 0 && right <= innerWidth,
    fitsDialog: body.scrollWidth <= body.clientWidth,
  };
})()`;

function initScript(whatsNewVersion) {
  return `
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupWizardCompleted', 'true');
    localStorage.setItem('tutorialCompleted', 'true');
    localStorage.setItem('tns.whatsnew.version', ${JSON.stringify(whatsNewVersion)});
  `;
}

async function setPins(page, enabled) {
  pinsVersion = enabled ? '1.0.0' : undefined;
  await page.evaluate(`${STORES}.store.isPINS = ${enabled}`);
}

async function openRoute(page, route) {
  page.exceptions.length = 0;
  await page.evaluate(`history.pushState({}, '', ${JSON.stringify(route)});
    dispatchEvent(new PopStateEvent('popstate', { state: {} }));`);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
}

async function checkPage(page, viewportName, label, screenshotName) {
  const state = await page.evaluate(READ_PAGE_STATE);
  const problems = findPageProblems({ ...state, exceptions: page.exceptions });
  await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${screenshotName}.png`));

  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${viewportName} ${label}`);
  problems.forEach((problem) => console.log(`     ${problem}`));
  return problems.map((problem) => `${viewportName} ${label}: ${problem}`);
}

async function visitRoutes(page, viewportName) {
  const failures = [];

  for (const route of ROUTES) {
    await openRoute(page, route);
    failures.push(...(await checkPage(page, viewportName, route, route.slice(1))));
  }

  return failures;
}

// The settings page renders one tab at a time, so the route visit only sees the first one.
async function visitSettingsTabs(page, viewportName) {
  const failures = [];

  await openRoute(page, '/settings');
  await page.waitFor(`${SUBNAV_BUTTONS}.length > 1`, 'the settings tabs');
  const tabCount = await page.evaluate(`${SUBNAV_BUTTONS}.length`);

  for (let index = 1; index < tabCount; index++) {
    page.exceptions.length = 0;
    const tab = await page.evaluate(`(() => {
      const button = ${SUBNAV_BUTTONS}[${index}];
      button.click();
      return button.title;
    })()`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);

    const slug = tab.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    failures.push(...(await checkPage(page, viewportName, `/settings ${tab}`, `settings-${slug}`)));
  }

  return failures;
}

// The debug console is the one Modal that opens without a connected device.
async function checkModal(page, viewportName) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} modal: ${problem}`);
    if (!passed) failures.push(`${viewportName} modal: ${problem}`);
  };

  await page.evaluate(SET_DEBUG_CONSOLE(true));
  await page.waitFor(`!!${CONSOLE_TOGGLE}`, 'the debug console button');
  await page.evaluate(`${CONSOLE_TOGGLE}.click()`);
  await page.waitFor(`!!${DIALOG}`, 'the modal to open');

  const dialog = await page.evaluate(READ_DIALOG);
  expect(dialog.ariaModal === 'true', 'is marked as aria-modal');
  expect(Boolean(dialog.name), 'is named by its header');

  await page.evaluate(COVER_SCREEN);
  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!!${DIALOG}`), 'stays open under another overlay');

  await page.evaluate(`document.getElementById('cover').remove()`);
  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!${DIALOG}`), 'closes on Escape');

  await page.evaluate(SET_DEBUG_CONSOLE(false));
  return failures;
}

// infoModal is the Modal with the most call sites, and it opens from inside other overlays.
async function checkInfoModal(page, viewportName) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} info modal: ${problem}`);
    if (!passed) failures.push(`${viewportName} info modal: ${problem}`);
  };

  await openRoute(page, '/settings');
  await page.evaluate(
    `[...${SUBNAV_BUTTONS}].find((button) => button.title === 'Plate Solver').click()`
  );
  await page.waitFor(`!!${INFO_TOGGLE}`, 'an info button');
  await page.evaluate(`${INFO_TOGGLE}.click()`);
  await page.waitFor(`!!${DIALOG}`, 'the info modal to open');

  expect(await page.evaluate(DIALOG_ON_TOP), 'paints on top');
  const dialog = await page.evaluate(READ_DIALOG);
  expect(Boolean(dialog.name), 'is named by its header');

  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!${DIALOG}`), 'closes on Escape');
  return failures;
}

// Requests that would reach NINA as a cancelled dialog or a stopped mount.
function ninaActions(backend) {
  return [...backend.unhandled].filter((request) =>
    /dialogs\/(click-button|close)|slew\/stop/.test(request)
  );
}

// A tap beside a dialog or Escape must never close a NINA dialog: that would cancel the solve.
// Other dialogs can open over a minimized one, and closing those must not reach it either.
async function checkNinaDialog(page, viewportName, backend) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} NINA dialog: ${problem}`);
    if (!passed) failures.push(`${viewportName} NINA dialog: ${problem}`);
  };
  const closeWithoutButton = async (dismiss) => {
    await page.evaluate(`${LOG_BUTTON}.click()`);
    await page.waitFor(`!!${DIALOG}`, 'the log to open');
    await dismiss();
    await page.evaluate(SETTLE);
  };

  ninaDialogs = [PLATE_SOLVING_DIALOG];
  await page.waitFor(`!!${DIALOG}`, 'the NINA dialog to open');

  await page.evaluate(`${DIALOG_BACKDROP}.click()`);
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!!${DIALOG}`), 'stays open on a tap beside it');

  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!!${DIALOG}`), 'stays open on Escape');
  expect(ninaActions(backend).length === 0, 'sends nothing to NINA on either');

  await page.evaluate(`document.querySelector('[title="Minimize"]').click()`);
  await page.waitFor(`!${DIALOG}`, 'the NINA dialog to minimize');

  await closeWithoutButton(() => page.evaluate(`${DIALOG_BACKDROP}.click()`));
  expect(await page.evaluate(`!${DIALOG}`), 'a dialog over it closes on a tap beside it');
  await closeWithoutButton(() => page.pressEscape());
  expect(await page.evaluate(`!${DIALOG}`), 'a dialog over it closes on Escape');
  expect(await page.evaluate(`!!${MINIMIZED_CHIP}`), 'stays minimized meanwhile');
  expect(ninaActions(backend).length === 0, 'sends nothing to NINA meanwhile');

  // Control: without this, the checks above would also pass if nothing could be observed.
  await page.evaluate(`${MINIMIZED_CHIP}.click()`);
  await page.waitFor(`!!${DIALOG}`, 'the NINA dialog to restore');
  await page.evaluate(`${DIALOG}.querySelector('[aria-label="Close"]').click()`);
  await page.evaluate(SETTLE);
  expect(ninaActions(backend).length > 0, 'its close button does reach NINA');

  ninaDialogs = [];
  ninaActions(backend).forEach((request) => backend.unhandled.delete(request));
  await page.waitFor(`!${DIALOG} && !${MINIMIZED_CHIP}`, 'the NINA dialog to go away');
  return failures;
}

// The NINA dialogs and a toast with real content, so the screenshots show their readouts.
async function checkDialogContent(page, viewportName) {
  const failures = [];

  for (const { name, dialog, extras } of NINA_CONTENT_DIALOGS) {
    page.exceptions.length = 0;
    ninaDialogExtras = extras;
    ninaDialogs = [dialog];
    await page.waitFor(`!!${DIALOG}`, `the ${name} dialog to open`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    failures.push(...(await checkPage(page, viewportName, `${name} dialog`, `dialog-${name}`)));

    ninaDialogs = [];
    ninaDialogExtras = {};
    await page.waitFor(`!${DIALOG}`, `the ${name} dialog to go away`);
  }

  for (const type of ['success', 'error']) {
    page.exceptions.length = 0;
    await page.evaluate(`${TOAST_STORE}.showToast({
      type: '${type}',
      title: 'Exposure finished',
      message: 'M 31, 120 s, saved to the image folder',
      autoClose: false,
    })`);
    await page.evaluate(SETTLE);
    failures.push(...(await checkPage(page, viewportName, `${type} toast`, `toast-${type}`)));
    await page.evaluate(`${TOAST_STORE}.closeToast()`);
  }

  return failures;
}

// The alignment needs a connected camera and fills in its readouts from the socket, which the
// fake backend never writes to. So this sets the stores directly and covers the UI only.
async function checkTppa(page, viewportName, backend) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} TPPA: ${problem}`);
    if (!passed) failures.push(`${viewportName} TPPA: ${problem}`);
  };
  const openDialog = async (button, count, label) => {
    await page.evaluate(`${button}.click()`);
    await page.waitFor(`${DIALOGS}.length === ${count}`, `${label} to open`);
    await page.evaluate(SETTLE);
    const screenshotName = `tppa-${label.replaceAll(' ', '-')}.png`;
    await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, screenshotName));
    const dialog = await page.evaluate(READ_LAST_DIALOG);
    expect(dialog.onTop, `${label} paints on top`);
    expect(Boolean(dialog.name), `${label} is named by its header`);
    expect(dialog.fitsScreen, `${label} fits the screen`);
    expect(dialog.fitsDialog, `${label} needs no sideways scrolling`);
  };
  const closeDialog = async (count, label) => {
    await page.pressEscape();
    await page.evaluate(SETTLE);
    expect((await page.evaluate(`${DIALOGS}.length`)) === count, `${label} closes on Escape`);
  };
  const checkWaiting = async (button, count, label) => {
    await openDialog(button, count, label);
    const dialog = await page.evaluate(`(() => {
      const dialog = ${LAST_DIALOG};
      return {
        waits: dialog.innerText.includes('Waiting for the first measurement'),
        unknownValues: dialog.innerText.split('?').length === 4,
        noCircle: !dialog.querySelector('circle'),
        noEmptyFrame: !dialog.querySelector('.border-line-strong.rounded-card'),
      };
    })()`);
    expect(dialog.waits, `${label} says it is waiting`);
    expect(dialog.unknownValues, `${label} marks all three values as unknown`);
    expect(dialog.noCircle, `${label} draws no error circle`);
    expect(dialog.noEmptyFrame, `${label} shows no empty status frame`);
  };
  const checkDialogs = async (openCount, prefix) => {
    const count = openCount + 1;
    await page.evaluate(SET_TPPA_WAITING);
    await page.waitFor(`${TPPA_ACTIONS}.querySelectorAll('button').length === 3`, 'TPPA to run');
    await checkWaiting(TPPA_BUTTON(1), count, `${prefix}waiting readout`);
    await closeDialog(openCount, `${prefix}waiting readout`);
    await checkWaiting(TPPA_BUTTON(2), count, `${prefix}waiting circle`);
    await closeDialog(openCount, `${prefix}waiting circle`);

    await page.evaluate(SET_TPPA_RUNNING(true));
    await openDialog(TPPA_BUTTON(1), count, `${prefix}error readout`);
    await closeDialog(openCount, `${prefix}error readout`);
    await openDialog(TPPA_BUTTON(2), count, `${prefix}error circle`);
    expect(
      await page.evaluate(`${LAST_DIALOG}.innerText.includes('Capturing image')`),
      `${prefix}error circle shows the status`
    );
    await closeDialog(openCount, `${prefix}error circle`);

    await page.evaluate(SET_TPPA_RUNNING(false));
    await page.waitFor(`${TPPA_ACTIONS}.querySelectorAll('button').length === 1`, 'TPPA to stop');
    await openDialog(TPPA_BUTTON(0), count, `${prefix}settings`);
    await closeDialog(openCount, `${prefix}settings`);
  };

  await openRoute(page, '/mount');
  await page.evaluate(CONNECT_CAMERA(true));
  await page.evaluate(`${STORES}.store.mount.currentTab = 'showTppa'`);
  await page.waitFor(`!!${TPPA_ACTIONS}`, 'the TPPA page');
  await page.evaluate(SET_TPPA_RUNNING(true));
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/mount TPPA', 'mount-tppa')));
  await checkDialogs(0, '');

  await page.evaluate(`${STORES}.store.isPINS = true`);
  await openDialog(TPPA_BUTTON(0), 1, 'PINS settings');
  await closeDialog(0, 'PINS settings');
  await page.evaluate(`${STORES}.store.isPINS = false`);

  // Over the NINA dialog these must come out on top, and closing them must not reach NINA.
  await openRoute(page, '/equipment');
  ninaDialogs = [TPPA_DIALOG];
  await page.waitFor(`!!${TPPA_ACTIONS}`, 'the NINA dialog with the TPPA page');
  await checkDialogs(1, 'nested ');
  expect(ninaActions(backend).length === 0, 'sends nothing to NINA from the nested dialogs');

  ninaDialogs = [];
  await page.waitFor(`!${DIALOG}`, 'the NINA dialog to go away');
  await page.evaluate(CONNECT_CAMERA(false));
  await page.evaluate(`${STORES}.store.mount.currentTab = 'showMount'`);
  return failures;
}

// The history arrives once after the socket connects, which the fake backend never does, so
// this sets the store directly. Deleting needs PINS and goes no further than the confirmation.
async function checkImageHistory(page, viewportName, backend) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} image history: ${problem}`);
    if (!passed) failures.push(`${viewportName} image history: ${problem}`);
  };
  const loadedImages = (selector) =>
    `[...document.querySelectorAll('${selector}')].filter((image) => image.complete && image.naturalWidth > 0).length`;
  const deleteRequests = () =>
    [...backend.unhandled].filter((request) => request.startsWith('DELETE'));

  await page.evaluate(`${API_STORE}.imageHistoryInfo = ${JSON.stringify(IMAGE_HISTORY)}`);
  await openRoute(page, '/seq-mon');
  await page.waitFor(`${loadedImages('.image-container img')} === 1`, 'the last image');
  const graphControls = `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Graph Controls')`;
  await page.evaluate(`${graphControls}.click()`);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/seq-mon stats', 'seq-mon-stats')));
  // Graph controls, sequence status and exposure totals sit below the first screen.
  await page.evaluate(`${graphControls}.scrollIntoView({ block: 'start' })`);
  await page.evaluate(SETTLE);
  await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, 'seq-mon-stats-lower.png'));

  await page.evaluate(`document.querySelector('[aria-label="View settings"]').click()`);
  await page.waitFor(`!!${DIALOG}`, 'the view settings to open');
  await page.evaluate(SETTLE);
  await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, 'seq-mon-settings.png'));
  const settings = await page.evaluate(READ_LAST_DIALOG);
  expect(settings.onTop && settings.fitsScreen, 'view settings fit on top');
  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!${DIALOG}`), 'view settings close on Escape');

  await page.evaluate(`${SUBNAV_BUTTONS}[1].click()`);
  const tileImages = '.grid .image-container img';
  await page.waitFor(
    `${loadedImages(tileImages)} === ${IMAGE_HISTORY.length}`,
    'the history thumbnails'
  );
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  // The tab keeps the scroll position of the stats tab; the toolbar sits at the top.
  await page.evaluate(`(() => {
    let scroller = document.querySelector('.grid');
    while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;
    scroller?.scrollTo(0, 0);
  })()`);
  await page.evaluate(SETTLE);
  failures.push(...(await checkPage(page, viewportName, '/seq-mon history', 'seq-mon-history')));

  await setPins(page, true);
  await page.waitFor(
    `!!document.querySelector('[data-testid="image-history-select-mode"]')`,
    'the select button'
  );
  await page.evaluate(
    `document.querySelector('[data-testid="image-history-select-mode"]').click()`
  );
  await page.evaluate(`document.querySelector('[data-testid="image-history-select"]').click()`);
  await page.waitFor(
    `!document.querySelector('[data-testid="image-history-delete-selected"]').disabled`,
    'a tile to be selected'
  );
  await page.evaluate(SETTLE);
  failures.push(
    ...(await checkPage(page, viewportName, '/seq-mon selection', 'seq-mon-selection'))
  );

  await page.evaluate(
    `document.querySelector('[data-testid="image-history-delete-selected"]').click()`
  );
  await page.waitFor(`!!${DIALOG}`, 'the delete confirmation to open');
  await page.evaluate(SETTLE);
  await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, 'seq-mon-delete.png'));
  const confirmation = await page.evaluate(READ_LAST_DIALOG);
  expect(confirmation.onTop, 'delete confirmation paints on top');
  expect(confirmation.name?.includes('Delete'), 'delete confirmation is named by its header');
  expect(confirmation.fitsScreen && confirmation.fitsDialog, 'delete confirmation fits');
  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!${DIALOG}`), 'delete confirmation closes on Escape');
  expect(deleteRequests().length === 0, 'cancelling deletes nothing');

  await page.evaluate(
    `[...document.querySelectorAll('[data-testid="image-history-selection-bar"] button')].at(-1).click()`
  );
  await setPins(page, false);
  await page.evaluate(`${API_STORE}.imageHistoryInfo = null`);
  return failures;
}

// The rig comes from the fixtures above; the camera reports itself connected through
// camera/info. The PINS part only opens dialogs and writes nothing.
async function checkEquipment(page, viewportName) {
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} equipment: ${problem}`);
    if (!passed) failures.push(`${viewportName} equipment: ${problem}`);
  };
  const buttonWithText = (text) =>
    `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === ${JSON.stringify(text)})`;
  const deviceRow = (name) =>
    `[...document.querySelectorAll('label[for="deviceSelect"]')].find((label) => label.innerText.trim() === ${JSON.stringify(`${name}:`)}).parentElement`;
  const manageProfiles = `document.querySelector('[title="Manage Profiles"]')`;
  const openDialog = async (opener, label, screenshotName, inspect) => {
    await page.evaluate(`${opener}.click()`);
    await page.waitFor(`!!${DIALOG}`, `${label} to open`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${screenshotName}.png`));
    const dialog = await page.evaluate(READ_LAST_DIALOG);
    expect(dialog.onTop, `${label} paints on top`);
    expect(dialog.fitsScreen && dialog.fitsDialog, `${label} fits`);
    await inspect?.();
    await page.pressEscape();
    await page.evaluate(SETTLE);
    expect(await page.evaluate(`!${DIALOG}`), `${label} closes on Escape`);
  };

  equipmentFixtures = true;
  await openRoute(page, '/equipment');
  await page.waitFor(
    `${deviceRow('Camera')}.querySelector('select').value === 'ZWO ASI2600MM Pro'`,
    'the camera list'
  );
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/equipment rig', 'equipment-rig')));

  await setPins(page, true);
  await page.waitFor(
    `!!${buttonWithText('INDI Setup')} && !!${manageProfiles}`,
    'the PINS controls'
  );
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/equipment PINS', 'equipment-pins')));
  expect(
    await page.evaluate(`${manageProfiles}.getBoundingClientRect().width <= 64`),
    'the profile manage button stays a square'
  );

  await openDialog(manageProfiles, 'profile management', 'equipment-profiles', async () => {
    expect(
      await page.evaluate(`${LAST_DIALOG}.innerText.includes('Travel rig')`),
      'profile management lists the profiles'
    );
  });
  await openDialog(buttonWithText('INDI Setup'), 'INDI setup', 'equipment-indi');
  // The cog stays disabled while the row is still fetching its device list.
  const mountCog = `${deviceRow('Mount')}.querySelector('button')`;
  await page.waitFor(`!${mountCog}.disabled`, 'the mount settings button');
  await openDialog(mountCog, 'mount settings', 'equipment-mount-settings', async () => {
    expect(
      await page.evaluate(`${LAST_DIALOG}.querySelector('#devicePort').disabled`),
      'auto search locks the port'
    );
  });

  await setPins(page, false);
  equipmentFixtures = false;
  return failures;
}

// PHD2 comes from the fixtures above. Both settings tabs, NINA and PINS, plus the guiding
// tab's dialogs. Each dialog is only opened and closed again, so nothing is started.
async function checkGuider(page, viewportName) {
  const viewport = VIEWPORTS[viewportName];
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} guider: ${problem}`);
    if (!passed) failures.push(`${viewportName} guider: ${problem}`);
  };
  const buttonWithTitle = (title) =>
    `document.querySelector('button[title=${JSON.stringify(title)}]')`;
  const openTab = async (name) => {
    page.exceptions.length = 0;
    await page.evaluate(
      `[...${SUBNAV_BUTTONS}].find((button) => button.title === ${JSON.stringify(name)}).click()`
    );
    await page.evaluate(WAIT_FOR_QUIET_DOM);
  };
  const openDialog = async (opener, label, screenshotName) => {
    await page.waitFor(`!!${opener}`, `the ${label} button`);
    await page.evaluate(`${opener}.click()`);
    await page.waitFor(`!!${DIALOG}`, `${label} to open`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${screenshotName}.png`));
    const dialog = await page.evaluate(READ_LAST_DIALOG);
    expect(dialog.onTop, `${label} paints on top`);
    expect(dialog.fitsScreen && dialog.fitsDialog, `${label} fits`);
    await page.pressEscape();
    await page.evaluate(SETTLE);
    expect(await page.evaluate(`!${DIALOG}`), `${label} closes on Escape`);
  };

  guiderFixtures = true;
  await page.evaluate(`${STORES}.store.isGuiderConnected = true`);
  await openRoute(page, '/guider');
  await page.waitFor(`!!${buttonWithTitle('Calibration Assistant')}`, 'the PHD2 controls');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/guider PHD2', 'guider-phd2')));
  await openDialog(
    buttonWithTitle('Calibration Assistant'),
    'calibration assistant',
    'guider-calibration-assistant'
  );

  await openTab('Settings');
  failures.push(...(await checkPage(page, viewportName, '/guider settings', 'guider-settings')));

  await setPins(page, true);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(
    ...(await checkPage(page, viewportName, '/guider settings PINS', 'guider-settings-pins'))
  );
  await screenshotWholePage(
    page,
    viewport,
    path.join(SCREENSHOT_DIR, viewportName, 'guider-settings-pins-full.png')
  );
  await openDialog(
    `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Manage Dark Library')`,
    'dark library',
    'guider-dark-library'
  );

  await openTab('Guider');
  await openDialog(
    buttonWithTitle('Review Calibration'),
    'calibration data',
    'guider-calibration-data'
  );

  await setPins(page, false);
  await page.evaluate(`Object.assign(${STORES}.store, {
    isGuiderConnected: false,
    guiderInfo: { Connected: false },
  })`);
  guiderFixtures = false;
  return failures;
}

// The focus tab and every settings tab with a connected focuser, first under NINA, then under
// PINS where the focuser's own settings and the Hocus Focus tabs join in.
async function checkFocuser(page, viewportName) {
  const viewport = VIEWPORTS[viewportName];
  const failures = [];
  // Most of these tabs outgrow the phone screen, so each also gets a whole-page picture.
  const check = async (label, screenshotName) => {
    failures.push(...(await checkPage(page, viewportName, label, screenshotName)));
    await screenshotWholePage(
      page,
      viewport,
      path.join(SCREENSHOT_DIR, viewportName, `${screenshotName}-full.png`)
    );
  };
  const SEGMENT_TABS = `document.querySelectorAll('[role="tab"]')`;
  const openTab = async (name) => {
    page.exceptions.length = 0;
    await page.waitFor(
      `[...${SUBNAV_BUTTONS}].some((button) => button.title === ${JSON.stringify(name)})`,
      `the ${name} tab`
    );
    await page.evaluate(
      `[...${SUBNAV_BUTTONS}].find((button) => button.title === ${JSON.stringify(name)}).click()`
    );
    await page.evaluate(WAIT_FOR_QUIET_DOM);
  };
  const visitSettingsTabs = async (label, screenshotPrefix) => {
    await page.waitFor(`${SEGMENT_TABS}.length > 1`, 'the focuser settings tabs');
    const tabCount = await page.evaluate(`${SEGMENT_TABS}.length`);
    for (let index = 0; index < tabCount; index++) {
      page.exceptions.length = 0;
      const tab = await page.evaluate(`(() => {
        const button = ${SEGMENT_TABS}[${index}];
        button.click();
        return button.innerText.trim();
      })()`);
      await page.evaluate(WAIT_FOR_QUIET_DOM);
      const slug = tab.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await check(`${label} ${tab}`, `${screenshotPrefix}-${slug}`);
    }
  };

  focuserFixtures = true;
  // The page picks its first tab from the connection state, so it has to be there before.
  await page.evaluate(`Object.assign(${STORES}.store, {
    isFocuserConnected: true,
    focuserInfo: ${JSON.stringify(FOCUSER_INFO)},
  });
  ${STORES}.store.profileInfo.FocuserSettings = ${JSON.stringify(FOCUSER_PROFILE_SETTINGS)}`);
  await openRoute(page, '/autofocus');
  await page.waitFor(`!!document.querySelector('#focuser-position')`, 'the focuser controls');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await check('/autofocus focuser', 'focuser');
  await openTab('Settings');
  await visitSettingsTabs('/autofocus settings', 'focuser-settings');

  await setPins(page, true);
  await page.waitFor(`${STORES}.hocusfocus.available === true`, 'Hocus Focus to be detected');
  await openTab('Focuser');
  await page.waitFor(`!!${STORES}.focuserStore.focuserSettings`, 'the PINS focuser settings');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await check('/autofocus PINS', 'focuser-pins');
  await openTab('Settings');
  await visitSettingsTabs('/autofocus settings PINS', 'focuser-settings-pins');
  await openTab('Aberration Inspector');
  await check('/autofocus inspector', 'focuser-inspector');
  await openTab('Tilter');
  await check('/autofocus tilter', 'focuser-tilter');

  await setPins(page, false);
  await page.evaluate(`Object.assign(${STORES}.store, {
    isFocuserConnected: false,
    focuserInfo: { Connected: false, CanReverse: false, CanSetMaxStep: false },
  })`);
  focuserFixtures = false;
  return failures;
}

// Takes the whole page in one picture: the viewport grows until the app's scroller has nothing
// left to scroll, then shrinks back. The scroller is the tallest element that scrolls; boxes
// scrolling inside the page, like a log, keep their own height.
async function screenshotWholePage(page, viewport, filePath) {
  const overflow = await page.evaluate(`(() => {
    const scroller = [document.scrollingElement, ...document.querySelectorAll('*')]
      .filter((element) => element.scrollHeight > element.clientHeight &&
        (element === document.scrollingElement ||
          /auto|scroll/.test(getComputedStyle(element).overflowY)))
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    if (!scroller) return 0;
    scroller.scrollTo(0, 0);
    return scroller.scrollHeight - scroller.clientHeight;
  })()`);
  await page.setViewport({ height: viewport.height + overflow });
  await page.evaluate(SETTLE);
  await page.screenshot(filePath);
  await page.setViewport({ height: viewport.height });
  await page.evaluate(SETTLE);
}

// Every tab with the daemon answering, plus each confirmation the PINS page has. None of them is
// confirmed, so nothing may reach the daemon but reads.
async function checkPins(page, viewportName, backend) {
  const viewport = VIEWPORTS[viewportName];
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} PINS: ${problem}`);
    if (!passed) failures.push(`${viewportName} PINS: ${problem}`);
  };
  const buttonWithText = (text) =>
    `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === ${JSON.stringify(text)})`;
  const openTab = async (name) => {
    page.exceptions.length = 0;
    await page.evaluate(
      `[...${SUBNAV_BUTTONS}].find((button) => button.title === ${JSON.stringify(name)}).click()`
    );
    await page.evaluate(WAIT_FOR_QUIET_DOM);
  };
  const checkTab = async (name, ready, readyLabel) => {
    const slug = `pins-${name.toLowerCase()}`;
    await openTab(name);
    try {
      await page.waitFor(ready, readyLabel);
    } catch (error) {
      // Shows what the tab rendered instead.
      await screenshotWholePage(
        page,
        viewport,
        path.join(SCREENSHOT_DIR, viewportName, `${slug}-timeout.png`)
      );
      throw error;
    }
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    failures.push(...(await checkPage(page, viewportName, `/pins ${name}`, slug)));
    await screenshotWholePage(
      page,
      viewport,
      path.join(SCREENSHOT_DIR, viewportName, `${slug}-all.png`)
    );
  };
  const openDialog = async (opener, label, screenshotName, inspect) => {
    await page.evaluate(`${opener}.scrollIntoView({ block: 'center' }); ${opener}.click()`);
    await page.waitFor(`!!${DIALOG}`, `${label} to open`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${screenshotName}.png`));
    const dialog = await page.evaluate(READ_LAST_DIALOG);
    expect(dialog.onTop, `${label} paints on top`);
    expect(dialog.fitsScreen && dialog.fitsDialog, `${label} fits`);
    await inspect?.();
    await page.pressEscape();
    await page.evaluate(SETTLE);
    const closed = await page.evaluate(`!${DIALOG}`);
    expect(closed, `${label} closes on Escape`);
    // Clears the way for the next check.
    if (!closed) {
      await page.evaluate(`${LAST_DIALOG}.querySelector('[aria-label="Close"]')?.click()`);
      await page.waitFor(`!${DIALOG}`, `${label} to close`);
    }
  };
  const daemonWrites = () =>
    [...backend.unhandled].filter((request) =>
      new RegExp(`^(POST|PUT|PATCH|DELETE) ${PINS_DAEMON_PATH}/`).test(request)
    );

  pinsDaemon = true;
  await setPins(page, true);
  await openRoute(page, '/pins');
  await checkTab(
    'Network',
    `!!document.querySelector('[title="Rescan WiFi networks"]') && document.body.innerText.includes('Star party') && document.body.innerText.includes('Hotspot')`,
    'the Wi-Fi status'
  );
  await page.evaluate(`document.querySelector('[title="Rescan WiFi networks"]').click()`);
  await page.waitFor(`!!document.querySelector('option[value="Neighbour 5G"]')`, 'the scan result');
  await page.evaluate(`(() => {
    const select = document.querySelector('option[value="Neighbour 5G"]').parentElement;
    select.value = 'Neighbour 5G';
    select.dispatchEvent(new Event('change'));
  })()`);
  await page.waitFor(`!!document.querySelector('input[type="password"]')`, 'the password field');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await screenshotWholePage(
    page,
    viewport,
    path.join(SCREENSHOT_DIR, viewportName, 'pins-network-scan-all.png')
  );
  await openDialog(buttonWithText('Disconnect WiFi'), 'Wi-Fi disconnect', 'pins-disconnect');

  await checkTab('Services', `document.body.innerText.includes('Samba')`, 'the services');
  await checkTab(
    'System',
    `!!document.querySelector('select option[value="Europe/Berlin"]')`,
    'the localization'
  );
  await checkTab(
    'INDI',
    `!!document.querySelector('option[value^="indi-eqmod"]')`,
    'the INDI drivers'
  );
  await page.evaluate(`(() => {
    const select = document.querySelector('option[value^="indi-eqmod"]').parentElement;
    select.value = select.querySelector('option[value^="indi-eqmod"]').value;
    select.dispatchEvent(new Event('change'));
  })()`);
  await openDialog(buttonWithText('Install driver'), 'driver install', 'pins-indi-install');
  await openDialog(buttonWithText('Edit config'), 'driver config', 'pins-indi-registry');

  await checkTab(
    'Software',
    `document.body.innerText.includes('pins-plugin-alpaca')`,
    'the plugins'
  );
  await openDialog(buttonWithText('Install'), 'plugin install', 'pins-plugin-install');
  await openDialog(buttonWithText('Uninstall'), 'plugin uninstall', 'pins-plugin-uninstall');
  await openDialog(
    buttonWithText('Switch to unstable repository'),
    'unstable repository',
    'pins-repository-confirm'
  );

  await checkTab('Upgrade', `!!${buttonWithText('Updates available (2)')}`, 'the update hint');
  await openDialog(
    buttonWithText('Updates available (2)'),
    'update list',
    'pins-updates',
    async () => {
      expect(
        await page.evaluate(`${LAST_DIALOG}.innerText.includes('pins-daemon')`),
        'update list names the packages'
      );
    }
  );

  expect(daemonWrites().length === 0, `sends nothing to the daemon but reads (${daemonWrites()})`);
  await setPins(page, false);
  pinsDaemon = false;
  return failures;
}

// The id-based editor with a loaded sequence: full tree, its popovers and dialogs, the simple
// view, the locked state and the settings tab. Nothing is confirmed, so no edit may go out.
async function checkSequence(page, viewportName, backend) {
  const viewport = VIEWPORTS[viewportName];
  const failures = [];
  const expect = (passed, problem) => {
    console.log(`${passed ? 'ok  ' : 'FAIL'} ${viewportName} sequence: ${problem}`);
    if (!passed) failures.push(`${viewportName} sequence: ${problem}`);
  };
  const store = (id) =>
    `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('${id}')`;
  const setViewMode = (mode) =>
    page.evaluate(`${store('settings')}.setSequenceViewMode('${mode}')`);
  const shot = (name) => page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${name}.png`));
  // A teleported popover has no dialog role; it has to be the topmost element at its centre
  // and stay inside the screen.
  const readPopover = (element) => `(() => {
    const popover = ${element};
    if (!popover) return { found: false };
    const rect = popover.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      found: true,
      onTop: popover.contains(hit),
      fits: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
    };
  })()`;
  const checkPopover = async (opener, element, label, screenshotName) => {
    await page.evaluate(`${opener}.scrollIntoView({ block: 'center' })`);
    await page.evaluate(SETTLE);
    await page.evaluate(`${opener}.click()`);
    await page.waitFor(`!!${element}`, `${label} to open`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);
    await shot(screenshotName);
    const popover = await page.evaluate(readPopover(element));
    expect(popover.onTop, `${label} paints on top`);
    expect(popover.fits, `${label} fits`);
    await page.evaluate(`document.body.click()`);
    await page.waitFor(`!${element}`, `${label} to close`);
  };
  const sequenceWrites = () =>
    [...backend.unhandled].filter((request) =>
      /^(POST|PUT|PATCH|DELETE) \/api\/sequence\//.test(request)
    );

  const editorWasSupported = await page.evaluate(`${API_STORE}.sequenceEditorSupported`);
  const viewMode = await page.evaluate(`${STORES}.settings.sequence?.viewMode ?? null`);
  sequenceFixtures = true;
  await page.evaluate(`${API_STORE}.sequenceEditorSupported = true`);
  await setViewMode('full');
  await openRoute(page, '/sequence');
  await page.waitFor(
    `document.body.innerText.includes('Calibration frames') && document.body.innerText.includes('Park Scope')`,
    'the sequence tree'
  );
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/sequence editor', 'sequence-editor')));
  await screenshotWholePage(
    page,
    viewport,
    path.join(SCREENSHOT_DIR, viewportName, 'sequence-editor-all.png')
  );

  const moreButton = `[...document.querySelectorAll('[title="More"]')].at(-1)`;
  await checkPopover(
    moreButton,
    `document.querySelector('.menu-item')?.parentElement`,
    'item menu',
    'sequence-item-menu'
  );
  const issuesBadge = `document.querySelector('[data-testid="sequence-item-issues"]')`;
  await checkPopover(
    issuesBadge,
    `[...document.body.children].find((element) => element.innerText?.trim() === 'Camera is not connected')`,
    'issues popover',
    'sequence-issues'
  );
  await page.evaluate(`${issuesBadge}.parentElement.querySelector('[title="Edit"]').click()`);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await page.evaluate(`${issuesBadge}.scrollIntoView({ block: 'start' })`);
  await page.evaluate(SETTLE);
  failures.push(
    ...(await checkPage(page, viewportName, '/sequence item editor', 'sequence-item-editor'))
  );
  await page.evaluate(`${issuesBadge}.parentElement.querySelector('[title="Edit"]').click()`);

  // The target container's editor holds the coordinate fields.
  const dsoEdit = `[...document.querySelectorAll('[class~="@container"]')]
    .find((element) => element.innerText.trim().startsWith('NGC 7000'))
    .querySelector('[title="Edit"]')`;
  await page.evaluate(`${dsoEdit}.click()`);
  await page.waitFor(
    `[...document.querySelectorAll('label')].some((label) => label.innerText.trim() === 'Target Name')`,
    'the target editor'
  );
  await page.evaluate(`${dsoEdit}.scrollIntoView({ block: 'start' })`);
  await page.evaluate(SETTLE);
  failures.push(
    ...(await checkPage(page, viewportName, '/sequence target editor', 'sequence-target-editor'))
  );
  await page.evaluate(`${dsoEdit}.click()`);

  await checkPopover(
    `[...document.querySelectorAll('[title="Add item"]')].at(-1)`,
    `document.querySelector('input[inputmode="search"]')?.parentElement.parentElement`,
    'add menu',
    'sequence-add-menu'
  );

  const manageButton = `[...document.querySelectorAll('button')].find((button) => button.innerText.trim() === 'Load / save sequences')`;
  await page.evaluate(`${manageButton}.click()`);
  await page.waitFor(`!!${DIALOG} && ${DIALOG}.innerText.includes('Flats.json')`, 'the file list');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await shot('sequence-files');
  const files = await page.evaluate(READ_LAST_DIALOG);
  expect(files.onTop, 'file manager paints on top');
  expect(files.fitsScreen && files.fitsDialog, 'file manager fits');
  await page.pressEscape();
  await page.evaluate(SETTLE);
  expect(await page.evaluate(`!${DIALOG}`), 'file manager closes on Escape');

  await page.evaluate(`${store('sequenceStore')}.setSequenceControlsLocked(true)`);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  await screenshotWholePage(
    page,
    viewport,
    path.join(SCREENSHOT_DIR, viewportName, 'sequence-locked-all.png')
  );
  await page.evaluate(`${store('sequenceStore')}.setSequenceControlsLocked(false)`);

  await setViewMode('simple');
  await page.waitFor(`document.body.innerText.includes('NGC 7000')`, 'the simple view');
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(...(await checkPage(page, viewportName, '/sequence simple', 'sequence-simple')));
  await screenshotWholePage(
    page,
    viewport,
    path.join(SCREENSHOT_DIR, viewportName, 'sequence-simple-all.png')
  );

  page.exceptions.length = 0;
  await page.evaluate(`${SUBNAV_BUTTONS}[1].click()`);
  await page.evaluate(WAIT_FOR_QUIET_DOM);
  failures.push(
    ...(await checkPage(page, viewportName, '/sequence settings', 'sequence-settings'))
  );
  await page.evaluate(`${SUBNAV_BUTTONS}[0].click()`);

  expect(sequenceWrites().length === 0, `sends no edit (${sequenceWrites()})`);
  await openRoute(page, '/equipment');
  if (viewMode) await setViewMode(viewMode);
  await page.evaluate(
    `${API_STORE}.sequenceEditorSupported = ${JSON.stringify(editorWasSupported)}`
  );
  sequenceFixtures = false;
  return failures;
}

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('dist/ not found. Run npm run build:app first.');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'whats-new.json'), 'utf8'));
fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });

const backend = await startFakeBackend({
  rootDir: DIST_DIR,
  routes: BACKEND_ROUTES,
  daemonRoutes: DAEMON_ROUTES,
  pluginRoutes: PLUGIN_ROUTES,
});
const daemonOrigin = backend.origin.replace(/:\d+$/, `:${PINS_DAEMON_PORT}`);
const chrome = await launchChrome();
const failures = [];

try {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    const page = await openPage(chrome.devTools, {
      allowedOrigin: backend.origin,
      originAliases: { [daemonOrigin]: `${backend.origin}${PINS_DAEMON_PATH}` },
      viewport,
      initScript: initScript(version),
    });
    await page.navigate(`${backend.origin}/equipment`);
    await page.waitFor(`!!document.querySelector('.stage-frame')`, 'the app to connect');
    failures.push(...(await visitRoutes(page, viewportName)));
    failures.push(...(await visitSettingsTabs(page, viewportName)));
    failures.push(...(await checkInfoModal(page, viewportName)));
    failures.push(...(await checkModal(page, viewportName)));
    failures.push(...(await checkNinaDialog(page, viewportName, backend)));
    failures.push(...(await checkDialogContent(page, viewportName)));
    failures.push(...(await checkTppa(page, viewportName, backend)));
    failures.push(...(await checkImageHistory(page, viewportName, backend)));
    failures.push(...(await checkEquipment(page, viewportName)));
    failures.push(...(await checkGuider(page, viewportName)));
    failures.push(...(await checkFocuser(page, viewportName)));
    failures.push(...(await checkPins(page, viewportName, backend)));
    failures.push(...(await checkSequence(page, viewportName, backend)));
    await page.close();
  }
} finally {
  await chrome.close();
  await backend.stop();
}

if (process.argv.includes('--verbose')) {
  console.log(`\nUnanswered backend requests:\n${[...backend.unhandled].sort().join('\n')}`);
}
console.log(`\nScreenshots: ${SCREENSHOT_DIR}`);
if (failures.length > 0) {
  console.error(`Browser tests failed: ${failures.length} problem(s).`);
  process.exit(1);
}
console.log('Browser tests passed.');
