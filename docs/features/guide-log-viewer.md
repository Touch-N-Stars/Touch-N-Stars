# Guide Log Viewer plugin

Status: implemented
Date: 2026-11-10

## Goal

The native guider writes one PHD2-format guide log per night. The History tab turns that
log into answers the morning after: how good was guiding, when did it go wrong and why,
what did the mount do on its own, and which light frames were hurt. It replaces the trip
to PHD2 Log Viewer, whose information is useful but whose UI is not: it starts from the
whole night, points at the problems itself, and stays usable on a phone.

## Scope

- Runtime modes: PINS (`isPins`, on by default). A plugin of its own with a navigation
  entry, not a tab of `/guider`: the logs are files of the guider, so the viewer works with
  no equipment connected, while another guider is connected, and the morning after.
- Surface: `src/plugins/guide-log-viewer/` (view, components, parser and analysis in
  `utils/`, tests in `__tests__/`). It reuses the native guider's chart theme, help tips
  and incident replay.
- Backend: `GET /api/internal-guider/logs` (list) and `GET /api/internal-guider/logs/{name}`
  (text, gzip) of the Touch'N'Stars plugin, served from PINS' `IGuideLogArchive`
  (`NINA.Equipment`). See the plugin's `INTERNAL_GUIDER_API.md`.
- Local files: any PHD2-format guide log (PINS or PHD2 itself) can be opened from the
  device; it is parsed in the browser and never uploaded.

## Non-goals

- No editing or deleting of logs, no export.
- No guiding logic and no live data: the live graph stays on the Guiding tab.
- No server-side analysis. The plugin serves the text; parsing and analysis run in the
  app, so the same code works for logs opened from the device.

## Acceptance criteria

1. The viewer lists the guide logs newest night first, the one being written marked, and
   opens the newest. Without the backend routes it says so and still offers a local file.
2. A night shows guided time, typical RMS (RA/Dec), dithers with the median settle time,
   frames without a star and the number of problems at a glance.
3. The night overview shows the rolling RMS per moment coloured against the night's own
   typical RMS, calibrations, lost stars, findings (triangles) and light frames. Dragging
   selects a range, dragging the frame moves it, its edges resize it (a frame too narrow to
   grab an edge inside it moves from inside and resizes from just outside), a tap selects
   the session under it, a double tap shows the whole night. Works with touch.
4. The guide graph spans the page and shows the selected range: RA/Dec error, the rolling
   total RMS (30 frames) and the RMS of the range in its header, pulses, optionally the
   motion without corrections, settling, dithers, lost frames, findings and the light
   frames, with SNR and star mass below. Hovering or touching names the frame and the
   markers under the cursor. Drag (mouse) or pinch (touch) zooms, the wheel
   zooms around the cursor, one finger pans; buttons step and zoom too.
5. The statistics follow the selected range: RMS (about the mean), peak, mean offset,
   drift of the uncorrected motion, pulse share, pulses at the limit, polar alignment
   estimate (one session, at least 5 minutes, |Dec| < 80°), RA oscillation, Dec
   reversals, lost and settling frames, median SNR. Settling frames can be left out. Every
   value and headline tile has an ⓘ that explains it on tap.
6. "Worth a look" lists star losses, rough stretches, jumps, faded star (clouds), slow or
   failed settling, pulses at the limit, guider alerts, flips, breaks, setting changes,
   calibrations and the guider's incidents; a tap zooms there and highlights it, an
   incident opens its replay.
7. The periodogram of the selected range (RA without corrections, RA guided, Dec guided)
   marks the worm period and its harmonics.
8. Sessions list target, pier side and RMS; details show the header (camera, algorithms,
   backlash, calibration) and, for a calibration, the star's path and the orthogonality.
9. With the image history of the running PINS session, each light frame is graded by the
   guiding during it and can be sorted worst first.
10. Units switch between arcseconds and pixels; preferences persist per viewer.

## Decisions

- **Times are the log's wall clock.** PHD2 logs local time without a zone; the viewer keeps
  it as "wall seconds" (the wall clock read as UTC) and formats with UTC, so the axis shows
  the rig's time whatever the viewer's zone. Instants from elsewhere (incidents, images) are
  converted with the rig's zone from the log list (`timeZone`, IANA via `Intl`, else
  `utcOffsetMinutes`).
- **Everything is relative to the night itself.** The overview colours, the rough-stretch,
  jump and cloud findings and the light frame grades compare with the night's own typical
  (median rolling 30-frame) RMS or SNR, because absolute arcseconds mean different things
  on different rigs. The headline RMS is that typical value; the RMS over all frames is
  shown below it, since a few minutes of tracking off can make it meaningless.
- **Motion without corrections** is reconstructed from the pulses: each pulse moves the star
  by pulse × rate (RA rate from the normalised rate at the session's declination, Dec as
  logged), its sign learned from which errors the guider sent it for. It restarts at every
  dither and lock change. Drift is the slope fitted per such segment; times are taken
  relative to the segment start (epoch seconds squared lose all precision).
- **One marker vocabulary.** A triangle is always an entry of "Worth a look", coloured by
  its severity (red serious, amber worth a look, grey flips and calibrations), on the
  overview and on the guide graph alike; incidents and guider alerts are entries of that
  list too, not markers of their own. Dithers are dashed lines, lost frames ticks at the
  bottom, light frames a strip at the top. Legends draw the glyphs as they appear.
- **Layout follows the questions.** Night at a glance, then where (overview, worth a look,
  sessions; on a phone the problems come before the session list), then what happened (the guide graph across the full width), then the
  numbers of the range (statistics, target, periods), then the light frames.
- **Findings merge** when the same kind repeats within 5 minutes, with a count, so a cloudy
  hour is one entry and not fifty.
- **Parsed logs are cached** for the app session (name, size, modified); the log being
  written is reloaded on demand. Picking another night cancels a download still running.
- **Canvas for the overview and the target plot, uPlot for the graphs**, as on the native
  guider page; the plugin's view is an async component, so none of it loads before it is
  opened.

## Dimensions considered

| Dimension   | Applies | Note                                                                             |
| ----------- | ------- | -------------------------------------------------------------------------------- |
| Runtime     | yes     | PINS native guider only; 404/501 from an older backend shows a notice.           |
| Polling     | no      | Logs load on demand; the active log has a reload button.                         |
| Mobile      | yes     | Stacked cards on phones, touch selection, pinch and pan, 40-48 px targets.       |
| i18n        | yes     | All strings under `plugins.guideLogViewer`.                                      |
| Performance | yes     | A 30 000-line night parses and analyses in about 0.2 s; periodogram binned.      |
| Error paths | yes     | Download errors and files that are no guide log are shown in the header card.    |
| Persistence | yes     | Unit, settling switch, pulse and uncorrected toggles, filters in `localStorage`. |
| Tests       | yes     | Parser, analysis and view helpers in the plugin's `__tests__/`.                  |
