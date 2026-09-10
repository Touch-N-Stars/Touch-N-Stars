# CLAUDE.md

Guidance for AI agents working in this repository.

## Read these first

- [docs/AGENT_GUIDELINES.md](docs/AGENT_GUIDELINES.md) — the project's static agent harness:
  operating principles, product priorities, safety rules. It takes precedence over this file.
- [HighLevelDesign.md](HighLevelDesign.md) — architecture, the two backend runtime
  modes (NINA/WPF and PINS/headless), transports, and test-fixture boundary.
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution rules, i18n requirements.
- [src/plugins/plugins.md](src/plugins/plugins.md) — plugin authoring.

This file collects hard-won, non-obvious facts that are easy to get wrong and are not
derivable from reading the code quickly. Keep it high-signal; verify before relying on it.

## Verification

```bash
npm run lint
npm run format:check
npm run build
npm run i18n:check
npm run test:run
```

`npm run ci:verify` chains all of them plus `typecheck`. `typecheck` can OOM, and `test:run`
needs Node ≥ 22.15 (`registerHooks`) — below that every test file fails at module
instantiation, which looks alarming but says nothing about the code.

## PINS is NINA, forked to Linux

Not a separate headless backend. The same NINA runs there, so **everything the NINA
side offers exists in PINS mode too** - the Advanced API on `/v2/api`, the Touch'N'Stars
plugin server, equipment devices, the whole `/v2/api/equipment/*` surface. The PINS
daemon on port 8000 is *additional*, and only for host/system concerns (Wi-Fi, timezone,
keyboard layout, updates).

The HLD's phrase "PINS/headless mode with additional daemon APIs" is easy to misread as
"PINS has no NINA". It does. Never design a PINS fallback around the assumption that
`/v2/api` is unavailable there - the correct question is almost always whether a *device*
is connected, not which runtime mode is active (see the feature-detect rule in
`.claude/skills/api-endpoint/SKILL.md`).

## Polling is mandatory

NINA's `/v2/socket` WebSocket does **not** deliver every equipment/state change. The 2s HTTP
polling (`fetchAllInfos` in `src/store/store.js`) must not be replaced by WebSocket events.
Battery/performance work has to keep the polling and optimize elsewhere: adaptive intervals,
dropping unchanged payloads before store writes, batched backend endpoints.

## Skills: the deep procedures live outside this file

The recurring procedures are documented as on-demand skills in `.claude/skills/` instead of
here, so they cost no context until they are actually needed. Load the skill
before working in these areas — the details are not repeated in this file.

| Skill | Covers |
| --- | --- |
| `feature-kickoff` | new feature: interview the goal, agree acceptance criteria, write `docs/features/<slug>.md` |
| `equipment` | device map, INDI driver changes, OFFLINE reload, connect ordering, every `<X>Settings-…` profile trap |
| `setup-wizard` | wizard steps and their order, z-index staffing, location and coordinate handling |
| `api-endpoint` | plugin-server controllers, the five base URLs, the apiService facade and its surface snapshot |
| `changelog` | CHANGELOG entries and the What's New parser contract |
| `i18n` | locale keys, the checker's rules, translation workflow |
| `tns-review` | three parallel review agents: functionality, UI, maintainability |

## Android networking: two confirmed non-bugs

Do not chase these as app-logic bugs.

- **~2 min WebView stall after Wi-Fi cut + return when mobile data is on.** Chromium attaches
  new requests to TCP connect jobs created over the dead path; they only die at the Linux
  connect timeout (~127s). With mobile data off the app reconnects within seconds. Relevant in
  the field: users join a PINS AP without internet while mobile data is on.
- **~3 min of retries after screen lock** before Android Doze kills in-flight requests. On real
  resume everything reconnects within ~2s. The `resumePending` flag in `App.vue:performResume()`
  fixes the older bug where a real resume trigger was swallowed by the re-entrancy guard — if a
  "doesn't reconnect after unlock" report comes in, check for
  `App resume already in progress, skipping duplicate trigger` with no follow-up first.

## UI conventions

Use the `tns-*` utilities from `src/assets/tailwind.css` (`tns-card`, `tns-btn-primary`,
`tns-btn-secondary`, `tns-input`, `tns-select`, `min-h-touch`), not the legacy raw
gray/cyan palette still present in older screens.

Haptics: a global click listener (`src/services/globalHaptics.js`) taps every control that
actually does something - `<button>`, `[role=button]`, checkboxes/radios and navbar entries.
Clickable rows and cards, labels, plain links and `<select>` stay silent. Do **not** call
`useHaptics()` in components for press feedback; `tns-btn-danger` gets the stronger tap
automatically, and `data-haptic="light|medium|none"` overrides any of it. `useHaptics()` stays for outcome feedback (`notifySuccess`/
`notifyError`) and non-click gestures.

Drag & drop: every `<draggable>` needs `:fallbackOnBody="true"`. `backdrop-filter` on a parent
creates a containing block for `position: fixed`, which misplaces Sortable.js's ghost on Android
Chrome. Do **not** use `forceFallback: true`.

Long-press on iOS: WebKit has **two** different native menus and they are driven by two
different properties. "Copy / Look Up / Share" with the magnifier is the *text selection*
callout — that one is `-webkit-user-select`. The image/link preview popup is
`-webkit-touch-callout`. `@contextmenu.prevent` stops neither. Both are now switched off
app-wide on `body` in `src/assets/tailwind.css`, with `input`/`textarea`/`[contenteditable]`
opted back into selection (without that, WebKit loses caret placement and paste inside form
fields). Output the user wants to mark and copy carries Tailwind's plain `select-text`
(`PinsTerminalOutput.vue`, `JsonPreviewModal.vue`, `Phd2LogView.vue`) — an element's own
`user-select` beats the inherited `body` value, so no custom utility is needed. Components normally do **not** need to
set either property themselves any more; the older per-component blocks in `moveAxis.vue`,
`NavigationComp.vue`, `ZoomableImage.vue` etc. are redundant leftovers.

The build trap behind it: CSS is minified by lightningcss, which drops every vendor prefix it
thinks the target does not need. With `build.cssTarget` inherited from `build.target:
'esnext'`, **every `-webkit-user-select` was stripped from the bundle** — verifiable with
`grep -c webkit-user-select dist/assets/*.css`. Safari only supports the unprefixed property
from 17.0, so the rules silently did nothing on iOS 16 and older. `vite.config.js` therefore
pins `cssTarget: ['chrome87', 'safari15', 'ios15']` separately from the JS target. Keep both
the prefixed and unprefixed declaration when writing such a rule.

i18n: add new keys to `src/locales/en.json` **only** while implementing, and ask before
generating the other 13 locales — translations are produced in one deliberate batch right
before the commit, never scattered through the work. Until then `i18n:check` reports
`missing (N)` for all 13; that is the expected mid-work state. Every user-facing string
needs an entry. Procedure, checker rules and tooling traps: `.claude/skills/i18n/SKILL.md`.

Targets are Android, iOS and the browser — keep all three working.

Code comments: always write in English, regardless of the language used in the conversation
or commit messages.
