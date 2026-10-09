---
name: api-endpoint
description: Add or change an API call between the app and its backends — the Touch'N'Stars plugin server (C#), the NINA Advanced API, or the PINS daemon. Use when wiring a new endpoint into src/services/api/, when a request hits the wrong port or host, or when the apiService surface snapshot test fails.
---

# Adding an API endpoint

A new endpoint usually spans two repositories. Both are configured as working
directories:

- **Plugin server (C#)** —
  `…/N.I.N.A-Plugin-for-Touch-N-Stars/Touch-N-Stars/Server/Controllers/*.cs`
  and `Server/Services/*.cs`
- **App (this repo)** — `src/services/api/<domain>.js` → `src/services/apiService.js`
  → a Pinia store

## Pick the right base URL first

The most common mistake is not the code, it is the host/port. `getUrls()` in
`src/services/api/core.js:52` returns five, built in `getBaseUrl()` (line 30):

| Key | Points at | Use for |
| --- | --- | --- |
| `BASE_URL` | `http://<host>:<store.apiPort>/v2/api` | NINA **Advanced API** V2 |
| `API_URL` | `http://<host>:<connection.port>/api/` | Touch'N'Stars **plugin server** |
| `PLUGINSERVER_URL` | plugin server root, no path | non-`/api` plugin routes |
| `TARGETPIC_URL` | plugin server `/api/targetpic` | target thumbnails |
| `PINSDAEMON_URL` | `http://<host>:8000` | PINS system daemon |

The two ports differ on purpose: the plugin server sits on the instance port the
user configured, the Advanced API on the `apiPort` learned during the handshake.
`src/services/__tests__/apiServiceEndpoints.test.js` pins exactly this.

In dev, port `8080` is rewritten to `5000` (`core.js:37-40`). The same rewrite is
duplicated in `apiPinsService.js:17-20`.

## Backend: plugin server controller

Controllers are EmbedIO `WebApiController`s with `[Route(HttpVerbs.Get, "/…")]`
(see `MetricsController.cs` for the minimal shape: a static service instance and
a `Task<T>`-returning method). A new controller must be registered in
`Server/TouchNStarsServer.cs:45` with `.WithController<…>()` — the routes are not
discovered automatically. The whole API is mounted under `/api`, which is why the
frontend uses `API_URL`.

Keep logic in `Server/Services/`, not in the controller.

## Frontend: domain module, then facade

Add the method to the matching module in `src/services/api/` — 18 domain
modules (camera, mount, phd2, sequence, profile, system, framing, image, flats,
filesystem, plugins, tppa, equipment, hocusfocus, pinsDevices, tenmicron, atlas,
nativeGuider) plus
`core.js`, which is infrastructure and not spread into the facade.
Use the helpers from `core.js` rather than raw axios where they fit:
`simpleGetRequest(url)` and `getWithParams(url, params)` both unwrap
`response.data` and rethrow.

```js
async getFoo(id) {
  const { BASE_URL } = getUrls();
  return simpleGetRequest(`${BASE_URL}/equipment/foo/${id}`);
}
```

Call `getUrls()` **inside** the method. Hoisting it to module scope freezes the
host/port from before the user connected.

`src/services/apiService.js` spreads all 18 domain modules into one object, so two
modules exporting the same method name silently overwrite each other. That is
what the snapshot test guards.

### The snapshot test

Adding or removing a method breaks
`src/services/__tests__/apiServiceSurface.test.js` until you regenerate:

```bash
node --import ./scripts/test-loader.mjs scripts/dump-api-surface.mjs
```

The failure message names this command itself. Regenerate deliberately — a
surprise diff there usually means an accidental name collision, not a stale
snapshot.

## PINS vs. NINA

`src/services/apiPinsService.js` is a separate service for PINS-only endpoints
and carries its **own copy** of `getBaseUrl` — with a different key name
(`pinsSystem` alongside `pinsDaemon`). Changing host/port logic in one place and
not the other creates silent drift; check both.

PINS daemon calls need a bearer token: `getPinsDaemonAuthHeaders()` from
`core.js:88`, which resolves through instance settings, store settings, several
localStorage keys, and finally the default token.

**Never branch UI behavior on `store.isPINS` when the field itself can simply be
probed.** Feature-detect on the payload instead, as `src/store/cameraStore.js:109`
does for `TempChangeRunning`: use the real value when the backend reports it,
fall back to a heuristic when it does not. That keeps the app working against
official NINA/ninaAPI builds which lack the field.

## Store integration

New data is delivered by the 2 s poll (`fetchAllInfos` in `src/store/store.js`),
not by the WebSocket — `/v2/socket` does not deliver every state change. Add the
fetch there, and drop unchanged payloads before writing to the store rather than
polling faster.

## Testing

Follow `apiServiceEndpoints.test.js`: `installBrowserGlobals()`, then
`freshPinia()`, then mock `axios.get` and assert on the URL that was built.

**Gotcha:** `apiService` caches its store references from the **first** active
Pinia. A test file must use one Pinia for all its tests and mutate store state
per test — a fresh Pinia per test silently keeps the old references.
