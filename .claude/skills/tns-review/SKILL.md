---
name: tns-review
description: Review changed Touch'N'Stars code with three parallel agents, one each for functionality, UI and maintainability, against this project's own rules (NINA/PINS dual mode, polling contract, mobile-first UI, i18n). Use before opening a PR or when asked for a thorough review of a branch or working tree.
---

# Three-lens agent review

Runs three read-only review agents in parallel, each with its own lens, then
merges their findings. Invoking this skill **is** the explicit request to spawn
subagents.

## When this is worth it

Worth it: a feature branch before the PR, a change that touches equipment
control, connection handling or a shared store, anything that has to work in
both NINA and PINS mode.

Not worth it: a one-line fix, a locale-only change, generated files. Use the
built-in `/code-review` for generic correctness passes — this skill exists for
the project-specific rules a generic reviewer cannot know.

## Step 1 — determine the scope

```bash
git diff --stat                        # working tree
git diff origin/develop...HEAD --stat  # branch, when the working tree is clean
```

Default: review the working-tree diff. If it is empty, review
`origin/develop...HEAD`. If both are empty, stop and say so — do not invent a
scope. An argument (`/tns-review <ref|path>`) overrides this.

Read the diff yourself before spawning. The agents need a concrete brief, not
"review the branch": which files, which layers (component / store / service),
which runtime modes are affected, and whether native (Capacitor) code is
touched.

## Step 2 — spawn all three agents in one message

Use `subagent_type: "general-purpose"`, all three in a **single** message so
they run in parallel. Give each the same scope block, then its own checklist.

Every agent prompt must carry these constraints verbatim:

> Read-only review. Do not edit, write or create any file. Do not commit, and do
> not run builds, installs or anything that mutates the repository — `git diff`,
> `git show`, `grep` and reading files only. Report findings; do not fix them.
> Every finding needs a concrete failure scenario (input or state → wrong
> behavior). A finding you cannot back with one is not a finding — drop it.
> State for each finding whether you verified it in the code or are inferring it.

### Agent 1 — Functionality

- **Both runtime modes.** Does this work in NINA *and* PINS mode? A field that
  only one stack reports must be feature-detected on the payload, not branched
  on `store.isPINS` — the pattern is `src/store/cameraStore.js:109`
  (`TempChangeRunning`), which falls back to a heuristic when the field is
  absent.
- **Polling contract.** `/v2/socket` does not deliver every state change, so
  polling must not be replaced by WebSocket events. Every new or changed poller
  goes through `usePolling` (`src/composables/usePolling.js`) in components, or
  `createPoller` (`src/utils/poller.js`) / `useBackgroundAwarePolling`
  (`src/utils/appLifecycle.js`) elsewhere, and pauses when the app is
  backgrounded. A raw `setInterval` is a finding.
- **Equipment safety.** Connection ordering (switch first with its 5 s wait,
  mount before guider), profile values via `useProfileSetting`
  (`src/composables/useProfileSetting.js`) — a direct
  `apiService.profileChangeValue` is only allowed in the files listed as
  exceptions in `eslint.config.js` — and device selection via
  `setProfileDevice` (`src/utils/equipmentDevices.js`) so it survives the next
  device-list refresh.
- **Races.** Stale responses overwriting newer state, missing fetch
  generations, re-entrancy guards, and operations that take seconds
  (mount reconnect, driver reload, PHD2) without a loading flag.
- **Error paths.** Backend restart, request timeout, a field missing from the
  payload, an empty device list — what does the user see?
- **i18n keys referenced in the diff exist** in `src/locales/en.json`.

### Agent 2 — UI

- **Mobile-first.** Narrow viewports, safe areas, orientation changes. Primary
  controls keep a 48 px touch target (`min-h-touch` / `min-w-touch`, defined via
  `--spacing-touch` in `src/assets/tailwind.css:36`).
- **Design system.** Use the `tns-*` utilities (`tns-card`, `tns-btn-primary`,
  `tns-btn-secondary`, `tns-btn-danger`, `tns-input`, `tns-select`,
  `tns-status-*`), not the legacy raw gray/cyan palette still present in older
  screens.
- **Low-light operation.** Contrast and dark-mode readability must not regress;
  modals and dialogs stay operable.
- **Building blocks instead of hand-rolled UI.** Overlays go through `Modal`,
  loading states through `Spinner`, missing devices through
  `DeviceNotConnected`, numeric fields through `NumberInputPicker` (all in
  `src/components/helpers/`). A new `fixed inset-0` overlay, `animate-spin`
  spinner or `type="number"` input is a finding.
- **z-index staffing:** pick a named layer from the `zIndex` scale in
  `tailwind.config.cjs` (`z-modal` 40, `z-loading` 60, `z-overlay` 70,
  `z-overlay-modal` 75, `z-overlay-blocking` 76, `z-dialog` 80, ...), never a raw
  `z-50` / `z-[n]` / `z-index: n`. Anything teleported to `body` needs a layer.
- **Drag & drop:** every `<draggable>` needs `:fallbackOnBody="true"`; no new
  `forceFallback: true`; watch for `backdrop-filter` on a parent, which creates
  a containing block for `position: fixed` and misplaces the ghost on Android
  Chrome.
- **Text.** No hardcoded user-facing strings. Layout survives longer
  translations — German runs roughly 30% longer than English.

### Agent 3 — Maintainability

- **Reuse before new code.** Check `src/utils/`, `src/composables/` and
  `src/services/api/` for something that already does this. Name the existing
  helper when one exists.
- **Duplication that will drift.** The repo's own examples: `selectIndi.vue`
  repeats the same driver-change body ten times while
  `setupWizard/IndiDriverSelect.vue` does it generically, and `getBaseUrl`
  exists twice (`api/core.js` and `apiPinsService.js`) with diverging keys.
  Flag new instances of that shape.
- **Layer separation.** Component ↔ store ↔ service. No axios in components, no
  DOM work in stores.
- **Tests.** New logic needs a test, and it belongs on the extracted util rather
  than on the component — see `src/utils/__tests__/equipmentDevices.test.js`.
- **Comments in English**, explaining *why* rather than restating the code. Dead
  code, unused imports, leftover console noise.
- **Generated files** (`public/whats-new.json`, the plugin registry) must not be
  hand-edited.

## Step 3 — merge the findings yourself

The agents report to you, not to the user.

1. **Deduplicate.** The same line found through two lenses is one finding with
   two reasons, not two findings.
2. **Verify what was inferred.** Open the file for every finding marked as
   inferred and drop the ones that do not hold. Agents are confidently wrong
   often enough that this step is the point of the merge.
3. **Rank** by severity: blocker (breaks a session, breaks one runtime mode,
   loses user data) → should fix → nice to have.
4. **Report** as a list of `file:line — what breaks, under which conditions`,
   then a verdict: *pass* / *pass with notes* / *needs changes*, matching the
   reviewer output in `docs/AGENT_GUIDELINES.md:230`.

Name what was **not** covered — untested runtime mode, no hardware validation,
native platforms not built. A review that hides its blind spots is worse than a
short one.

## Step 4 — stop there

Report the findings and stop. Do not fix, do not commit. Applying fixes is a
separate request, so the user decides which findings are worth acting on.
