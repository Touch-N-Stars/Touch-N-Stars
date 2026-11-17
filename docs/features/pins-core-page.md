# PINS page as a core part of the app

Status: implemented, pending review
Date: 2026-10-25

## Goal

On a PINS device all device settings live on one page that is always there: network, services,
system, software and update. The user no longer has to enable a plugin to reach Wi-Fi or
updates, and the PINS blocks scattered across the settings tabs move onto that page. This is
the structural half; installing NINA plugins together with app plugins is
[nina-plugin-install.md](nina-plugin-install.md).

## Scope

- Runtime modes: PINS. On NINA/Windows the page stays invisible, as today.
- Surface: new core route and nav entry (code moves out of `src/plugins/pins/`); new "System"
  tab on that page; `SettingsConnectionTab.vue` loses its PINS blocks.
- Backends touched: none (existing pinsdaemon `:8000` routes only).

## Non-goals

- `isPins` in `plugin.json` and the "PINS Plugins" section in Settings → Plugins stay as they
  are. The plugins carrying it really only work on PINS.
- Location (`LocationSettingsPins`) and the horizon file path stay in the settings: they
  belong to the NINA profile, not to the device.
- No tab changes its behaviour; the setup wizard is unchanged.
- No apiService surface change.

## Acceptance criteria

1. Given a PINS connection, the navigation shows the PINS entry without anything being enabled
   in Settings → Plugins, and "pins" no longer appears in that plugin list.
2. Given a NINA/Windows connection, there is no PINS nav entry and the `/pins` route shows no
   PINS functions.
3. Given a user who had the old plugin disabled, or had moved or hidden it in the navbar
   customization, when they start the new version, the PINS entry appears; its position and
   hidden state carry over from `plugin-pins` to the new static id, and the nav entries of the
   other plugins keep working.
4. Given the PINS page, there is a "System" tab with time sync, localization (locale,
   regulatory domain, timezone, keyboard) and swap; these blocks are gone from Settings →
   Connection, and the wizard's localization step works unchanged.
5. Given the navbar customization, the PINS entry can be moved and hidden like any core page.
6. `pins.vue` is a thin tab shell; each tab takes its state from its own composable. On the VM,
   connect Wi-Fi, save hotspot, install an INDI driver, install a NINA package and run an
   upgrade behave exactly as before.
7. Pure logic extracted during the split has unit tests; the existing tests under
   `pins/composables/__tests__` stay green.

## Dimensions considered

| Dimension | Applies | Note |
| --- | --- | --- |
| Runtime modes | yes | PINS only; gated on `store.isPINS` like the old nav filter, since the whole page is the pinsdaemon |
| Polling | no | No new state; the page's existing pollers move with it unchanged |
| Mobile | yes | Five tabs in the SubNav must fit at phone width; no layout change otherwise |
| i18n | yes | Tab label for "System" and the nav title need keys; existing `plugins.pins.*` keys may be kept to avoid a 14-locale rename |
| Equipment safety | no | No hardware commands added |
| Error paths | no | Unchanged; existing daemon error handling moves along |
| Native | no | No Capacitor-specific behaviour involved |
| Persistence | yes | Old `plugin-store` entry for `pins` and navbar ids `plugin-pins` must migrate (criterion 3) |
| Tests | yes | Composables extracted in D (criterion 7) |

## Implementation notes

- Route `/pins`, nav id `pins`; `migrateNavbarIds` (`src/utils/navbarIdMigration.js`) renames
  `plugin-pins` on the next navbar load from the backend.
- Code lives in `src/components/pins/` (tabs, cards, composables, `system/`), the shell in
  `src/views/PinsPage.vue`, the store in `src/store/pinsStore.js` (localStorage key
  `pins-plugin-store` kept).
- Tabs are mounted with `v-show`, so a running job keeps its log stream across tab switches and
  upgrade tracking survives the service restart that briefly drops PINS detection.
- Shared job plumbing (start, terminal log, job WebSocket, final status) is
  `usePinsJobRunner`; each tab has its own composable.
- Two deliberate deviations from the old code: the INDI install modal now closes after a
  successful start (before, the close call was swallowed by its own `isInstalling` guard), and
  the never-reached Wi-Fi branch of the final job status check is gone (no Wi-Fi operation
  streams a job log).

## Open questions

- Criterion 6 is verified only read-only against the Pi (all tabs load real data at 412 px).
  Connecting Wi-Fi, saving the hotspot, installing a driver/package and running an upgrade
  still need a manual run on the VM.
