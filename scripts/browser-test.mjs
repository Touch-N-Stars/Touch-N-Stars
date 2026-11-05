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

const BACKEND_ROUTES = Object.fromEntries(
  DEVICES.map((device) => [`/v2/api/equipment/${device}/list-devices`, () => []])
);

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

function initScript(whatsNewVersion) {
  return `
    localStorage.setItem('setupCompleted', 'true');
    localStorage.setItem('setupWizardCompleted', 'true');
    localStorage.setItem('tutorialCompleted', 'true');
    localStorage.setItem('tns.whatsnew.version', ${JSON.stringify(whatsNewVersion)});
  `;
}

async function visitRoutes(page, viewportName) {
  const failures = [];

  for (const route of ROUTES) {
    page.exceptions.length = 0;
    await page.evaluate(`history.pushState({}, '', ${JSON.stringify(route)});
      dispatchEvent(new PopStateEvent('popstate', { state: {} }));`);
    await page.evaluate(WAIT_FOR_QUIET_DOM);

    const state = await page.evaluate(READ_PAGE_STATE);
    const problems = findPageProblems({ ...state, exceptions: page.exceptions });
    const name = route.slice(1);
    await page.screenshot(path.join(SCREENSHOT_DIR, viewportName, `${name}.png`));

    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${viewportName} ${route}`);
    problems.forEach((problem) => {
      console.log(`     ${problem}`);
      failures.push(`${viewportName} ${route}: ${problem}`);
    });
  }

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
