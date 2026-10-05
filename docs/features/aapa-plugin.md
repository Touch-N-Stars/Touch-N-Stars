# AAPA Controller plugin

Status: in progress
Date: 2026-10-04

## Goal

The user can run the AAPA (Astrophilos Automated Polar Alignment) from Touch'N'Stars with the
same features as the AAPA Controller panel in N.I.N.A.: connect the device, watch its state,
move it by hand, calibrate the gear ratios, run the Auto-Pilot together with TPPA and edit
every setting, all from a phone, a tablet or the browser. The polar alignment itself is one
button: it starts TPPA (unless it already runs) and then the Auto-Pilot, and stops TPPA when
the Auto-Pilot ends.

## Scope

- Runtime modes: NINA/WPF only for now (`isPins: false`)
- Surface: new plugin page `src/plugins/aapa/` (tabs: control, calibration, settings, log)
- Backends touched: the AAPA Controller N.I.N.A. plugin's own WebSocket server
  (`AAPAWebSocketServer.cs`, Fleck, `ws://<nina-host>:8081`). No TNS plugin server, Advanced API
  or pinsdaemon endpoint is involved for the device itself. The one-button flow additionally
  drives TPPA over the Advanced API's `/v2/tppa` socket (`src/services/websocketTppa.js`) with
  the rig-shared TPPA settings (`tppaStore.settings`, start message built by
  `src/utils/tppaStart.js`, shared with the TPPA page).
- Dependency: the WebSocket server is not yet part of the public
  [AAPA-Controller-Plugin](https://github.com/Blayzer-Astro/AAPA-Controller-Plugin) release.

## Non-goals

- No behaviour change on the TPPA page; it only shares the start-message builder now.
- No PINS support in this version.
- No change to the AAPA N.I.N.A. plugin itself; missing protocol features are proposed below.
- No background connection: the socket lives only while the plugin page is open. Leaving the
  page during a run leaves TPPA and the Auto-Pilot running in N.I.N.A.; only the automatic TPPA
  stop needs the page open.

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
8. Given the device is connected and TPPA is not running, when the user taps "Start polar
   alignment", TPPA starts with the saved TPPA settings and, once the socket acknowledges it, the
   Auto-Pilot starts. If TPPA already runs, only the Auto-Pilot starts.
9. When the Auto-Pilot ends (tolerance reached, cancelled or failed), TPPA is stopped. When TPPA
   is stopped elsewhere, the Auto-Pilot is stopped. Stop stops both.
10. TPPA not acknowledging the start (15 s), the Auto-Pilot not starting (20 s) or TPPA going
    silent for 2 min ends the flow with a message and stops what it started. Manual moves and
    calibration are disabled while the flow runs.
11. Every user-facing string has an `en.json` key; the other 13 locales come in one batch before
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
