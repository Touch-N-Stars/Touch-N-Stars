import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startFakeBackend } from '../../../scripts/lib/fakeBackend.mjs';

let backend;
let rootDir;

before(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tns-fake-backend-'));
  fs.writeFileSync(path.join(rootDir, 'index.html'), '<title>app</title>');
  fs.writeFileSync(path.join(rootDir, 'data.json'), '{"file":true}');
  backend = await startFakeBackend({
    rootDir,
    routes: { '/v2/api/equipment/camera/list-devices': () => ['Fake camera'] },
  });
});

after(async () => {
  await backend.stop();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

const get = (urlPath) => fetch(`${backend.origin}${urlPath}`);

test('the handshake reports a plugin version and its own port as the API port', async () => {
  const { version } = await (await get('/api/version')).json();
  const port = await (await get('/api/get-api-port')).json();

  assert.equal(version, '99.0.0.0');
  assert.equal(port, Number(new URL(backend.origin).port));
});

test('Advanced API routes answer in the N.I.N.A. envelope', async () => {
  const body = await (await get('/v2/api/equipment/camera/list-devices')).json();

  assert.equal(body.Success, true);
  assert.deepEqual(body.Response, ['Fake camera']);
});

test('unknown API calls get a 404 and are recorded', async () => {
  const response = await get('/v2/api/unknown');

  assert.equal(response.status, 404);
  assert.ok(backend.unhandled.has('GET /v2/api/unknown'));
});

test('files are served and client-side routes fall back to index.html', async () => {
  assert.deepEqual(await (await get('/data.json')).json(), { file: true });
  assert.equal(await (await get('/equipment')).text(), '<title>app</title>');
});

test('sockets open and stay open', async () => {
  const socket = new WebSocket(`${backend.origin.replace('http', 'ws')}/v2/socket`);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', reject);
  });
  socket.send('subscribe');

  assert.equal(socket.readyState, WebSocket.OPEN);
  socket.close();
});
