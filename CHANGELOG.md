# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [App4.8.0] - xxxx-xx-xx
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

### Changed
- Plate Solve: Use the NINA-style toolbar icon in the shared image viewer
- PINS AllSky: Add AllSky auto-exposure tuning controls, timelapse overlay toggles for timestamp and exposure/gain, and show the active session label plus actual auto exposure/gain/mean values in live preview
- Stellarium: sequence buttons are now always visible

### Fixed
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
- Added Altitude (Alt) and Azimuth (Az)  to mountinfo
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
-  Plugin: Sequece Creator: The settings are now saved in the backend.

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
- TPPA  shows more info
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
