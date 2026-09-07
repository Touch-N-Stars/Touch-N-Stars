# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Perihelion plugin: comet/asteroid non-sidereal tracking, computed live from real orbital elements. Asteroid orbits are stable enough to ship as a fixed list needing no internet at all; comet elements are fetched from MPC and refreshed automatically (or on demand via Sync Now), then cached to disk so tracking keeps working offline between syncs. Browse tab searches comets and asteroids by brightness; Position & Path shows tonight's altitude, a 10-night motion path with a real angular scale bar and drift readout, and a live framing view centered on the object's real position with the camera's actual field of view overlaid; Track offers Quick Track for immediate manual tracking (optionally re-applying the rate every 15 minutes so a long session stays accurate as the object's true rate drifts) and Add to Sequence to build a full Advanced Sequencer container (unpark, center, track, guide, imaging loop, optional meridian-flip and autofocus triggers). Predicted magnitude is cross-checked against real observer-reported brightness (COBS) where available.

### Fixed
- Perihelion: the framing view's path/"Tonight" overlay rendered in the wrong place because its canvas element defaulted to the browser's 300x150 fallback size instead of filling its container — a CSS quirk specific to `<canvas>`/`<img>`/`<video>` elements, where `position: absolute; inset: 0` alone doesn't stretch them the way it does a normal element. Also fixed a related white-screen-on-pinch-zoom issue on mobile (same root cause).
- Perihelion: the 10-night path chart's start/end date labels could overflow the card at either edge; also added a real angular scale bar and a total/per-night drift readout so the chart carries more than a bare line between two dates.

## [App6.3.0-beta3] - 2026-09-02

### Changed

- Framing assistant: Mosaic grids can now go up to 20x20 fields instead of 5x5

### Fixed

- Instances: A scanned PINS rig no longer switches itself to the address of another rig on the same network

## [App6.3.0-beta2] - 2026-08-31

### Added

- File browser: Files can be saved to the device, lists can be sorted and searched, and several entries can be selected for downloading or deleting at once
- File browser: The plugin is now available in NINA mode as well, not only on PINS
- Sky chart: The time axis now always runs from midday to midday with midnight in the middle, so a whole night is visible at a glance and the "now" marker sits at its real time
- Sky chart: A moon button shows the moon's altitude curve plus its illumination and distance to the target

### Changed

- File browser: Image previews are now rendered on the server with NINA's own stretch settings, so FITS, XISF and raw files open faster and look like they do in NINA - stretch factor, black clipping, unlinked stretch and debayer can be adjusted directly in the preview. In NINA mode this needs Touch'N'Stars plugin 1.4.0.0 or newer; older versions get a notice instead of a broken preview
- File browser: Renaming files works again, and WebP and BMP files are now counted as images by the images-only filter
- Observation planner: Redesigned target cards - name, preview, values and actions no longer overlap or get cut off on narrow screens
- Telescopius: Target lists can now be imported from a Telescopius CSV export, including the position angle as framing rotation, and imported targets can be edited afterwards

### Fixed

- File browser: A spinner is shown while a preview is loading, and files that cannot be rendered show an error message with a download option instead of silently starting a download
- Plugins: The "plugin outdated" notice now names the host the plugin actually runs in, NINA or PINS, instead of always saying NINA

## [App6.3.0-beta1] - 2026-08-30

### Added

- Sequence editor: A deep sky object container can now be loaded into the framing assistant with one tap
- Framing assistant: "set to sequence target" now lets you pick which sequence target to overwrite, or add a new one at a chosen position

### Changed

- Haptics: Every button, switch and navigation entry now gives haptic feedback, switchable under Settings > General
- Guider (Dither): Max dither pixel value increased from 100 to 1000

## [App6.2.0] - 2026-08-27

Summary of all changes since 6.1.2 (released in beta1-beta9, see below for the individual beta releases).

### Added

- Plugin Screen lock: The app's controls can now be locked from the status bar so nothing gets changed by accident - in the dark, with the device in a pocket, or when handing it to someone else. Everything stays visible and keeps updating while locked; unlocking requires a 2 s long press
- Sequence editor: Items can now be saved directly from the editor
- Guiding (PHD2): The ZFilter guide algorithm is now available for the Dec axis
- Guiding: The PHD2 settings modal was replaced by a SubNav tab on the guider page
- Settings: The app settings stored on this device (language, saved instances, layout, plugin settings) can now be exported to a file and restored on another device. Equipment settings kept in the NINA/PINS profile are not included and need a separate backup
- PINS: Voltage Status & Undervoltage notification
- Hardware Compatibility plugin: Look up which hardware works with which driver, and report your own findings to a shared, crowdsourced database
- Guiding (PHD2): The Predictive PEC period length can now be set
- Status bar: Entries can be reordered and hidden under Settings > General, just like the navigation bar
- Mount: The target search under Slew now also finds stars, not just DSOs
- Nightsummary Plugin: is now also supported in NINA
- Sequence: The PHD2 Tools trigger "Interrupt and retry when RMS above" can now be configured in the app — threshold, mode, how long the guiding has to stay calm, the recovery timeout and the maximum number of repetitions
- PINS setup and settings: Configure the rig's system locale, Wi-Fi country, timezone and keyboard layout. The setup assistant reads the current Pi values and places this step before Wi-Fi; the same live settings remain available under General Settings on every client, with searchable lists of the values supported by the Pi
- Setup wizard: The first-run setup and the equipment configuration are now one guided assistant that opens automatically on first start. It covers language, the connection to your rig, and then the equipment: mount, location, telescope, camera, focuser and filter wheel. On PINS it additionally covers the rig's Wi-Fi, its software updates, the maximum slew speed and guiding. Every step writes its values straight to the profile, so nothing is lost if you leave in between
- Setup wizard: The camera step reads the sensor size from the connected camera and offers to write it into the profile if it differs from what is stored there. Cameras that do not report a sensor size - DSLRs typically - get input fields instead. Together with the pixel size, which no driver reports and which therefore always has to be entered by hand, the resulting image scale in arcsec/px is shown directly, so a mistyped value is obvious right away
- Setup wizard: The guiding step converts the dither distance for you. NINA stores it in guide camera pixels while the usual recommendations (10-15 px) are given in pixels of the imaging camera, and the two differ by a factor of 2-5 depending on the guide scope. The step shows both image scales, the resulting offset on sky and what is currently in the profile, and warns if PHD2 itself is working with a different focal length or pixel size
- Setup wizard: On PINS, every device step can install a missing 3rd party INDI driver without leaving the wizard, and the camera step lists natively supported cameras first - an INDI driver is only needed if the camera does not appear there

### Changed

- TPPA: Exposure time, gain and filter now apply to the whole rig instead of to one device - every client connected to the same instance sees the same values
- Settings: The General tab was split into Connection & Location, Interface and System, so related settings are easier to find
- Sequence: The item that is currently running can no longer be edited, disabled, reset, deleted or moved
- Sequence: Loading a sequence now closes the dialog right away and shows a spinner until the sequence is loaded
- Status bar: Entries no longer jump to the front when something needs attention, and Progress, Log and Instance are no longer pinned to the right edge
- Image history: Thumbnails load in batches while scrolling, several at a time, and are kept when you leave the tab
- Sequence: Cameras that only accept a fixed set of gain values (most Canon/Nikon DSLRs) now offer those values as a list instead of a free number field, in every exposure and flat item
- Setup: The initial setup is no longer mandatory and can be cancelled at any point. Previously every screen redirected back to the setup page until an instance had been configured; now the app stays usable and the connection can be added later under Settings. The wizard can be reopened at any time from Settings, and on PINS also from the PINS page
- 3rd party INDI drivers (PINS): Camera drivers can now be installed as well. The driver registry has always accepted the camera type, only the install dialog rejected it
- Guiding: The dither distance can now be set in steps of 0.5 pixels instead of whole pixels, because converting from imaging pixels rarely lands on a round number
- Pinsdaemon: Rework of Wifi handling

### Fixed

- Sequence editor: The save, clear and manage-sequences buttons no longer appear when connected to NINA - they only work with PINS
- Guiding: Manual VNC guide cameras now correctly set the PHD2Camera profile value
- Atlas: Camera rotation now matches NINA
- Equipment: INDI devices that only get power after the driver started (e.g. a rotator on a power box port) were listed as OFFLINE and could not be connected. The driver is now reloaded automatically instead of requiring a manual reselect in the INDI setup dialog
- Equipment: A device selection now goes straight into the profile instead of being reset by the next device list refresh, so "No device" can finally be selected
- Guiding (PHD2): On narrow screens the guiding status covered the star image and the star profile. The status is now shown at the bottom left, and both tiles adapt their size to the available width instead of being cut off
- Status bar: Panels opened from the status bar covered the lower edge of the page including its rounded corners
- Mount: With drivers that keep reporting "slewing" after a park has finished (e.g. ZWO AM5N), the mount status stayed on a red "Slewing" with an endlessly turning spinner instead of "Parked", and the slew button stayed a red stop button. A parked mount is now never shown as slewing. During a real slew the status stays green with the spinner instead of turning yellow
- Image history: Filtering (e.g. to lights only) took very long on large sessions - all images were downloaded regardless of the filter, oldest first. Only the filtered images are fetched now, starting with the ones on screen
- Webcam: Layout and settings dialog on iOS, and snapshots that stayed "Disconnected" in the app
- Livestack: The zoom and image controls could be hidden behind the status bar at the bottom of the screen
- 3rd party INDI drivers (PINS): When a search returned no packages, the driver selection and the "Edit config" button disappeared along with the results, so there was no way back without reloading. Both now stay in place and the selection is simply disabled
- Dialogs: On narrow screens content that did not fit the dialog was centred, so its left edge was cut off and could not be reached by scrolling either - in the settings dialog headings and input labels appeared clipped ("onnection Settings"). Dialog content now shrinks to the dialog width, and content that genuinely cannot shrink starts at the left edge and stays scrollable
- Celestia Atlas: Fix star constellation - Western skycultures

## [App6.1.4-beta9] - 2026-08-26

### Added

- Plugin Screen lock: The app's controls can now be locked from the status bar so nothing gets changed by accident - in the dark, with the device in a pocket, or when handing it to someone else. Everything stays visible and keeps updating while locked; unlocking requires a 2 s long press
- Framing: The camera rotation from every plate solve is shown in the Framing Assistant and on the rotator page
- Atlas: A second field-of-view frame shows the solved camera rotation next to the target frame

### Fixed

- Framing: The sky chart labels are now translated instead of always English

### Fixed

- Sequence editor: The save, clear and manage-sequences buttons no longer appear when connected to NINA - they only work with PINS

## [App6.1.4-beta8] - 2026-08-24

### Added

- Sequence editor: Items can now be saved directly from the editor
- Guiding (PHD2): The ZFilter guide algorithm is now available for the Dec axis
- Guiding: The PHD2 settings modal was replaced by a SubNav tab on the guider page

### Fixed

- Guiding: Manual VNC guide cameras now correctly set the PHD2Camera profile value
- Atlas: Camera rotation now matches NINA

## [App6.1.4-beta7] - 2026-08-19

### Added

- Settings: The app settings stored on this device (language, saved instances, layout, plugin settings) can now be exported to a file and restored on another device. Equipment settings kept in the NINA/PINS profile are not included and need a separate backup

### Changed

- TPPA: Exposure time, gain and filter now apply to the whole rig instead of to one device - every client connected to the same instance sees the same values
- Settings: The General tab was split into Connection & Location, Interface and System, so related settings are easier to find

## [App6.1.4-beta6] - 2026-08-19

### Added

- PINS: Voltage Status & Undervoltage notification

## [App6.1.4-beta5] - 2026-08-18

### Added

- Hardware Compatibility plugin: Look up which hardware works with which driver, and report your own findings to a shared, crowdsourced database

### Fixed

- Equipment: INDI devices that only get power after the driver started (e.g. a rotator on a power box port) were listed as OFFLINE and could not be connected. The driver is now reloaded automatically instead of requiring a manual reselect in the INDI setup dialog
- Equipment: A device selection now goes straight into the profile instead of being reset by the next device list refresh, so "No device" can finally be selected

## [App6.1.4-beta4] - 2026-08-16

### Added

- Guiding (PHD2): The Predictive PEC period length can now be set
- Status bar: Entries can be reordered and hidden under Settings > General, just like the navigation bar
- Mount: The target search under Slew now also finds stars, not just DSOs
- Nightsummary Plugin: is now also supported in NINA

### Changed

- Sequence: The item that is currently running can no longer be edited, disabled, reset, deleted or moved
- Sequence: Loading a sequence now closes the dialog right away and shows a spinner until the sequence is loaded
- Status bar: Entries no longer jump to the front when something needs attention, and Progress, Log and Instance are no longer pinned to the right edge

### Fixed

- Guiding (PHD2): On narrow screens the guiding status covered the star image and the star profile. The status is now shown at the bottom left, and both tiles adapt their size to the available width instead of being cut off
- Status bar: Panels opened from the status bar covered the lower edge of the page including its rounded corners
- Mount: With drivers that keep reporting "slewing" after a park has finished (e.g. ZWO AM5N), the mount status stayed on a red "Slewing" with an endlessly turning spinner instead of "Parked", and the slew button stayed a red stop button. A parked mount is now never shown as slewing. During a real slew the status stays green with the spinner instead of turning yellow

## [App6.1.4-beta3] - 2026-08-15

### Changed

- Image history: Thumbnails load in batches while scrolling, several at a time, and are kept when you leave the tab

### Fixed

- Image history: Filtering (e.g. to lights only) took very long on large sessions - all images were downloaded regardless of the filter, oldest first. Only the filtered images are fetched now, starting with the ones on screen

## [App6.1.4-beta2] - 2026-08-11

### Added

- Sequence: The PHD2 Tools trigger "Interrupt and retry when RMS above" can now be configured in the app — threshold, mode, how long the guiding has to stay calm, the recovery timeout and the maximum number of repetitions
- PINS setup and settings: Configure the rig's system locale, Wi-Fi country, timezone and keyboard layout. The setup assistant reads the current Pi values and places this step before Wi-Fi; the same live settings remain available under General Settings on every client, with searchable lists of the values supported by the Pi

### Changed

- Sequence: Cameras that only accept a fixed set of gain values (most Canon/Nikon DSLRs) now offer those values as a list instead of a free number field, in every exposure and flat item

### Fixed

- Webcam: Layout and settings dialog on iOS, and snapshots that stayed "Disconnected" in the app
- Livestack: The zoom and image controls could be hidden behind the status bar at the bottom of the screen

## [App6.1.4-beta1] - 2026-08-08

### Added

- Setup wizard: The first-run setup and the equipment configuration are now one guided assistant that opens automatically on first start. It covers language, the connection to your rig, and then the equipment: mount, location, telescope, camera, focuser and filter wheel. On PINS it additionally covers the rig's Wi-Fi, its software updates, the maximum slew speed and guiding. Every step writes its values straight to the profile, so nothing is lost if you leave in between
- Setup wizard: The camera step reads the sensor size from the connected camera and offers to write it into the profile if it differs from what is stored there. Cameras that do not report a sensor size - DSLRs typically - get input fields instead. Together with the pixel size, which no driver reports and which therefore always has to be entered by hand, the resulting image scale in arcsec/px is shown directly, so a mistyped value is obvious right away
- Setup wizard: The guiding step converts the dither distance for you. NINA stores it in guide camera pixels while the usual recommendations (10-15 px) are given in pixels of the imaging camera, and the two differ by a factor of 2-5 depending on the guide scope. The step shows both image scales, the resulting offset on sky and what is currently in the profile, and warns if PHD2 itself is working with a different focal length or pixel size
- Setup wizard: On PINS, every device step can install a missing 3rd party INDI driver without leaving the wizard, and the camera step lists natively supported cameras first - an INDI driver is only needed if the camera does not appear there

### Changed

- Setup: The initial setup is no longer mandatory and can be cancelled at any point. Previously every screen redirected back to the setup page until an instance had been configured; now the app stays usable and the connection can be added later under Settings. The wizard can be reopened at any time from Settings, and on PINS also from the PINS page
- 3rd party INDI drivers (PINS): Camera drivers can now be installed as well. The driver registry has always accepted the camera type, only the install dialog rejected it
- Guiding: The dither distance can now be set in steps of 0.5 pixels instead of whole pixels, because converting from imaging pixels rarely lands on a round number
- Pinsdaemon: Rework of Wifi handling

### Fixed

- 3rd party INDI drivers (PINS): When a search returned no packages, the driver selection and the "Edit config" button disappeared along with the results, so there was no way back without reloading. Both now stay in place and the selection is simply disabled
- Dialogs: On narrow screens content that did not fit the dialog was centred, so its left edge was cut off and could not be reached by scrolling either - in the settings dialog headings and input labels appeared clipped ("onnection Settings"). Dialog content now shrinks to the dialog width, and content that genuinely cannot shrink starts at the left edge and stays scrollable
- Celestia Atlas: Fix star constellation - Western skycultures

## [App6.1.2] - 2026-07-31

Summary of all changes since 6.0.0 (released in beta1-beta2, see below for the individual beta releases).

### Added

- Language: Catalan (ca-ES) is now available as a full app language - all 4332 texts are translated, including plugins and settings. Many thanks to @albcn for the complete translation
- Livestack (PINS): New "RGB combination" section in the livestack settings that combines three mono stacks (e.g. LRGB or SHO) of a target into a colour image, with the filter-to-channel mapping pre-filled and editable. The result appears as the "RGB" filter next to the individual channels and can be removed again. On Windows this is unchanged and still done through the plugin's own wizard, so the section only appears on PINS
- Flat Assistant: Optional target name for flats - the name can be entered directly or taken from the favorites and is then used when saving the flats. Requires TNS plugin 1.2.8.0 or newer (always available on PINS)
- Filter Offset Calculator: Warning when fewer than 3 iterations are configured - with fewer runs a failed or inaccurate AutoFocus cannot be detected and is averaged into the offset
- Filter Offset Calculator: Stopping now asks for confirmation, since all measurements taken so far are discarded and the profile is restored

### Changed

- Celestia Atlas: The photographic survey is now drawn as curved WebGL tile meshes at display resolution instead of a viewport-sized raster, and every region keeps its best already-loaded tile visible until the sharper one arrives
- Celestia Atlas: Landscapes (default and custom) are rendered on the same GPU mesh and now correctly hide celestial objects behind them instead of letting them shine through

### Fixed

- Celestia Atlas: The sky stays sharp during clicks, drags, pinches and periodic mount/view updates - no more recurring clear-to-blurry flicker, and no more isolated sharp tiles in an otherwise blurry viewport
- Celestia Atlas: The sky view now recovers on its own when the graphics context is lost (e.g. after the app has been in the background for a long time) instead of staying black
- Instance discovery: Searching for NINA instances scanned all mDNS service types at the same time, and because the native plugin only supports one search at a time, the searches cancelled each other - instances were found only sporadically or not at all. The service types are now scanned one after another, results from all of them are collected, and already-found instances stay visible while the search is still running
- Filter Offset Calculator: The offset preview now shows all filters of the profile, stated relative to the selected AutoFocus filter (which is 0). Filters that were not measured in this run keep their previous spacing, and only differences of the old offsets are used - a profile that an older build left holding absolute focuser positions no longer produces offsets in the thousands
- Filter Offset Calculator: A failed apply is now reported with an error message instead of silently doing nothing
- Settings: Values of -1 were shown as an inherited default in every numeric profile setting. This is now limited to the settings that actually use -1 as a placeholder (plate-solve gain falls back to the camera, a filter's autofocus exposure time to the focuser). Everywhere else -1 is again an ordinary value and is no longer silently replaced, and a value being edited is no longer overwritten while typing

## [App6.1.0-beta1] - 2026-07-30

### Added

- Livestack (PINS): New "RGB combination" section in the livestack settings that combines three mono stacks (e.g. LRGB or SHO) of a target into a colour image, with the filter-to-channel mapping pre-filled and editable. The result appears as the "RGB" filter next to the individual channels and can be removed again. On Windows this is unchanged and still done through the plugin's own wizard, so the section only appears on PINS

## [App6.0.0] - 2026-07-30

### Breaking Changes

- Sky view: The Stellarium Web sky view has been replaced by the new Celestia Atlas renderer. The old sky view is removed - Celestia Atlas is now the only sky renderer in the app
- NINA plugin update required: Please update the Touch-N-Stars plugin in NINA to the matching version before using this release. On Android and iOS the Atlas catalogue and survey data are loaded from the NINA plugin, so with an older plugin the sky view stays empty or does not open at all
- Settings: Saved sky-view settings are migrated automatically on first start. The migration is one-way - returning to 5.x after starting 6.0.0 will not restore the old Stellarium settings
- Landscapes: Generated plugin landscapes now use an update-safe persistent data route instead of the replaceable application asset directory and are moved there automatically. Stellarium landscape files remain supported through the landscape creator plugin

### Added

- Celestia Atlas: Complete offline M1-M110 coverage, a dedicated Messier catalogue filter, and designation-plus-common-name labels such as "M81 - Bode's Galaxy"
- Celestia Atlas: Independent persisted limiting-magnitude controls for stars, galaxies and other deep-sky objects; lower values keep only brighter objects and Auto preserves adaptive field-of-view filtering
- Celestia Atlas: Search and render 8,658 supplemental Abell/ACO, Barnard, LBN, LDN, RCW, Sharpless 2 and vdB objects, 86 SIMBAD A66 planetary nebulae and 8,780 HYG stars from package-local data without requiring a network
- Celestia Atlas: Selected catalogue targets now expose aliases and the complete favorite, Framing Assistant, sequence-target, slew/center/rotate and mount-sync workflow through the existing Touch-N-Stars action panel
- Celestia Atlas: Persist independent marker filters for 17 deep-sky object types and nine offline catalogue sources, including separate Abell/ACO galaxy cluster and Abell planetary-nebula controls

### Changed

- Celestia Atlas: Defer engine/catalogue loading until first open, retain one paused warm viewer after that, split the compact OpenNGC, supplemental DSO, Abell planetary-nebula, HYG and curated bright-sky payloads into first-open chunks, and reduce mobile panorama, search, FOV sampling and lifecycle work
- Celestia Atlas: Make the shared selected-target panel safe-area aware and independently scrollable on short mobile landscape screens; its favorite dialog now renders at the application root instead of inside the sky overlay
- Logfile collector plugin: Description is now mandatory

### Fixed

- Celestia Atlas: Render the complete photographic survey viewport at
  display-aware resolution and load visible HiPS tiles with higher parallelism,
  eliminating the isolated sharp-tile appearance on web, Android and iOS
- Celestia Atlas: Keep photographic survey imagery sharp during clicks, drags,
  pinches and periodic mount/view updates. Completed high-resolution frames are
  retained until the next reprojection is ready, eliminating the recurring
  clear-to-blurry flicker on web, Android and iOS
- Celestia Atlas: Correct J2000/ICRS-to-horizontal geometry with precession, nutation and observed sidereal orientation, keeping landscapes, the Milky Way horizon mask, grids and horizontal navigation on one cached frame
- Celestia Atlas: Keep camera and mosaic position angles anchored to projected celestial north while the embedded view follows the local horizon
- Celestia Atlas: Route view-center slew, center, rotate, sequence and favorite actions through the proven J2000 command boundary; invalid or untagged view coordinates now disable the actions instead of reusing stale values
- Celestia Atlas: Convert ICRS catalogue selections to the J2000 frame required by NINA framing and mount commands, while retaining source-frame provenance and rejecting untagged coordinates
- Celestia Atlas: Correct the mirrored Galactic-longitude mapping so the Milky Way crosses the local horizon in the expected north-to-south direction
- Celestia Atlas: Keep the embedded view explicitly horizon-aligned even when both coordinate-grid overlays are hidden, so landscapes stay level and horizontal drags follow azimuth instead of appearing to rotate the sky
- Celestia Atlas: The selected-target framing action now opens the actual Framing Assistant and retains J2000 epoch plus ICRS/J2000 source-frame provenance instead of sending the user to the mount slew tab

## [App5.3.0-beta1] - 2026-07-28

### Changed

- Multi-instance: Switching instances - and editing the IP/port of the active instance - now restarts the app instead of resetting parts of it in place. You stay on the page you were on. Note that a running TPPA alignment or manual mount control session is no longer carried over to the new instance

### Fixed

- Multi-instance: Data from the previously selected instance could be left over after switching (framing target, mount, flat assistant, histogram and most plugin views were never cleared)
- Multi-instance: WebSocket and SignalR connections sometimes failed to re-establish after switching instances
- UI: Short white flash while the app loads (on start and when switching instances) - the dark background now applies from the very first frame

## [App5.2.0] - 2026-07-26

Summary of all changes since 5.1.0 (released in beta1-beta4, see below for the individual beta releases).

### Added

- Safety: Destructive actions now ask for confirmation before running - parking the mount and clearing the whole sequence
- Haptics: Light/medium haptic feedback on native (Android/iOS) platforms when triggering key actions such as capture, slew, park and stop
- Guiding: PHD2 live image can now be zoomed and panned (pinch, mouse wheel, double-tap) like the camera image, with lock position, guiding cross and secondary star overlays tracking correctly, plus a reset-zoom button
- Equipment (PINS): Connect button now doubles as a cancel button while a connection attempt is in progress
- TPPA (PINS): When the alignment view is opened (or after switching instances), the running state is now loaded from the backend, so an alignment already in progress is reflected correctly instead of relying on a possibly stale saved state

### Changed

- Design: App-wide visual refresh onto a single design system - one consistent set of button styles, surfaces and colors with a single cyan accent, and green/yellow/red now always carry the same meaning across the app (running / attention / problem or stopped). Buttons, inputs and other touch targets are now at least 48px for easier tapping in the field
- Navigation: Each nav item now shows a permanent label under its icon (previously the label only appeared while touching), and the landscape sidebar is narrower so it no longer wastes empty space next to the icons
- Status bar: Redesigned, taller status bar that shows camera, mount, guider, filter, weather and progress state - and their key values - at a glance without having to tap a chip first
- Layout: Pages now sit inside a fixed, rounded frame with corner accents while content scrolls beneath it, replacing leftover full-page backgrounds and stray top padding from the old layout
- Info panels: Stat tiles simplified to semantic states, with a more compact two-column view on smaller pages
- Camera: Live/captured image view is now contained within the rounded frame instead of overflowing it
- Camera: Cooler status revised
- Sequence Creator: Toolbar buttons (undo/redo, save, library, clear, send to NINA) restyled to match the app-wide design system

### Fixed

- Dialog: Minimized dialogs are now a small, draggable chip anchored above the status bar instead of a fixed 300px box that permanently covered the bottom-right corner
- Sequence: Sequence control buttons no longer get covered when a status bar panel (progress, camera/mount/filter info, guider graph) is opened - they now shift up above it automatically
- Sequence Creator: Camera offset field was limited to -100..100, now allows the full 0-10000 range
- Sequence Creator: Cool Camera action sent -10°C to NINA instead of the configured target temperature when it was set to 0°C
- Sequence Creator: Actions added to a sequence before a template's min/max/step was changed no longer keep showing stale bounds - they now pick up the current limits
- Sequence Creator: "Wait if Sun/Moon Altitude" always showed 0.0° and never showed the expected time - now shows the actual current altitude and expected time
- Sequence Creator: "Moon Altitude" condition was missing the current altitude display that its Sun Altitude counterpart already had
- Multi-instance: A running snapshot loop no longer keeps capturing against the new instance after switching (or against the same instance after a brief connection loss) - it is now stopped as part of the connection teardown
- Multi-instance: The guider graph and sequence editor no longer freeze after a connection is lost and comes back (WiFi blip, background/resume, or switching instances) while those views are open - they now resume on their own
- Multi-instance: The last captured image is no longer left over from the previous instance when switching, and TPPA's saved filter/gain/exposure settings are now kept per instance instead of leaking between them
- PINS: Fixed plugin layout

## [App5.2.0-beta4] - 2026-07-23

### Fixed

- Dialog: Minimized dialogs are now a small, draggable chip anchored above the status bar instead of a fixed 300px box that permanently covered the bottom-right corner

## [App5.2.0-beta3] - 2026-07-21

## [App5.2.0-beta3] - unreleased

### Added

- Equipment (PINS): Connect button now doubles as a cancel button while a connection attempt is in progress
- Guiding: PHD2 live image can now be zoomed and panned (pinch, mouse wheel, double-tap) like the camera image, with lock position, guiding cross and secondary star overlays tracking correctly, plus a reset-zoom button
- Celestia Atlas: Generated plugin landscapes now use an update-safe persistent data route instead of the replaceable application asset directory

### Changed

- Camera Cooler Status Revised
- Sequence Creator: Toolbar buttons (undo/redo, save, library, clear, send to NINA) restyled to match the app-wide design system

### Fixed

- Sequence: Sequence control buttons no longer get covered when a status bar panel (progress, camera/mount/filter info, guider graph) is opened - they now shift up above it automatically

- Sequence Creator: Camera offset field was limited to -100..100, now allows the full 0-10000 range
- Sequence Creator: Cool Camera action sent -10°C to NINA instead of the configured target temperature when it was set to 0°C
- Sequence Creator: Actions added to a sequence before a template's min/max/step was changed no longer keep showing stale bounds - they now pick up the current limits
- Sequence Creator: "Wait if Sun/Moon Altitude" always showed 0.0° and never showed the expected time - now shows the actual current altitude and expected time
- Sequence Creator: "Moon Altitude" condition was missing the current altitude display that its Sun Altitude counterpart already had

## [App5.2.0-beta2] - 2026-07-19

### Changed

- Design: App-wide visual refresh onto a single design system - one consistent set of button styles, surfaces and colors with a single cyan accent, and green/yellow/red now always carry the same meaning across the app (running / attention / problem or stopped). Buttons, inputs and other touch targets are now at least 48px for easier tapping in the field
- Navigation: Each nav item now shows a permanent label under its icon (previously the label only appeared while touching), and the landscape sidebar is narrower so it no longer wastes empty space next to the icons
- Status bar: Redesigned, taller status bar that shows camera, mount, guider, filter, weather and progress state - and their key values - at a glance without having to tap a chip first
- Layout: Pages now sit inside a fixed, rounded frame with corner accents while content scrolls beneath it, replacing leftover full-page backgrounds and stray top padding from the old layout
- Info panels: Stat tiles simplified to semantic states, with a more compact two-column view on smaller pages
- Camera: Live/captured image view is now contained within the rounded frame instead of overflowing it
- Fixed: PINS plugin layout

### Added

- Safety: Destructive actions now ask for confirmation before running - parking the mount and clearing the whole sequence
- Haptics: Light/medium haptic feedback on native (Android/iOS) platforms when triggering key actions such as capture, slew, park and stop

## [App5.2.0-beta1] - 2026-07-16

### Added

- TPPA (PINS): When the alignment view is opened (or after switching instances), the running state is now loaded from the backend, so an alignment already in progress is reflected correctly instead of relying on a possibly stale saved state

### Fixed

- Multi-instance: A running snapshot loop no longer keeps capturing against the new instance after switching (or against the same instance after a brief connection loss) - it is now stopped as part of the connection teardown
- Multi-instance: The guider graph and sequence editor no longer freeze after a connection is lost and comes back (WiFi blip, background/resume, or switching instances) while those views are open - they now resume on their own
- Multi-instance: The last captured image is no longer left over from the previous instance when switching, and TPPA's saved filter/gain/exposure settings are now kept per instance instead of leaking between them

## [App5.1.0] - 2026-07-13

### Added

- Settings: New "Local Network Binding" option (Android) to keep the app connected via Wi-Fi when the NINA instance runs on a local network without internet (e.g. PINS hotspot), while the rest of the phone keeps using mobile data

### Changed

- Build: Pin TypeScript 6.0.3 because the current `vue-tsc` wrapper cannot load
  the TypeScript 7 compiler export; lint, typecheck and production build pass

### Fixed

- Stellarium: Fixed the sky view flickering and mouse-wheel zoom appearing broken in Chrome by removing the frame rate cap while Stellarium is visible
- Sequence: Three Point Polar Alignment item now shows the actually selected filter instead of always appearing empty
- Guider: PHD2 exposure field no longer shows NaN when the initial exposure request fails

## [App5.0.0-beta12] - 2026-07-07

### Fixed

- Stellarium: Fixed the sky view suddenly zooming and then freezing (no more pan/zoom) after a few touch gestures on iPadOS - the browser could claim the gesture and cancel the touch without the engine ever seeing it end, leaving a phantom finger "held down"

## [App5.0.0-beta9 and 10] - 2026-07-03

### Added

- TPPA: Filter can now be selected in the alignment settings and is passed to the start-alignment request (leave on "Default" to use NINA's defaults)
- Mount: Telescope settle time setting in the mount settings panel
- PINS: WiFi card now shows the current connection (SSID, IP address, interface, band) with signal strength and a short history graph - thanks to acocalypso

### Changed

- Background handling: Guider stats/graph, dark library build progress, the sequence editor, PINS device list, PINS AllSky, system metrics, INDI Control Panel, log collector and framing polling now all pause while the app is in the background (via a new shared polling composable) instead of continuing to poll, and resume only if they were actually active before pausing

### Fixed

- PINS: WiFi connect/disconnect buttons now reflect the actual connection state - no longer offer to "connect" to a network you're already connected to, and disconnect is styled distinctly while connected
- PINS: Fixed a re-probe race that could double-check or miss PINS availability, plus poller start/stop races and an unsafe framing data access
- Camera: Fixed "Center Here" always treating the connected camera as a DSLR, which broke the sensor-size fallback for cameras that do report a native sensor size
- Guider: PHD2 calibration data button is no longer shown outside PINS mode

## [App5.0.0-beta8] - 2026-07-01

### Changed

- Connection: All WebSocket connections (event channel, mount control, TPPA) now share a single reconnect engine with exponential backoff instead of a fixed 2-second retry, so a backend that is temporarily unreachable is no longer hammered every 2 seconds while still recovering promptly once it returns
- Connection: Reworked the reconnect screen to be calmer and more useful - a brief background/foreground blip now only shows a neutral spinner, escalating to a friendlier message with "Retry now" and "Settings" actions (technical connection details tucked behind an optional "Show details") only if it's still not reachable after a few seconds; the "this may indicate a problem" warning now only appears after 15s instead of 10s, since reconnecting after being backgrounded can normally take up to ~12s on its own

### Fixed

- Connection: Event subscriptions (new images, live stacking updates) are now re-established after every reconnect - previously a reconnect handled internally could silently stop delivering these events until the app was restarted
- Connection: Detect and recover "zombie" connections where the socket looks open but no longer receives anything (e.g. after switching between WiFi and mobile data while the app stays in the foreground)
- Connection: The mount control connection no longer keeps retrying every 2 seconds while the backend is unreachable, and now recovers on its own once it comes back without needing to leave and re-open the page
- Connection: The TPPA alignment connection now reconnects through a single path (a duplicate retry loop was removed) and its pending reconnect can now be properly cancelled
- Connection: Overlapping WebSocket reconnect attempts no longer cancel each other out every ~2 seconds, so reconnecting after resume is noticeably faster
- Connection: The reconnect screen now shows immediately when returning from background instead of briefly showing stale data before the connection-error banner appears a few seconds later, but only after a brief grace period so a near-instant reconnect no longer flashes the overlay at all
- Connection: A short-timeout WebSocket connect attempt could silently claim the shared reconnect slot and cap every subsequent attempt at its shorter timeout; reconnect timeouts are now consistent everywhere
- Connection: Disconnecting no longer leaves a stale pending connection reference behind that could cause the next reconnect attempt to wait on an already-dying connection
- Connection: The four SignalR services (PINS notifications, progress, dialogs, message boxes) no longer run two competing reconnect mechanisms at once

## [App5.0.0-beta7] - 2026-07-01

### Fixed

- Connection: App no longer gets stuck showing "trying to reconnect" indefinitely after returning from a locked screen if an earlier resume attempt was still in progress - the pending reconnect is now retried instead of silently dropped
- Connection: Fixed a race between overlapping WebSocket reconnect attempts that could permanently freeze the backend status polling after resuming from background, requiring an app restart to recover

## [App5.0.0-beta6] - 2026-07-01

### Added

- Settings: New $$FWHM$$ and $$ECCENTRICITY$$ tokens for the image file pattern

### Fixed

- Diagnostics: Mobile diagnostic ZIP downloads now work on mobile devices
- Connection: Mount and TPPA WebSockets no longer keep delivering events from a stale socket after a reconnect; polling loops now skip a tick instead of overlapping when a request is still in flight

## [App5.0.0-beta5] - 2026-06-29

### Added

- Sequence: PHD2 calibration slew item – slew to a guider calibration position (HA offset, Dec, pointing side, optional DEC backlash clearing)
- Guider: Prompt to reconnect the guider after toggling PHD2 auto restore calibration, since the setting only takes effect after a reconnect
- TPPA: Alignment warnings for huge/large polar alignment errors, declination spread between measurements, and correction fields close to East/West
- Stellarium: Loading spinner while the engine initializes

### Changed

- Stellarium: Skip rendering while the view is hidden or the app is in the background instead of letting the WebGL engine render continuously, significantly reducing battery drain and device heat; the view stays loaded and resumes instantly

### Fixed

- Narrowband Filter: Correct aperture and focal length limitation in the filter calculator
- Framing: Compute visible stars once on load instead of reactively

## [App5.0.0-beta4] - 2026-06-17

### Added

- Plugin: INDI Control Panel – inspect and control every property of the INDI drivers currently loaded on the server
- Equipment: HTTP connection mode for INDI mounts (in addition to Serial and Network/TCP)
- PINS: INDI registry edit config flow – edit Name, Label and Type of installed INDI 3rd-party registry entries via a mobile-friendly modal, patching only changed fields and preserving unsaved edits across refresh - thanks to acocalypso

## [App5.0.0-beta2] - 2026-06-11

### Added

- Settings: Clear Horizon File Path via a dedicated button
- Sequence: Ground Station plugin support – add and edit notification items (Telegram, Discord, Slack, Pushover, ntfy, IFTTT, Email, MQTT, HTTP request, UDP) and failure triggers with dedicated editors
- Equipment: INDI camera selection

## [App5.0.0-beta1] - 2026-06-11

### Added

- Sequence: Add picker now groups types into collapsible categories with item count, and the search also matches category names

## [App5.0.0] - 2026-05-20

### Added

- Sequence: Set multi targets
- GPS Sync option
- Time Snyc option
- Sequence Monitor: Global image filter by target, astronomy filter, observation night and image type – applies to image grid, graph and exposure time summary
- Total Exposure Time: Filter by filter name or show all filters
- Camera Page: Image rotation button (0°/90°/180°/270°) – rotation is saved per instance, enabling correct orientation for dual-camera setups
- PINS Plugin: Option to disconnect wifi and start hotspot
- PINS: TPPA set exposuretime and gain
- PINS: switch between two instances
- PINS: Log level selector in debug settings (requires PINS plugin support)
- Log Modal: Multi-select level filter (ALL, DEBUG, INFO, WARNING, ERROR)
- Plugin: PINS AllSky frontend for Pi HQ camera capture, timelapse, keogram, and startrails control with the companion backend plugin - thanks to sharon92
- StatusBar: Instance switcher button showing active instance name and WebSocket status – tap to open a modal listing all online instances for quick switching
- Navbar: Customizable navigation bar – reorder icons via drag & drop and hide individual items; at least one page besides Settings must remain visible; collapsible settings section with faded item preview when collapsed
- Navbar: Plugin nav items included in customization, respecting enabled state and PINS availability
- Navbar: App redirects to first visible page on startup if the default page (Equipment) is hidden
- Image Viewer: Optional centered crosshair overlay toggle for the shared camera and livestack viewer - thanks to sharon92
- PINS Flat Assistant: Add Multi Mode – configure and start flats for multiple filters simultaneously, with per-filter settings (gain, offset, binning, exposure, histogram) initialised from and saved back to the NINA profile (FlatWizardFilterSettings)
- Framing: Add Mosaik-Mode
- Framing Assistant: Now has its own dedicated page
- Settings: PINS set Horizon File Path
- Flat Assistant: Add dark flat count and post-flat dark workflow for supported flat modes - thanks to sharon92
- PINS: Show time mismatch warning modal on startup when device time differs from client time by more than 1 minute – allows syncing device time to client or suppressing the warning permanently (re-enable via system time card)
- Observation Planner: Persist filter, sort and performance settings across navigation and reloads
- Observation Planner: Cache target preview images across navigation so returning to the view skips redundant DSS/targetpic requests
- Image Viewer: Touch loupe for 1:1 pixel inspection – toggle in the image toolbar, drag with one finger to float a preview above the finger; adjustable zoom factor (1×/2×/4×), preview teleported to body so it floats above all overlays, Panzoom is paused while active and restored on disable
- Filebrowser Plugin: View, delete or rename your images
- Equipment: INDI driver selection for dome and safety monitor
- Flatassistant: Stop tracking after slew to zenith
- Plugin: Add filebrowser
- Stellarium: Add Camera FOV
- Plugin: PHD2 Log Viewer – visualize PHD2 guiding sessions with guide graph, RMS statistics, FFT periodic error analysis and calibration data - thanks to Florin Dumitrescu
- PINS PHD2: Dark Library assistant (build/load/unload/delete) with DARKS indicator in guider stats
- PINS PHD2: Guide Rate setting in guider settings – shows current sidereal rate multiplier and allows changing it; read-only display when mount does not support changing the guide rate

### Changed

- Plate Solve: Use the NINA-style toolbar icon in the shared image viewer
- PINS AllSky: Add AllSky auto-exposure tuning controls, timelapse overlay toggles for timestamp and exposure/gain, and show the active session label plus actual auto exposure/gain/mean values in live preview
- Stellarium: sequence buttons are now always visible

### Fixed

- i18n: Correct Spanish translations (close, scanning, save, message_tns_version, downgradeDescription) Thanks @Antonio
- Total Exposuer time: filter total exposure time by LIGHT image type
- Stellarium time fix
- PINS: Manual Rotator dialog button
- PINS AllSky: Live preview now shows the active session label instead of only the generated session ID
- PINS AllSky: Show in-flight state for capture and cleanup actions, and use attachment downloads with session-based filenames for timelapse, keogram, and startrails
- Fix crash when NINA plugin version is not yet loaded (checkVersionNewerOrEqual)
- Fix app not reconnecting after backend restart: removed blocking `await` on SignalR connect in polling loop, added socket-ID guard to prevent stale WebSocket events from corrupting connection state, and fixed async race condition in `disconnect()` across all SignalR services
- Debug console: fix SignalR "WebSocket is not in the OPEN state" error caused by WebSocket proxy losing static constants (`OPEN`, `CONNECTING`, etc.)
- Filter Calculator Plugin: Fix Input field
- Image spinner deadlock and extend image size options

## [App4.7.0] - 2026-03-17

### Added

- NumberInputPicker: Add step up/down buttons to increment and decrement values
- Sequence Creator: Named sequence library – save, load and delete sequences with custom names
- Sequence Creator: Set any saved sequence as default directly from the library
- Sequence Creator: Saved sequences appear as a selectable group in the Load Sequence dropdown
- Navigation: Show translated icon labels as overlay on touch or hover
- Modal position persistence in settings store
- Orientation-aware position storage (landscape/portrait)
- Responsive modal design for small screens
- File Pattern Builder: Add free text input to customize file naming patterns with custom text segments
- Plate Solve: Show calculated focal length based on pixel scale and camera sensor size
- Image Viewer: Double-tap to toggle between 100% zoom (centered on tap point) and fit view
- Add settings for Focal Ratio and Telescopname
- Settings: Add dedicated Image tab (image processing settings and file pattern builder)
- Settings: Add dedicated Meridian Flip tab
- Settings: SubNav scrolls horizontally with fade and arrow indicators when tabs overflow
- Settings: Add image file type selector (TIFF, FITS, XISF)

### Changed

- Settings: Moved image and meridian flip settings out of General tab into own tabs
- Focuser: Replace focuser input with position display in quick access modal
- Profile: Disable profile selection when any device is connected
- Sequence Creator: Replaced "Save as Default" toolbar button with library-based default management
- Sequence Creator: Removed "Load Basic Sequence" toolbar button

### Fixed

- Histogram: Show real 16-bit statistics (Mean, Median, Min, Max, StDev) from NINA image-history API
- Histogram: Compute histogram bars using inverse NINA auto-stretch (MTF) to align with 16-bit ADU axis
- Histogram: Reload statistics from API each time the histogram panel is opened
- Histogram: X-axis shows real ADU range (Min–Max) when statistics are available
- Histogram: Mean (yellow) and Median (cyan) marker lines aligned with histogram bars
- Histogram: Gamma slider hidden by default, accessible via toggle button
- Dialog: Filter out NINA NotificationHostWindow (NINA V3.3) to prevent empty dialog popup when not connected
- Pins plugin: support WIFI connection
- Pins Plugin: Band selection 2.4 Ghz / 5 Ghz
- Pins Plugin: Autoconnect to wifi after reboot
- Setup: Restart setup after GPS permission has been granted
- Flatwizzard: max brightness
- Flat Assistant: Add Multi Mode – configure and start flats for multiple filters simultaneously, with per-filter settings (gain, offset, binning, exposure, histogram) initialised from and saved back to the NINA profile (FlatWizardFilterSettings)

## [App4.6.0] - 2026-02-14

### Added

- Navigation: Scroll indicators with fade effect and arrow hint when more icons are available
- Camera: Separate Readout Mode settings for Image and Snap (API >= 2.2.14.3) - thanks to Chris
- Camera: Add USB limit setting component for camera (API >= 2.2.14.3) - thanks to Chris
- Focuser: Add use filter offsets setting
- Focuser: Add stop button to cancel move while focuser is moving
- Rotator: Add stop button to cancel move while rotator is moving
- Plugin: ObservationPlaner - thanks to Flashy_DE (Alex)
- NumberPicker: Replaced scroll wheel picker with touch-friendly numpad input
- NumberPicker: Added cancel button and backdrop dismiss
- NumberPicker: Added min/max validation for direct input and picker overlay
- NumberPicker: Simplified picker store by passing min/max directly instead of options array

### Changed

- Camera: Unified UI design for settings components
- Sequence Monitor: Limit image height to viewport in landscape mode to prevent scrolling
- NumberPicker: Replaced scroll wheel picker with touch-friendly numpad input
- NumberPicker: Added cancel button and backdrop dismiss
- NumberPicker: Added min/max validation for direct input and picker overlay
- NumberPicker: Simplified picker store by passing min/max directly instead of options array

### Fixed

- Fix set settletime
- App: UI no longer reloads when returning from background
- Camera: Spinner not updating after capture in Safari

## [App4.5.0] - 2026-10-20

### Added

- PlateSolvePlus Plugin thanks to Flashy_DE (Alex)

### Fixed

- Framingassistant: Rotation angle was displayed incorrectly
- PlatesolvePlus: Fix: load on Image Preview
- Settings: Fixed loading of coordinates

## [App4.4.0] - 2026-01-15

### Breaking Changes

- IOS min version 15.0

### Added

- Rotator: Settings Reverse
- Rotator: Settings Mechanical Range
- Mount: Reverse Primary Axis setting
- Mount: Reverse Secondary Axis setting
- Setup: Loading spinner while GPS data and astrometry settings are being loaded

### Changed

- WeatherModal: All values now limited to max 2 decimal places
- WeatherModal: Unit toggle button now shows the target unit instead of the current unit
- Image History: Layout adjustments
- Stellarium: View now syncs to mount position on load when mount is connected
- Stellarium: Now uses server time instead of client time for accurate time display
- Setup: Confirm button disabled during data loading to prevent premature confirmation
- Camera: Remove minimum cooling time
- Camera: Remove minimum warming time
- Time Synchronization: All astronomical calculations (Sidereal Time, object altitude, Stellarium) now use server time for consistency
- TPPA: Time display now uses server time
- LiveStack: "Last Updated" timestamp now uses server time
- Packages Update

### Fixed

- Flat Wizard: Slew to zenith
- Flat Wizard: Max brightness
- Webcam Plugin: Load snapshot
- WeatherModal: Wind speed unit now correctly displays mph for imperial units
- GPS Coordinates: Fixed decimal places
- Mount Control: Fixed issue where multiple movement intervals could run in parallel, causing unintended slewing and tracking mode changes when changing slew rate
- Guider: Dec Arcsec error

## [App4.3.0] - 2025-12-13

### Added

- Stellarium set sequence target
- Filtersettings
- Platesolve last image
- Dialog Modal minimize

### Changed

- increased limits for target search
- Change Panzoom lib
- Update NL

### Fixed

- ZoomableImage: Preserve zoom level and pan position when loading new images
- Settings from Slew and Center button
- Fixed Image invalid detection

## [App4.2.0] [livestack0.6.2][bahtifocus1.0.0] - 2025-12-04

### Important information

TouchNStar Plugin 1.2.3.0 is required for BahtiFocus

### Added

- Equipment settings page
- Mount: Side of pier info
- Livestack plugin icon shows stacking status
- Netherland language support - PeterKr
- Plugin System Metrics
- Plugin BahtiFocus
- Close Autofocus dialog
- Meridian settings
- Autofocus settings
- Numberpicker

### Changed

- Camera chipsettings are now in equipment settings page

### Fixed

- Fix settings modal layout
- Fix console warnings

## [App4.1.0] [ShortcutsPlugin1.0.0] [LivestackPlugin0.6.1]

### Important information

- Advanced API V2.2.12.0 and Livestack 1.0.1.7 are required for Livestack.

### Added

- Histogram and image stretch
- Tracking mode selection for mount
- More Stats for Sequence Graph
- Temperature display during last autofocus
- Livestack running status is shown in Livestack screen. When a user directly in N.I.N.A. or in a sequence starts or stops the Livestack process, the new status is shown in the plugin.
- New Livestack layout that shows permanently the currently displayed Target/Filter combination and frame count.
- Configuration option to show only the RGB composite in Livestack, instead of each channel.
- App Camera page histogram and image stretch function
- Framing assistant in Stellarium
- Profile loading spinner
- Mid tone control on histograms.
- Reset button on histograms.
- Option to "Always shows the latest stack" in Livestack Settings.
- Optimized the information shown in the target and filters dropdown.
- Added PHD2 looping support
- Total exposure time in Image-History
- Shortcuts plugin: create custom buttons that load a chosen N.I.N.A. sequence and optionally auto-start it with one tap.
- Added feature highlight

### Changed

- Framing Assistant: Improved UI with FOV controls in image and optimized button layout

### Fixed

- Dialog Modal no longer closes when clicking outside it
- Focuser small steps were not always adopted
- Load of stacked image in sync with counts
- Increase visibility of "running ring" in Start/Stop Livestack button
- Depiction of sequence flats repairers

## [App4.0.1] [SequenceCreator1.3.1]- 2025-11-19

### Added

- Device connection status tracking: Real-time monitoring of 11 device types based on event history.
- Autofocus event tracking: Dedicated store with real-time autofocus state, points, and HFR visualization.

### Changed

- AfLiveGraph: Refactored to use autofocus store instead of log parsing.

### Fixed

- Fixed Camera settings layout
- SequenceCreator Autofocus sequence fixed
- Fixed Dialog Modal

## [Plugin1.2.1.0] [App4.0.0] [webcam-1.0.1] [LivestackPlugin0.4.1] [logfile-collector1.0.2] - 2025-11-16

### Important information

- Advanced API V2.2.11.0 and Livestack 1.0.1.5 are required for Livestack.

### Added

- Time Range Controls: Collapsible control panel with dual-range slider for time-based filtering.
- Sequence Graph: Data source selector for primary and secondary graph displays.
- Camera settings: Sync plate solve coordinates to mount.
- SequenceImageHistory: Added toggle button for image statistics display.
- SequenceGraph: Zoom function for the graph.
- Centralized image management system with new Image Store.
- Configurable maximum image dimension setting (Full/High/Medium/Low presets) for optimized performance across different camera types.
- Image validation to detect corrupted images with automatic retry mechanism.
- Visual loading spinner overlay for image loading states.
- Livestack: Display of the number of stacked images added.
- App: An option to specify the target name when saving snapshots.

### Changed

- Improved image fetch performance with proper memory management.
- Enhanced exposure countdown watchdog with increased check interval for better accuracy.
- Optimized performance logging threshold for image requests.

### Fixed

- Reloading the image when changing instances.
- The Mount Control button is only displayed if the function is supported.
- Webcam Plugin: Add crossOrigin="anonymous".
- logfile-collector: Fixed copy token.
- App: Fixed save target name.
- Fixed image loading at startup.
- Fixed Exposure button spinner to show the image loading.
- Fixed update URL.
- Fixed downgrade function if the backend is unavailable.
- Fixed info overlay about offline catalog in slew tab.
- Fixed race condition between simultaneous image fetch operations.
- Fixed memory leaks from unreleased Blob URLs in image operations.
- Fixed dialog visibility issue on Camera Page when dialogs appear over the image view.
- Fixed scrolling on iOS for Livestack control panel and improved UI responsiveness on small screens.
- Livestack: Control panel header now remains fixed while content scrolls on iOS devices.

## [App3.6.1] - 2025-11-05

### Added

- Option to join the beta channel

### Fixed

- Fixed error in the display of the modal settings
- Fixed Setup for querying GPS data

## [1.1.6.1] [App3.6.0] - 2025-11-05

### Changed

- Plugin Livestack: Button for selecting targets revised

### Fixed

- Fixed Websocket connection of the Livestack plugin

## [1.1.6.0] [App3.6.0] - 2025-11-05

### Added

- Option to save snapshots
- Green glow effect for camera settings when successfully changed (Exposure Time, Gain, Offset, Target Temperature, Cooling Time, Warming Time, Pixel Size)
- Translations for snapshot settings in all supported languages
- Added Altitude (Alt) and Azimuth (Az) to mountinfo
- Updater

### Changed

- Stellarium now displays the time from NINA when starting up.
- Camera Gain synchronizes with the NINA Snapshot setting.

### Fixed

- Fixed guider calibration assistant slew stop
- Fixed loading images during continuous loop
- Hid ExposureCount from sequence display
- Fixed negative declination display in sequence target coordinates
- Fixed display of alt/az in the framing tab

## [1.1.5.0] [App3.5.0] - 2025-10-25

### Added

- Added a button to control the mount in TPPA Manual Mode.
- Added TNS Sequence MessageBox.

### Changed

- Updated sequence settings: more options can now be modified.
- Disabled the shake-to-undo functionality on iOS.
- iOS: Images are now saved under **Photos**.
- Camera cooling status is now displayed.

### Fixed

- Fixed “Center Here”: target selection no longer covers the center modal.
- Fixed display of statistics in history images.
- Improved timeout handling during reconnection.
- Fixed exposure countdown.
- Fixed “Keep screen awake” function.
- Fixed switching between two instances.
- Fixed saving of setup step.
- Fixed message display when the API cannot be reached.
- Fixed total error display (secondary double quote for arcseconds).

## [1.1.4.0] [App3.4.0] - 2025-10-07

### Added

- Three Point Polar Alignment (TPPA): Manual Mode (Advanced API V2.2.10.0 is required)
- The current status is now displayed in the sequence and sequence dashboard
- Livestack plugin (note: currently in beta version)
- PHD2: more warning messages
- The status of the camera, mount, and filter wheel can be opened by pressing the icons in the status bar.

### Changed

- The mount page is now always visible. An icon indicates whether the mount is connected.
- There is now a refresh button in iOS to reload Stellarium.
- Sequence design updated
- PHD2 connection establishment has been improved
- Save zoom and position in the camera image
- Improved app loading speed by adjusting timeout periods
- The camera cooling and warming function has been revised.
- The speed for connecting to NINA has been improved.
- Sequence-Creator: Added an option to switch directly to the sequence page

### Fixed

- Image statistics: Temperature limited to one decimal place
- Sequence: Changing the values of conditions fixed

## [1.1.3.0] [App3.3.0] - 2025-09-10

### Important information

- Advanced API V2.2.9.0 is required

### Added

- Filterwheel page: Dedicated page with responsive grid layout and status information
- Rotator page: Dedicated page with enhanced info display and controls
- Camera page: Quick access buttons and modal popups for rotator controls
- Navigation: Icons for filterwheel and rotator when equipment is connected
- Mount info: Added Right Ascension, Declination, and Time to Meridian Flip display
- TPPA page: Image modal with zoom functionality for viewing camera images during alignment
- Focuser page: Image modal with zoom functionality for viewing camera images during autofocus
- TPPA and Focus pages: Add background camera image when running
- Websocket connection monitoring created

### Changed

- Rotator: Moved from camera settings modal to dedicated quick access button
- TPPA page: Mount info display hidden to reduce clutter during alignment process
- Camera page: The last image taken is now always displayed. As in NINA
- Mount page: Added slew stop button
- Info message: Show 'What's new' on first start after an update
- Removed local notification for now.

### Fixed

- Fixed bug with switches when a non-writable switch is in the sequence
- Default gain and offset are now displayed in the sequence instead of -1.

## [1.1.2.2] [App3.2.2] - 2025-08-22

### Added

- Mountpage: Add Slew stop button
- Info message: What's new when starting for the first time after an update

### Fixed

- Sequence: Display of the filter name
- Fix Slew stop if only slew was executed
- Mount websocket connection fix

## [1.1.2.1] [App3.2.1] - 2025-08-22

### Changed

- Plugin: Sequece Creator: The settings are now saved in the backend.

### Fixed

- Android: The display turned itself off. Now this can be selected in the settings.
- Plugin: Sequece Creator: The endcontaienr is now processed sequentially.

## [1.1.2.0] [App3.2.0] - 2025-08-20

### Added

- Image settings: add debayer and unlinked stretch options
- TPPA: Settings for GAIN and Exposuretime
- Telescopius Plugin: Personal target lists from Telescopius can now be loaded. Please note: An API key from Telescopius is required.
- Logcollector Plugin added - Submit your logs to the Touch N Stars team in case troubleshooting is required.

### Changed

- Error handling and debug mode rework
- Slew and center breaks off after one attempt at plate solving.

### Fixed

- Favorites: fix save rotation
- Android: Fix image download from Sequence page
- TPPA: Button position from ErrorModal
- Plugin: Sequence Creator fix Meridian Flip

## [1.1.1.1] [App3.1.1] - 2025-08-07

### Added

- Sequence creator: Find home option

### Fixed

- fix settings button if no connection can be established
- fix cooling settings at sequence creator

## [1.1.1.0] [App3.1.0] - 2025-08-05

### Added

- PHD2 image similar to PHD2 with guide star marker
- PHD2 Starimige with starprofiel graph
- PHD2 callibration assitant
- Plugin: Sequence Creator for simple sequences added
- Plugin: Webcam viewer
- When you start the app for the first time, you will be automatically redirected to the equipment page.

### Changed

- The settings modal is now a separate page.
- Stellaruim search improved
- The sequence page design has been revised.
- The iocns of the navbar are no longer dependent on the status of the sequence.
- Framing assistant revised

### Fixed

- Framing: The skychart and the Name is now also displayed when the coordinates come from Stellarium.

## [1.1.0.0] - 2025-07-25

### Added

- PHD2 setting support. You can now set many PHD2 parameters, such as exposure time, aggression, ...
- Display of the current `targetName` if a sequence item with status `RUNNING` exists.
- Autoscan for iOS and Andriod. The connection settings can now be determined automatically as long as the default port 5000 is used in the plugin
- In landscape, the navbar is now displayed on the left so there is more space
- Warning if the Locatoin Sync in NINA does not match TNS and the possibility to change this
- A window to set the camera's exposure time more quickly
- GuiderStatus component showing current guider state with visual indicators and multilingual support
- Added sequence load to load sequences into the advanced sequence. Load a sequence from the default sequence folder

### Changed

- the coordinates for framing are no longer set at startup. This means that it is no longer necessary to switch to the framing tab in NINA
- design adjustments
- Guidegraph show px and rms error
- Raise the API minimum version to API 2.2.5.0 !
- Toast notification system: Non-critical toasts now appear as non-blocking notifications in top-right corner, while confirmations and critical messages remain as blocking overlays
- Guider control buttons are now always clickable with visual feedback for inactive states

### Fixed

- fixed layout error in footer for iOS

## [1.0.9.0] - 2025-06-24

### Added

- Guidgraph can be displayed everywhere. It can be opened and closed from the status bar
- Add skychart to sequenz
- TPPA Start from current position

### Changed

- Connection timeout increased to 2s and three attempts

### Fixed

- Automatic reconnect of the mount websocket connection

## [1.0.8.0] - 2025-05-27

### Added

- Stellarium on iOS
- Stellarium: send coordinates to mount
- SkyChart displays the custom horizon
- Camera page: Movable modal for mount, focuser and filter

### Changed

- reworked Logfile & Image download for Android/iOS
- The communication action monitoring from TNS to NINA has been revised
- Camera page: Design reworked
- Statusbar: Design reworked

### Fixed

- UI rendering & touch inputs for mobile applications
- Fix connection error with alpaca devices

## [1.0.7.0] - 2025-05-08

### Added

- Favorites memory for targets added
- debug option/window

### Changed

- The API port is now automatically detected
- Several NINA instances can run on one PC. The port increases by 1 for each instance
- The skychart shows the nautical and astronomical night
- The communication action monitoring from TNS to NINA has been revised

## [1.0.6.0] - 2025-05-03

### Added

- Focuser quick to use button
- Integrated iOS app
- Instanze Color -> There is a separate color for each instance. The navbar changes color depending on the instance
- add a plugin system
- A message is now displayed if the communication does not work

### Changed

- design rework stellarium
- button design adjustment
- rewort guidegraph
- framing tab change reworked (!!! new api is needed !!! ) -> When starting TNS, the system now also switches back to the active tab of NINA

### Fixed

- repairs a connection error if the default port is not used
- the IP address in the plugin is now displayed correctly

## [1.0.5.0] - 2025-04-16

### Added

- Sequenceimage: Add download function
- Dome: Add Slew and Sync
- Add ToastModal
- Focuser: Add autofocus graph
- Camera: Add Chipsettings
- Image History sorting by newest / oldest
- Stellarium Clock & Date view
- Altitude Chart in TargetSearch
- Settings for stretch factor and black clipping
- Add Manuell Filterwheel controll. You have to set the filter wheel of the API

### Changed

- CaptureButton created and integrated into CameraView
- CameraView is no longer locked when a sequence is running. Capturing only is not possible
- Manual Mountcontroll is permanently visible
- Update Eslint to 9
- add durations and dither to Guidegraph
- Sequence image is now displayed as in NINA

### Fixed

- Avoid duplicate NINA connection entries
- Eslint now fixes prettier
- Flatpanel icon state

## [1.0.4.4] - 2025-03-20

### Fixed

- fixed: add target to sequence

## [1.0.4.3] - 2025-03-29

### Fixed

- error fixed when sequence loads

## Android 1.6.3

### Added

- Implemented memory-safe APK updater with progress tracking
- Enhanced lifecycle handling for robust update management
- Integrated permission request handling for APK installation

### Fixed

- Resolved memory leak issues in the update checker
- Fixed access modifier conflict for `onDestroy()` override in `MainActivity`

### Changed

- Improved user feedback during APK downloads with a progress dialog
- Enhanced error handling for partial downloads and network failures

## [1.0.4.2] - 2025-03-28

### Fixed

- Fixed NINA Update

## [1.0.4.0] - 2025-03-28

### Added

- slew and Slew and Center added to stellarium
- settings panel for stellaruim added to activate different views
- Equipment: Device selection added
- Sequence editor
- Slew can now be canceled
- TPPA: Modal for bigger font size
- TPPA: Modal for target circel
- Framing wizard: Button slew to cenit
- Last sequence image cache
- SlewAndCenter with AzAlt
- Infomodal for slew and center

### Fixed

- fixes an error when the stellarium page is reloaded
- camera cooling status

### Changed

- rework Stellarium mount position
- rework Stellarium selected object
- rework slew and slewAndCenter function
- Equipment connect page reworked
- Sequence info changed from json to state
- Hide the connection settings if it is not an Androidapp
- Manual mount control is only available if tracking is not active
- Last sequence image cache
- settings wizzard now loads the coordinates of nina
- imagehistory now loads thumbnails so it is much faster
- CenterHere: Rework Slwe and Centerbutton

## [1.0.3.0] - 2025-03-08

### Added

- Stellarium Web Engine
- Display current mount position in stellarium
- Object selection in stellarium
- Framing assistent with stellarium data
- Date & Time selection in stellarium
- Image History

### Changed

- update cz
- rework history image

### Fixed

- Setup screen / Nina instance setup for Android only
- Windspeed in weather modal

## [1.0.2.2] - 2025-02-23

### Added

- Create a new SequenceImageHistory view that loads all the images from the history using the SequenceImage component.
- Add this new SequenceImageHistory view as a new tab of the "Sequence Monitoring" page.
- slew can be canceled
- set park position

### Changed

- Extract the sequence image loading logic into a new SequenceImage component. This component is in charge of displaying the image + stats + opening the modal for the full preview.

### Fixed

- Plugin null exception error
- Small UI fixes in the "Sequence Monitoring" page.
- Added a new script to add a new entry to all locale files. Very handy when creating a new entry to avoid going to all the files individually.
- TPPA fix display error

## [1.0.2.0] - 2025-02-21

### Added

- add flat assistant
- add manuell mount controll
- Starsearch
- spanish translation

### Changed

- Auto prepare for the images
- TPPA shows more info
- DLSR chip size is loaded from the framing settings

### Fixed

- Loading the autofocus graphic after a run did not always work
- Shutdown / Restart now also works when PHD2 is running

## [1.0.1.0] - 2025-02-14

### Added

- Shutdown / Restart support (NINA PC)
- New Translation keys
- Manuell mount controll
- “center here” added
- image settings

### Changed

- Android framework replaced with CapacitorJS (previous App needs to be removed first)
- Android 10 is now required as min. version
- Images are processed in the same way as in NINA
- Camerapage layout reworked

### Fixed

- ISO was not set correctly with DLSR
- Pinia store now correctly stores Instance configurations

## [1.0.0.9] - 2025-02-07

### Added

- Graphic showing the remaining exposure time
- Binning can be set
- Readoutmode can be set
- Download Logs from Modal
- Klingon support

### Changed

- Camera design adjustments
- Save exposuretime gain and offset permanently
- prevent lockscreen on Android
- Load all values from Weather
- Logic of CORS in plugin changed
- Removed wshv and Autofocus watcher

### Fixed

- Flatpanel icon does not change color
- Guidergraph: Data was not always loaded
- Error when loading the target image fixed
- regular expression for dec and ra adapted
- Fixed custom sky survey cache path

### Known Issues

- Android - Logfile Download not working

## [1.0.0.8] - 2025-02-04

### Added

- Framingassistant
- Switchpage
- portuguese support
- Manuell mount control
- Guider notes

### Changed

- Filter wheel cannot be connected if it is manual
- Rotator cannot be connected if it is manual
- Camera and last sequence image is now in an Modal for zooming
- Adaptations to API version 2.1.7.0
- update cz, fr, it, de, en, cn
- Sequence overview reworked
- display of the zoom factor in the image modal

### Fixed

- Camera - timeout
- Sequence image does not always load
- Weather modal
- Android Update
- Subnav
- Guider state management
- Guider RA / DEC values

## [1.0.0.7] - 2025-01-27

### Added

- Italian, Czech, Chinese support
- Weather modal with additional information
- About modal
- Updater for Android
- Cors description

### Fixed

- Input validation for Nina instances
- FQDN working again
- Instance selection
- TPPA state handling

## [1.0.0.6] - 2025-01-22

### Added

- Support for Advanced API 2.1.4.0
- Setup screen & Tutorial
- Proper guider implementation

### Fixed

- Ui Elements fixed

## [1.0.0.5] - 2025-01-19

### Added

- Flatpanel support
- Sequence monitor

### Fixed

- Mobile optimizations
- Navbar
