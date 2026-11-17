# Meridian flip day test

Status: in progress
Date: 2026-10-24

## Goal

The user can rehearse the real meridian flip in daylight, standing next to the mount:
does the scope clear the tripod or pier in the position past the meridian, do the
cables reach on both sides, does NINA flip at all with these settings. Finding this out
at night, mid-sequence, is what costs data or hardware.

## Scope

- Runtime modes: both
- Surface: button in the Meridian flip settings tab, opening a guided modal
- Backends touched: Advanced API `/v2/api/sequence/load`, `/sequence/start`, `/sequence/stop`,
  `/sequence/state`, `/equipment/mount/slew/stop`, `/equipment/mount/tracking` (all existing)

## Approach

A first version used two plain slews across the meridian. That only rehearses the
movement: it never reaches the counterweight-up position past the meridian where
collisions happen, it bypasses NINA's flip routine, and it ignores the flip settings.

A second version slewed to the start point inside the test sequence. On the Pi (LX200
OnStep, `Preferred Pier Side = East`, `Minutes Past Meridian = 28`) that goto already put
the OTA on the post-flip side: OnStep takes its preferred side for every goto within its
meridian limit. Switching the mount to "Best" is no option, it makes the real flips
unreliable for that user.

The user therefore drives the scope by hand (`moveAxis`) to a point a few minutes east of
the meridian, counterweight down. A plain axis move never re-chooses the pier side. The
modal shows the time to the meridian and to the flip and a live checklist (at least the
lead of 1 min before the earliest flip - past the meridian is fine when the flip comes
later, side of pier `pierWest` = NINA's expected side before the flip, altitude
and sun distance along the path up to the latest flip); start is enabled only when it
passes and no manual move is running. Then the app loads a small NINA sequence
(`src/utils/meridianFlipTestSequence.js`) without any slew: tracking on, then wait steps as
long as the user's exposures, with NINA's `MeridianFlipTrigger` on the root. Without a
target in the context the trigger flips on the current coordinates
(`MeridianFlipTrigger.Execute` falls back to `GetCurrentPosition()`); the flip goto then
lets the mount pick the post-flip side, as at night. NINA flips after
the first wait step that ends inside the window — exactly as it does after an exposure at
night — with the profile's settings and its own flip routine. Once started, NINA drives
everything, so the app may be closed while the test runs.

NINA's `/equipment/mount/flip` was ruled out: `MeridianFlip` only flips once the mount
has tracked past the meridian (`IndiTelescope.MeridianFlip`), so the app would have to
drive the wait itself.

## Non-goals

- The app does not check guiding after the flip. It only passes on what NINA logged; with
  the caps on, recentering cannot succeed and the result says that this is expected.
- No automatic retry and no movement without explicit confirmation.

## Acceptance criteria

1. Before the start both confirmations are visible with their reasons, without tapping:
   caps on telescope, finder and guide scope (sun risk in daylight), and the user standing
   at the mount. Start stays disabled until both are ticked; the ticks are not stored.
2. The test cannot start while the mount is disconnected, parked, unable to slew, has no
   site location, or a sequence is running; each case says why.
3. The screen states that a test sequence replaces the loaded sequence, and a
   confirmation dialog repeats it before anything is loaded.
4. The exposure length decides the wait steps; the screen shows the expected duration and
   the latest flip time derived from the flip settings.
5. The user drives the scope to the start point; the app does not slew there. While
   positioning, the app shows the time to the meridian and to the flip and checks live
   that the scope is at least 1 min before the earliest flip, on the side before the flip (an unknown side
   does not block), and stays at least 20° above the horizon and 45° from the sun up to the
   latest flip. Start stays disabled until these pass and no manual move is running.
   The pad marks the arrow to press for each failing point, with the reason. The sky
   direction of each button is learned from the mount's reaction while it is held (axis
   reversal, driver sign); on the post-flip side no arrow is marked and the app offers
   Home instead.
6. The test starts from the side before the flip without changing any mount setting
   (verified with OnStep `Preferred Pier Side = East`).
7. While running, a countdown from NINA's `TimeToMeridianFlip` shows the earliest and
   latest flip time, and STOP halts the sequence, any slew and tracking.
8. When NINA's flip trigger has finished, the app stops the test sequence, asks the
   person at the mount whether the scope turned without touching anything, and shows
   whether NINA logged an error and in which step; if no flip comes within the expected
   time plus 10 min, the app stops sequence and tracking and says so.

## Dimensions considered

| Dimension        | Applies | Note                                                                                                          |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| Runtime modes    | yes     | Advanced API in both; no `isPINS` branch                                                                      |
| Polling          | yes     | mount state from the existing `mountInfo` poll; one `createPoller` for the timeout                            |
| Mobile           | yes     | modal at 360 px, large STOP button, `min-h-touch`                                                             |
| i18n             | yes     | new keys in `en.json` only during the work                                                                    |
| Equipment safety | yes     | moves the mount: two confirmations plus a dialog, STOP always visible, sun distance                           |
| Error paths      | yes     | load/start failure shown with NINA's error; mount disconnect and overdue flip end it                          |
| Native           | yes     | app backgrounded or closed: NINA keeps running the test and flips on its own                                  |
| Persistence      | yes     | a running test is kept in localStorage; after a reload the modal returns if NINA still runs the test sequence |
| Tests            | yes     | `meridianFlipDayTest.js` (plan, start position) and `meridianFlipTestSequence.js` (JSON)                      |

## Findings

- The INDI telescope simulator reports `AlignmentMode: "AltAz"` while behaving as a German
  equatorial mount with a side of pier, so `AlignmentMode` is not used to hide the test.
- `TimeToMeridianFlip` counts down to the _latest_ flip time (meridian + max minutes).
- Simulator run (min 5 / max 10, 60 s steps): NINA flipped at 5.0 min past the meridian,
  right after the wait step that ended inside the window. The side of pier switches
  already during the flip slew; the trigger stays `RUNNING` through settling and
  recentering. Completion is therefore taken from the trigger leaving `RUNNING`, not from
  the pier side — that also covers mounts without side of pier.
- A flip whose recentering fails (no camera) still ends with the trigger `FINISHED`, and
  the sequence simply continues. The failure shows only in NINA's log
  (`Meridian Flip - … after meridian flip error`), with the failed step logged right
  before it. The test reads the plugin's `/api/logs` once at the end
  (`analyzeFlipLog`). NINA also disconnected the filter wheel in that error path.
- OnStep with a preferred pier side (`East`) and a meridian limit (28 min) puts the OTA on
  the post-flip side for any goto up to that limit east of the meridian. NINA log on the Pi,
  2026-10-25: goto to 3 min east of the meridian ended counterweight up. Hence no goto.
- These findings are the starting point for the separate "report a failed flip" feature.

## Open questions

- Exact log wording of the autofocus step after a flip has not been observed yet; it
  falls back to "unknown step" until it is.
