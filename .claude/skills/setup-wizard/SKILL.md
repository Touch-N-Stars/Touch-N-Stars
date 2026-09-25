---
name: setup-wizard
description: Work on the first-run / equipment setup wizard (src/components/setupWizard/) or on location and coordinate handling. Use when adding or reordering a wizard step, when a modal opened from the wizard appears behind it, or when touching latitude/longitude/elevation UI anywhere in the app.
---

# Setup wizard and location handling

`src/components/setupWizard/` is the cancellable first-run and equipment wizard.
It opens before setup is complete and is ordered ahead of the tutorial and
What's New. Cancel and finish are the same transaction — both call
`completeSetupWizard()`, so the app is usable either way.

## Adding a step

One entry in the computed `steps` list in `SetupWizard.vue:194`, plus one
`v-else-if` branch. Nothing else in the wizard shell is step-count aware.

The step order carries reasons, and they are written as comments next to the
entries — read them before reordering. The load-bearing ones:

- **Localization before Wi-Fi**, so the regulatory country, timezone, locale and
  remote keyboard layout are set before networking is configured.
- **Mount before location**, because the location sync needs a connected mount.
- **Telescope before camera**, because the camera step's image-scale readout
  needs `TelescopeSettings.FocalLength`.
- **Guiding after mount and before camera**, because PHD2 needs a connected
  mount, and once the imaging camera is connected PHD2 can no longer scan for
  the guide camera.
- **Dither last**, as its own step, because the calculator needs the imaging
  camera and telescope values as well as the guide setup.

PINS-only steps (`localization`, `wifi`, `updates`, `slewRate`, `guider`,
`dither`) are
spliced in conditionally, which is why **steps are tracked by id, not by index**
(`currentStepId`): the list grows underneath the user when `isPINS` flips.
A persisted id that no longer exists falls back to index 0 rather than rendering
nothing.

The wizard hides itself while `pinsStore.shouldShowUpgradeOverlay` is true and
persists `settingsStore.setupWizard.currentStepId` — a PINS upgrade restarts
services and can temporarily interrupt the app connection.

## Auto-open on a new PINS profile

After the first-run pass, App.vue reopens the wizard (at `localization`) when
on PINS the active profile has no device selected and its `Id` is not yet in
the `localStorage` list `setupWizardSeenProfiles` — a freshly flashed image or
a profile added in the profile manager. Criteria live in
`src/utils/setupWizardProfile.js`. Equipment is read from `profileInfo`, not
`existingEquipmentList`: `clearAllStates()` empties that list on every
transient connection loss while the profile stays.

## z-index staffing

Modals opened from inside the wizard teleport to `body`, so they need explicit
layering or they open invisibly _behind_ it:

| Layer                               | Value                                  |
| ----------------------------------- | -------------------------------------- |
| `Modal.vue` default                 | `z-40`                                 |
| `LoadingOverlay`                    | `z-[60]`                               |
| **Wizard overlay**                  | `z-70`                                 |
| Modals opened from the wizard       | `z-[75]`                               |
| `LocationSyncModal`                 | `z-[76]` — it blocks the mount connect |
| PINS upgrade overlay, `DialogModal` | `z-[80]`                               |

`Indi3rdpartyInstallPanel.vue:19` documents this at the call site.

## Third-party INDI driver installs

`ALLOWED_INDI_DRIVER_TYPES` in
`src/plugins/pins/composables/indiInstallUtils.js:39` accepts eight types:
`camera, filterwheel, flatpanel, focuser, rotator, switches, telescope,
weather`. It must stay in sync with `TYPE_OPTIONS` in
`PinsIndiRegistryEditModal.vue:303` — the registry an installed driver is
written into. Both are currently identical; `dome` and `safetymonitor` are
covered by neither.

## Location handling

The refs in `src/utils/location.js` are **module singletons**
(`latitude`, `longitude`, `altitude`, `syncDirection`, `ninaCoords`,
`mountCoords`), shared between the wizard's location step and
`LocationSettingsPins.vue`. Always call `useLocationStore().loadFromAstrometrySettings()` when
entering a location UI instead of trusting what the previous screen left behind.

- `getCurrentLocation()` writes **strings** (`toFixed`). Use text inputs, not
  `NumberInputPicker`. `saveCoordinates()` sanitizes them, including a decimal
  comma.
- With `syncDirection === 'TOTELESCOPE'`, `saveCoordinates()` disconnects and
  reconnects the mount and takes PHD2 with it. That takes several seconds, so a
  loading flag is mandatory.
