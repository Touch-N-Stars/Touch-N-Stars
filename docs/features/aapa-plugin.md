# AAPA Controller plugin

Status: in progress
Date: 2026-10-04

## Goal

The user can run the AAPA (Astrophilos Automated Polar Alignment) from Touch'N'Stars with the
same features as the AAPA Controller panel in N.I.N.A.: connect the device, watch its state,
move it by hand, calibrate the gear ratios, run the Auto-Pilot together with TPPA and edit
every setting, all from a phone, a tablet or the browser.

## Scope

- Runtime modes: NINA/WPF only for now (`isPins: false`)
- Surface: new plugin page `src/plugins/aapa/` (tabs: control, calibration, settings, log)
- Backends touched: the AAPA Controller N.I.N.A. plugin's own WebSocket server
  (`AAPAWebSocketServer.cs`, Fleck, `ws://<nina-host>:8081`). No TNS plugin server, Advanced API
  or pinsdaemon endpoint is involved.
- Dependency: the WebSocket server is not yet part of the public
  [AAPA-Controller-Plugin](https://github.com/Blayzer-Astro/AAPA-Controller-Plugin) release.

## Non-goals

- No change to the TPPA page; the AAPA is controlled from its own page only.
- No PINS support in this version.
- No change to the AAPA N.I.N.A. plugin itself; missing protocol features are proposed below.
- No background connection: the socket lives only while the plugin page is open.

## Acceptance criteria

1. Given N.I.N.A. runs the AAPA plugin with the WebSocket server enabled, when the plugin page
   opens, the status shows "Plugin connected" and the serial port list from the server.
2. Given the server is unreachable, the page names the URL it tried and lists the checks
   (plugin installed, WebSocket enabled and port, firewall); the WebSocket port can be changed
   there and survives an app restart.
3. Given the plugin is connected, when the user picks Auto, a serial port or Wi-Fi + IP and taps
   Connect, the device connects and position X/Y, motion and homed state update live.
4. Nudge, Home, calibration and Auto-Pilot start are disabled while the device is moving, the
   Auto-Pilot runs or a calibration runs; Stop stays available whenever the socket is open.
5. Set home and "Store on AAPA" (EEPROM) ask for confirmation before the command is sent.
6. Editing a setting sends it on blur/Enter; invalid values (wrong type, below minimum) are
   rejected locally and marked; a decimal comma is accepted. A change made in N.I.N.A.'s panel
   shows up in TNS without reloading.
7. When the N.I.N.A. side restarts, the page reconnects on its own and resets the derived
   Auto-Pilot state.
8. Every user-facing string has an `en.json` key; the other 13 locales come in one batch before
   the commit.

## Dimensions considered

| Dimension        | Applies | Note                                                                                        |
| ---------------- | ------- | ------------------------------------------------------------------------------------------- |
| Runtime modes    | no      | NINA only for now, by decision                                                              |
| Polling          | no      | push-based plugin socket; no NINA state involved, `fetchAllInfos` untouched                 |
| Mobile           | yes     | 48 px targets, 4-tab layout fits 360 px, numeric keyboards via `inputmode`                  |
| i18n             | yes     | `plugins.aapa.*`                                                                            |
| Equipment safety | yes     | every motion is an explicit tap; destructive actions confirm; no retries of commands        |
| Error paths      | yes     | unreachable server, server restart, invalid values (criteria 2, 6, 7)                       |
| Native           | yes     | plain `ws://` to the N.I.N.A. host, same as the existing NINA sockets                       |
| Persistence      | yes     | only the WebSocket port, in `localStorage`                                                  |
| Tests            | yes     | `src/plugins/aapa/utils/__tests__/aapaProtocol.test.js` (payloads, coercion, log heuristic) |

## Auto-Pilot and calibration state

The current protocol reports neither. TNS derives both from the log lines
(`deriveFromLog()` in `utils/aapaProtocol.js`): "Auto-Pilot started." / "Iteration N:" set it,
"Auto-Pilot stopped/cancelled/finished" and "Auto-Pilot: …" clear it; the calibration markers
work the same way. A client that connects mid-run does not see the run until the next marker.
Explicit server fields (see below) override the heuristic as soon as a server sends them.

## Protocol wishlist for the AAPA plugin author

To be passed on to Blayzer. TNS already feature-detects every item, so none of them breaks an
older server.

1. **Auto-Pilot state in `state`**: `autoPilotRunning` (bool), `autoPilotIteration` (int), and
   the last correction. `AAPACore.AutoPilotStateChanged` and `AutoPilot.ProgressUpdated` exist
   but are not broadcast.
2. **Last TPPA reading in `state`**: `azErrorDeg`, `altErrorDeg`, `totalErrorArcSec`, timestamp,
   from `TPPALogMonitor.ErrorDetected`.
3. **`STOP` command**: an emergency motor stop. Today only `StopAutoPilot` stops the motors.
4. **Per-axis commands**: `HOME_AZ`, `HOME_ALT`, `RESET_X`, `RESET_Y`, as in the panel.
   `HOME`/`SET_HOME` currently fire both axes without awaiting the first.
5. **`SEND_SPEED_ACCEL`**: push speed, acceleration and the Y limits to the firmware like the
   panel's send button. `set` only stores them in N.I.N.A. today.
6. **Calibration state and cancel**: `calibrationRunning` in `state` plus a `CANCEL_CALIBRATION`
   command.
7. **`supportedCommands`** (string array) and/or `protocolVersion` in `state`, so clients can
   detect the optional commands above.
8. Numbers in log lines use the N.I.N.A. culture (e.g. `+0,1234°` on a German system); invariant
   culture would make them machine-readable.
