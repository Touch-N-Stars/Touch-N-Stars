// Drives headless Chrome over the DevTools Protocol with Node's built-in WebSocket, so the
// browser tests need no extra dependency.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findChrome() {
  const chromePath = CHROME_CANDIDATES.find((candidate) => candidate && fs.existsSync(candidate));
  if (!chromePath) throw new Error('Chrome not found. Set CHROME_PATH.');
  return chromePath;
}

function waitForDevToolsUrl(chrome) {
  return new Promise((resolve, reject) => {
    let output = '';
    chrome.stderr.on('data', (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) resolve(match[1]);
    });
    chrome.once('error', reject);
    chrome.once('exit', (code) => reject(new Error(`Chrome exited early (${code}): ${output}`)));
  });
}

function connectDevTools(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 1;

  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const { resolve, reject, method } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${method}: ${message.error.message}`));
      else resolve(message.result);
      return;
    }
    listeners
      .get(message.method)
      ?.forEach((listener) => listener(message.params, message.sessionId));
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener('error', () => reject(new Error('DevTools connection failed')));
    socket.addEventListener('open', () =>
      resolve({
        send(method, params = {}, sessionId) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params, sessionId }));
          return new Promise((done, fail) => {
            pending.set(id, { resolve: done, reject: fail, method });
          });
        },
        on(method, listener) {
          listeners.set(method, [...(listeners.get(method) ?? []), listener]);
        },
        close: () => socket.close(),
      })
    );
  });
}

export async function launchChrome() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tns-browser-test-'));
  const chrome = spawn(
    findChrome(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--hide-scrollbars',
      // CI runners do not provide the user namespaces Chrome's sandbox needs.
      ...(process.env.CI ? ['--no-sandbox'] : []),
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const devTools = await connectDevTools(await waitForDevToolsUrl(chrome));

  return {
    devTools,
    async close() {
      devTools.close();
      const exited = new Promise((resolve) => chrome.once('exit', resolve));
      chrome.kill();
      await exited;
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

// Opens a page that can only reach allowedOrigin over HTTP: every other request fails in the
// browser, so a test can never touch a real device. Fetch interception does not see WebSockets,
// but the app derives their host from its connection settings, which stay on the fake backend.
export async function openPage(devTools, { allowedOrigin, viewport, initScript }) {
  const { targetId } = await devTools.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await devTools.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => devTools.send(method, params, sessionId);
  const exceptions = [];

  devTools.on('Runtime.exceptionThrown', ({ exceptionDetails }, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    exceptions.push(exceptionDetails.exception?.description ?? exceptionDetails.text);
  });
  devTools.on('Fetch.requestPaused', ({ requestId, request }, eventSessionId) => {
    if (eventSessionId !== sessionId) return;
    const allowed = request.url.startsWith(`${allowedOrigin}/`);
    const command = allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest';
    send(command, allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' }).catch(
      () => {}
    );
  });

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { ...viewport, deviceScaleFactor: 1 });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: initScript });

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description);
    return result.value;
  };

  return {
    exceptions,
    evaluate,
    navigate: (url) => send('Page.navigate', { url }),
    async pressEscape() {
      const key = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
    },
    async waitFor(expression, description, timeoutMs = 15000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Timed out waiting for ${description}`);
    },
    async screenshot(filePath) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    },
    close: () => devTools.send('Target.closeTarget', { targetId }),
  };
}
