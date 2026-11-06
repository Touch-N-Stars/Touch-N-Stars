// Renders every main page of the built app in headless Chrome against a local fake backend,
// because the unit test loader stubs .vue files and never sees a real page. No device is
// connected, so this covers the app shell and each page's disconnected state only.
//
// Screenshots land in .cache/browser-tests/ for before/after comparisons of UI refactors.
// Run `npm run build:app` first.
import fs from 'node:fs';
import path from 'node:path';
import { launchChrome, openPage } from './lib/chrome.mjs';
import { startFakeBackend } from './lib/fakeBackend.mjs';
import { findPageProblems } from './lib/browserChecks.mjs';

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

const BACKEND_ROUTES = {
  ...Object.fromEntries(
    DEVICES.map((device) => [`/v2/api/equipment/${device}/list-devices`, () => []])
  ),
  '/api/dialogs/list': () => ({ Count: ninaDialogs.length, Dialogs: ninaDialogs }),
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
const SET_DEBUG_CONSOLE = (visible) =>
  `document.querySelector('#app').__vue_app__.config.globalProperties.$pinia.state.value
    .settings.showDebugConsole = ${visible}`;
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

function initScript(whatsNewVersion) {
  return `
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupWizardCompleted', 'true');
    localStorage.setItem('tutorialCompleted', 'true');
    localStorage.setItem('tns.whatsnew.version', ${JSON.stringify(whatsNewVersion)});
  `;
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

if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
  console.error('dist/ not found. Run npm run build:app first.');
  process.exit(1);
}

const { version } = JSON.parse(fs.readFileSync(path.join(DIST_DIR, 'whats-new.json'), 'utf8'));
fs.rmSync(SCREENSHOT_DIR, { recursive: true, force: true });

const backend = await startFakeBackend({ rootDir: DIST_DIR, routes: BACKEND_ROUTES });
const chrome = await launchChrome();
const failures = [];

try {
  for (const [viewportName, viewport] of Object.entries(VIEWPORTS)) {
    const page = await openPage(chrome.devTools, {
      allowedOrigin: backend.origin,
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
