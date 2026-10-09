# PINS native guider page

Status: implemented
Date: 2026-09-27

## Goal

PINS can guide with its own built-in guider instead of PHD2. When it does, `/guider`
shows a full guiding page for it: the live guide frame with its stars, the guide graph
and target plot, statistics, calibration, the event log, the settings and the dark
library. Two tools help beyond the live view: the **Guiding Coach**, which measures the
camera, the sky and the mount and recommends settings, and the **flight recorder**,
which saves the frames and telemetry around the moments guiding went wrong (incidents)
for a replay. The guide camera is PINS' guide camera slot (`/v2/api/equipment/guidecamera`),
set up in equipment connect and in the setup wizard like the imaging camera.

The guider itself, including the Guiding Coach and the flight recorder, was developed by
@aduffeck (https://github.com/aduffeck/pins/tree/pins-guider).

## Scope

- Runtime modes: PINS only. Everything native is gated on the connected guider's
  `DeviceId === 'InternalGuider'` (`NATIVE_GUIDER_ID`, `src/utils/nativeGuider.js`),
  or, before the first connect, on it being the profile's selected guider. NINA and
  PHD2 users get the same page as before.
- Surface: the native branch of `src/views/GuidingPage.vue`, the page under
  `src/components/guider/native/`, and native branches in the guider connect settings,
  equipment connect and the setup wizard's guider step.
- Backends touched: the Touch'N'Stars plugin server's `/api/internal-guider/*` and the
  `/ws/internal-guider` feed (plugin port). They serve PINS' `IAdvancedGuider` contract
  (`NINA.Equipment`); the Coach and the flight recorder are optional parts of it.
- State owner: `nativeGuiderStore` (live, not persisted). View preferences (settings
  view, graph and frame options, Coach options, incident filter, last seen incident)
  stay in `localStorage` under `nativeGuider.*`.

## Non-goals

- No change for PHD2 users: same page, same status bar guider panel behaviour.
- No guiding logic in the app. Every value is computed by the guider; the app renders it
  and sends commands.
- No second transport: the page uses the plugin server like the rest of the app, no
  direct connection to PINS.

## Acceptance criteria

1. Given PHD2 or another guider, `/guider` renders as before: the status bar guider panel
   opens on entry, and on leaving the page restores the panel that was open before,
   unless the user switched panels meanwhile. The native UI and its chart library are
   not downloaded.
2. Given the native guider is selected but not connected, the page says so and the
   settings stay usable, so the guide camera can be chosen before the first connect.
3. While the native guider is connected, steps, alerts, state, calibration, settle,
   frame, statistics, darks, Coach, hint and incident events arrive over
   `/ws/internal-guider` app-wide, so critical alerts toast on every page. The page also
   polls `/status` every 2 s (background-aware) as the source of truth.
4. Controls are enabled per guider state; a rejected or failed command is toasted with
   the backend's reason.
5. Settings are grouped Basic/Advanced by the backend's `basic` flag, hidden when they
   don't apply (`dependsOn`/`appliesTo`) and validated before saving. A setting that
   needs a reconnect offers one.
6. Texts the backend sends in English (setting labels and descriptions, alert title,
   explanation and fix, Coach findings, incident causes) are shown in the UI language,
   looked up by setting name or stable code; an unknown name or code shows the backend's
   text, so a newer backend never shows a blank.
7. The Coach can run while another tab is shown (a banner leads back); its report and
   history stay available. Live hints show in the state strip.
8. Incidents list with a badge for new ones, can be kept, deleted, downloaded and
   replayed frame by frame; Mark saves the current moment.
9. Every user-facing string exists in all 14 locales.

## Decisions

- **Charts use uPlot.** The guide graph redraws at up to 1 Hz on phones; uPlot (MIT,
  about 50 KB) does that cheaply. The native layout, the Coach tab, the Incidents tab and
  the replay are async components, and uPlot has its own `uplot-vendor` chunk
  (`vite.config.js`), so it stays out of the chunks other users load.
- **Two feeds on purpose.** The socket gives low latency; the status poll recovers
  anything the socket missed or dropped.
- **Own axios instance** (`src/services/api/nativeGuider.js`): the global interceptors
  turn non-2xx responses into resolved placeholders and drop the backend's reason; the
  page shows the real reason instead of "HTTP 409".
- **Native mode leaves the status bar panel alone**: the page has its own graph and
  needs the height.
- **The guide camera is an equipment slot, not a guider setting.** The guider's own
  `GuideCameraDriver`/`GuideCameraDevice` settings are legacy on the backend; the app
  has no picker for them. The guider setting `GuideSource` chooses between that camera
  and the built-in simulator.
- **Name in the UI is "Native Guider"**, while PINS lists the device as "Internal
  Guider" (id `InternalGuider`). Before the first connect the chooser's display name is
  matched on both words (`isNativeGuiderSelected`).
- **Dec guide mode Drift** is reported as one `status.decDrift` object (direction, drift,
  safety valve), `null` outside that mode.

## Dimensions considered

| Dimension        | Applies | Note                                                                                                         |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------ |
| Runtime modes    | yes     | PINS only; gated on the device id, NINA/PHD2 untouched (criterion 1).                                        |
| Polling          | yes     | 2 s status poll via `useBackgroundAwarePolling` next to the socket (criterion 3).                            |
| Mobile           | yes     | One panel per tab on phones, a dashboard grid from 1024 px; 48 px touch targets.                             |
| i18n             | yes     | Criteria 6 and 9.                                                                                            |
| Equipment safety | yes     | Stop, recalibrate and clear calibration ask for confirmation; a running Coach asks before it is interrupted. |
| Error paths      | yes     | Backend reasons shown as they are; 409 "no native guider" is a state, not an error.                          |
| Native           | yes     | Socket and polling resume after the app returns from the background.                                         |
| Persistence      | yes     | Only view preferences in `localStorage`; guider state is live.                                               |
| Tests            | yes     | Pure utils, the store and the API module are covered by `node:test` tests.                                   |

## Implementation

| Part                                    | File                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| REST client and live feed               | `src/services/api/nativeGuider.js`, `src/services/websocketNativeGuider.js`     |
| State, feed lifecycle, toasts           | `src/store/nativeGuiderStore.js` (feed started in `src/App.vue`)                |
| Pure helpers: page, Coach, incidents    | `src/utils/nativeGuider.js`, `nativeGuiderCoach.js`, `nativeGuiderIncidents.js` |
| Page, tabs, graph data                  | `src/components/guider/native/` (`NativeGuiderLayout.vue`, `graphData.js`)      |
| Guiding Coach                           | `src/components/guider/native/coach/`                                           |
| Flight recorder                         | `src/components/guider/native/incidents/`                                       |
| Guide camera setup                      | `settingsGuiderConnect.vue`, `connectEquipment.vue`, `WizardGuiderStep.vue`     |
| Toast action button, SubNav count badge | `src/store/toastStore.js`, `ToastModal.vue`, `src/components/SubNav.vue`        |
| Tests                                   | `__tests__/` next to the utils, the store, the API module and `graphData.js`    |
