# Install the NINA plugin together with the app plugin

Status: implemented, pending review
Date: 2026-10-25

## Goal

When a user enables an app plugin that needs a NINA plugin, PINS offers to install it right
there, including the NINA restart that activates it; on Windows the user gets a clear hint
instead. Nobody has to know any more which PINS package belongs to which app plugin. The
structural half is [pins-core-page.md](pins-core-page.md).

## Scope

- Runtime modes: both. Detection works in both through `GET /v2/api/application/plugins`;
  installing and restarting exist on PINS only.
- Surface: Settings → Plugins (toggle dialog); a shared "NINA plugin missing" component used by
  the plugin views (LiveStack, NightSummary, LuckyCapture, Ground Station, Perihelion,
  10micron).
- Backends touched: Advanced API `/v2/api` (existing), pinsdaemon `:8000` (existing
  `/plugins`, `/plugins/install`), plugin server `system/restart` (existing device reboot).

## Non-goals

- Disabling an app plugin never uninstalls its NINA package.
- The package list in PINS → Software stays complete (install, uninstall, versions).
- No automatic install without confirmation; no install on Windows.

## Acceptance criteria

1. Given PINS and a missing NINA plugin, when the user enables e.g. LiveStack in Settings →
   Plugins, an install dialog opens; confirming starts the daemon job with visible progress,
   cancelling leaves the app plugin enabled and installs nothing.
2. Given a plugin view opened while its NINA plugin is missing, a shared component shows the
   "NINA plugin missing" state — on PINS with an install button, on Windows with a hint to the
   NINA plugin manager and no button. It replaces the per-plugin variants in LiveStack and
   NightSummary.
3. Given a successful install, the user is asked whether to restart PINS; confirming reboots
   the device, the dialog waits, and once NINA lists the plugin again the plugin view loads
   without a manual reload.
4. Given a running sequence, the restart prompt warns explicitly that the sequence will be
   aborted and requires its own confirmation.
5. Given a device that does not come back with the plugin within 6 minutes, the user sees a
   "check the device" hint instead of an endless wait; a refused restart (HTTP error) keeps the
   prompt with the error.
6. Given an install failure (job failed, timeout, daemon unreachable), an error with the job
   log is shown, the app plugin stays enabled, and the install can be retried.
7. The mapping lives in `plugin.json` as `ninaPlugin: { name, pinsPackage }`; matching against
   `/application/plugins` is case-insensitive (`LiveStack`, `PINS.LuckyCapture`,
   `NINA.Plugin.NightSummary`) and covered by a unit test.

## Dimensions considered

| Dimension        | Applies | Note                                                                                                                                    |
| ---------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime modes    | yes     | Feature-detect the NINA plugin via `/application/plugins` in both; install only where the daemon answers                                |
| Polling          | no      | One-shot checks on toggle and view mount; no new poller                                                                                 |
| Mobile           | yes     | Dialog and job log must fit at phone width with 48 px targets                                                                           |
| i18n             | yes     | Dialog, missing-state, restart and fallback texts need `en.json` keys                                                                   |
| Equipment safety | yes     | NINA restart aborts a running sequence and drops device connections → explicit confirmation, warning when a sequence runs (criterion 4) |
| Error paths      | yes     | Criteria 5 and 6; NINA down during restart is handled by the existing reconnect                                                         |
| Native           | no      | No Capacitor-specific behaviour beyond the existing resume/reconnect                                                                    |
| Persistence      | no      | Nothing stored beyond the existing plugin enabled flag                                                                                  |
| Tests            | yes     | Mapping/matching helper (criterion 7); job flow reuses `pollJobUntilFinished`                                                           |

## Implementation notes

- Gated plugins: LiveStack, LuckyCapture, Ground Station, Night Summary. Perihelion and
  10micron are left out: `pins-plugin-perihelion` and `pins-plugin-tenmicron` are in the
  daemon's list but not in the package repository (`apt-cache search pins-plugin` on the Pi,
  2026-10-25), so an install would fail.
- `ninaPlugin: { name, displayName, pinsPackage }` in plugin.json; `name` is matched against
  `/application/plugins`, `displayName` is what the dialog shows.
- `withNinaPluginGate` wraps the route view, so the view (and its onMounted logic) only mounts
  once NINA lists the plugin. If NINA cannot be asked, the view is shown as before.
- `useNinaPluginInstallStore` drives one `NinaPluginInstallDialog` in App.vue, opened from
  Settings → Plugins or from the gate. A package that is installed but not loaded goes straight
  to the restart step.
- `manage-plugin.sh` restarts `pins.service` after an uninstall, not after an install, so the
  daemon already has the rights a restart endpoint needs.

## Open questions

- Verified against the Pi with a filtered `/application/plugins` response (gate, dialog from the
  gate and from Settings). A real install plus PINS restart has not been run.

## Change after review

- The restart reboots the whole PINS device through the plugin server's `system/restart`
  (`sudo shutdown -r now`) instead of a NINA-only daemon route, so no pinsdaemon change is
  needed. The dialog waits up to 6 minutes for NINA to list the plugin again, then shows a
  "check the device" hint. All user-facing texts say PINS for this restart.
