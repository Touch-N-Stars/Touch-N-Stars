// A local stand-in for the N.I.N.A. plugin server and Advanced API, for browser tests only.
// It serves the built app and answers on the same origin, so the app needs no connection
// settings: with an empty host and port it falls back to window.location. Passing a browser
// test says nothing about real N.I.N.A., PINS, SignalR or hardware behavior.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const WEBSOCKET_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

const CONTENT_TYPES = {
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
};

// The PINS daemon listens on a port of its own. Tests point that origin here, under this path.
export const PINS_DAEMON_PATH = '/pins-daemon';

// The daemon is cross-origin with an Authorization header, so the browser asks first.
const PREFLIGHT_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
};

function advancedApiResponse(Response) {
  return { Response, Error: '', StatusCode: 200, Success: true, Type: 'API' };
}

function sendJson(response, body, status = 200) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  });
  response.end(JSON.stringify(body));
}

function serveStatic(rootDir, urlPath, response) {
  const resolved = path.join(rootDir, decodeURIComponent(urlPath));
  const isFile =
    resolved.startsWith(rootDir) && fs.existsSync(resolved) && fs.statSync(resolved).isFile();
  // Unknown paths are client-side routes, like on the real plugin server.
  const filePath = isFile ? resolved : path.join(rootDir, 'index.html');
  const contentType = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';

  response.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(response);
}

export async function startFakeBackend({ rootDir, routes = {}, daemonRoutes = {} }) {
  const sockets = new Set();
  const unhandled = new Set();
  let port;

  const pluginRoutes = {
    '/api/version': () => ({ version: '99.0.0.0' }),
    '/api/get-api-port': () => port,
  };
  const advancedApiRoutes = {
    '/v2/api/version': () => '99.0.0.0',
    ...routes,
  };

  const server = http.createServer((request, response) => {
    const { pathname, searchParams } = new URL(request.url, 'http://localhost');
    // A route answering undefined is switched off and falls through to the 404 below.
    const body = advancedApiRoutes[pathname]?.(searchParams);

    if (request.method === 'OPTIONS') {
      response.writeHead(204, PREFLIGHT_HEADERS);
      return response.end();
    }
    if (pathname.startsWith(`${PINS_DAEMON_PATH}/`)) {
      // The daemon sends bare JSON. Its routes answer reads only, so writes stay unhandled.
      const daemonPath = pathname.slice(PINS_DAEMON_PATH.length);
      const daemonBody =
        request.method === 'GET' ? daemonRoutes[daemonPath]?.(searchParams) : undefined;
      if (daemonBody !== undefined) return sendJson(response, daemonBody);
      unhandled.add(`${request.method} ${pathname}`);
      return sendJson(response, { detail: 'Not found' }, 404);
    }
    if (pluginRoutes[pathname]) return sendJson(response, pluginRoutes[pathname]());
    if (body !== undefined) {
      // The Advanced API sends images as the bare file, without its JSON envelope.
      if (Buffer.isBuffer(body)) {
        response.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'image/png',
        });
        return response.end(body);
      }
      return sendJson(response, advancedApiResponse(body));
    }
    if (pathname.startsWith('/v2/api/') || pathname.startsWith('/api/')) {
      unhandled.add(`${request.method} ${pathname}`);
      return sendJson(response, { Error: 'Not found', StatusCode: 404, Success: false }, 404);
    }
    return serveStatic(rootDir, pathname, response);
  });

  // Enough of RFC 6455 for the app to see an open socket. Nothing is ever sent, and incoming
  // frames are drained unread.
  server.on('upgrade', (request, socket) => {
    const accept = createHash('sha1')
      .update(request.headers['sec-websocket-key'] + WEBSOCKET_GUID)
      .digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.on('error', () => {});
    socket.resume();
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  ({ port } = server.address());

  return {
    origin: `http://127.0.0.1:${port}`,
    unhandled,
    async stop() {
      sockets.forEach((socket) => socket.destroy());
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
