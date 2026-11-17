# Touch-N-Stars Agent Guidelines

Touch-N-Stars is a mobile-first Vue 3 + Capacitor control interface for N.I.N.A.-based astrophotography sessions. It is hardware-adjacent and system-adjacent software: changes can affect real cameras, mounts, focusers, filter wheels, rotators, domes, safety monitors, sequences, Raspberry Pi/PINS services, and user imaging sessions.

These rules apply to all coding, review, documentation, test, and automation work in this repository.

This file is the project’s **static agent harness**: the always-loaded rules that keep AI-assisted development disciplined. Keep this file high-signal. Put task-specific logs, screenshots, issue text, device details, API examples, and temporary investigation notes in the task prompt or companion docs instead of bloating this file.

## Operating Principle: Agentic Engineering, Not Vibe Coding

Use AI agents as implementation engines inside a controlled engineering system. Do not rely on “it seems to work.” Production work requires clear intent, repository inspection, scoped changes, deterministic validation, and human-reviewable evidence.

For Touch-N-Stars, agentic engineering means:

- **Specification before generation:** define the task, non-goals, affected runtime modes, affected transports, and acceptance criteria before editing.
- **Context before code:** inspect the actual implementation, project docs, and current dependency/API documentation before proposing dependency-specific changes.
- **Safety before cleverness:** real-session equipment workflows must remain predictable, explicit, and reversible.
- **Verification before confidence:** run relevant lint/typecheck/test/build/i18n checks, or state exactly why they could not be run.
- **Review before final:** inspect the final diff against acceptance criteria, N.I.N.A./PINS contracts, mobile UX, plugin routing, and safety risks.
- **Human judgment stays in charge:** architecture, equipment safety, runtime mode behavior, API sequencing, secrets, release readiness, and live hardware validation must remain reviewable by a maintainer.

## Product Priorities

Implementations must respect these priorities, in this order:

1. Real astrophotography session safety and predictable equipment-control behavior.
2. Correct N.I.N.A. Advanced API and Touch-N-Stars plugin server integration.
3. Mobile-first phone/tablet usability for real field operation.
4. PINS/Raspberry Pi/headless compatibility where relevant.
5. Reliable connection, reconnection, polling, WebSocket, and SignalR behavior.
6. Clear user feedback for invalid equipment states and backend/API errors.
7. Plugin architecture stability and route/identity correctness.
8. i18n correctness for user-facing text.
9. Capacitor Android/iOS packaging and update flow preservation.
10. Mock mode only for UI development, demos, and selected tests; never as proof of real backend or hardware behavior.
11. No hidden cloud dependency or hardcoded secret/token behavior.
12. Small, testable, additive changes over speculative rewrites.

If priorities conflict, choose the earlier priority and document the trade-off.

## Project Snapshot Agents Must Preserve

Touch-N-Stars currently includes:

- Vue 3.5 Composition API frontend, Vite build, Vue Router 5, Pinia 3, persisted state, Tailwind CSS, vue-i18n, and Capacitor 8 Android/iOS shell.
- A mobile-first UI for controlling and monitoring N.I.N.A. workflows from browsers, tablets, phones, and embedded displays.
- Two backend runtime modes:
  - Standard N.I.N.A. mode using the Touch-N-Stars plugin server and N.I.N.A. Advanced API V2.
  - PINS/headless mode with additional daemon APIs, SignalR hubs, and Raspberry Pi/Linux-oriented behavior.
- Local contract fakes and browser fixtures for selected automated tests. There is
  no selectable mock runtime mode in the current application.
- Multiple communication paths:
  - Touch-N-Stars plugin server REST under `/api/*`.
  - Advanced API V2 REST under `/v2/api/*`.
  - Advanced API WebSocket channels such as `/v2/socket`, `/v2/mount`, and `/v2/tppa`.
  - SignalR hubs for PINS notifications, dialogs, progress, and message boxes.
  - `pinsdaemon` system API, usually on port `8000`, for PINS/headless system features.
- Connection orchestration through global Pinia stores and service adapters.
- Dynamic plugin discovery through `src/plugins/*`, generated plugin registry, plugin metadata, and plugin-local views/stores.
- Build-time generated artifacts such as plugin registry and `public/whats-new.json` from `CHANGELOG.md`.
- Heavy astronomy visualization/static assets under `public/celestia-atlas-data`;
  native builds intentionally exclude this tree and use the NINA plugin copy.
- Native OTA update behavior through Capacitor/Capgo update flow.
- i18n locale files under `src/locales`.

Do not describe mock, scaffolded, generated, or locally simulated behavior as proof of real N.I.N.A., PINS, SignalR, WebSocket, pinsdaemon, or hardware compatibility.

## Static vs Dynamic Context

Use this file for stable, always-applicable rules. Load dynamic context only when relevant:

- **Repository files:** inspect actual implementation before editing.
- **Project docs:** check `HighLevelDesign.md`, `GEMINI.md`, `.github/gemini-context.md`, `.gemini/styleguide.md`, `CONTRIBUTING.md`, and plugin docs when relevant.
- **Task packet:** use issue text, user request, screenshots, logs, API payloads, device state, runtime mode, and platform details.
- **Dependency docs:** use Context7 MCP for third-party packages and APIs.
- **Integration/API docs:** inspect N.I.N.A. Advanced API, Touch-N-Stars plugin server behavior, PINS/pinsdaemon docs/code, and actual service adapters when integration behavior changes.
- **Validation output:** treat lint/test/build/i18n/typecheck results as feedback, not decoration.

Avoid dumping entire unrelated files into the prompt. Prefer precise file paths, relevant excerpts, and task-specific contracts.

## Documentation Freshness And Context7 MCP

When working with third-party libraries, frameworks, APIs, SDKs, package configuration, or dependency-specific implementation details, use the Context7 MCP server before proposing or changing code.

Required rules:

- Prefer current Context7 documentation over built-in model knowledge for external dependencies.
- Use Context7 before implementing or reviewing changes involving Vue, Vite, Pinia, Vue Router, vue-i18n, Tailwind, Capacitor, Capgo updater, Axios, SignalR, WebSockets, ESLint, Prettier, Vite plugins, npm packages, Android/iOS tooling, or other external APIs.
- Do not rely on outdated examples when library behavior, configuration syntax, CLI flags, or APIs may have changed.
- If Context7 is unavailable, say so explicitly and continue only with repository inspection and clearly stated assumptions.
- Mention relevant documentation sources, package versions, or assumptions in the plan, review notes, or final response when they affected the implementation.
- Context7 supplements repository inspection; it does not replace reading the actual project files before editing.

## Agent Operating Modes

Choose the lowest-autonomy mode that fits the risk.

### Conductor Mode

Use for ambiguous, risky, architectural, hardware-facing, system-mutating, security-sensitive, API contract, transport, PINS, native mobile, release/update, or production-breaking work. The agent should make small changes, surface decisions early, and preserve human control.

### Orchestrator Mode

Use for well-specified, bounded tasks with clear tests and existing patterns. The agent may handle multi-file changes, but must still plan, inspect, validate, and review.

### Background/Delegated Mode

Use only for narrow, reproducible tasks that are easy to validate, such as adding translations, updating docs, adding tests for an existing contract, or applying a repeated UI pattern. The task prompt must include explicit acceptance criteria and validation commands.

Never use high-autonomy execution for work that lacks a clear rollback path or touches real hardware commands, system services, auth/tokens, native release behavior, update flows, or backend command sequencing.

## Architecture Boundaries

Keep implementation layers separated:

- **Presentation:** Vue views and reusable components under `src/views` and `src/components`.
- **Domain state:** global Pinia stores under `src/store` and plugin-local stores under `src/plugins/*/store`.
- **Integration services:** REST, Advanced API, SignalR, WebSocket, updater, mock, and daemon services under `src/services`.
- **Transport orchestration:** connection handshake, polling loops, socket lifecycle, reconnection, and runtime-mode detection.
- **Plugin system:** `src/plugins/*`, `plugin.json`, plugin entry points, generated `src/plugins/pluginRegistry.js`, dynamic route injection, plugin navigation.
- **Mobile/native shell:** Capacitor configuration, Android/iOS projects, keep-awake, filesystem, status bar, updater, platform-specific behavior.
- **PINS/headless integration:** SignalR hubs, pinsdaemon system API, PINS-specific views/plugins, Raspberry Pi/Linux assumptions.
- **Mock and contract fixtures:** mock API service, simulated state, contract mock behavior, test-only data.
- **Localization:** `src/locales/*.json`, i18n scripts, translation keys, user-facing text.
- **Build/release assets:** generated plugin registry, generated whats-new JSON, `dist`, native builds, OTA update metadata, static astronomy assets.
- **Docs and contribution guidance:** README, wiki-facing docs, HLD, Gemini context/styleguide, plugin docs, changelog.

Do not mix unrelated layers unless the task explicitly requires it. If a feature spans layers, define the contract between layers and test the boundary.

## Required Workflow

Use this role sequence for implementation tasks:

1. Planner
2. Engineer
3. Developer
4. Reviewer

For small fixes, the roles can be summarized briefly, but the thinking still has to happen.

### Planner

Planner responsibilities:

- Read the request, task packet, and relevant project docs.
- Run `git status --short` before edits.
- Identify existing uncommitted changes as user/team work.
- Inspect current implementation before proposing changes.
- Identify whether Context7 or external API docs are required.
- Identify affected layers, runtime modes, transports, stores, plugins, and files.
- Define non-goals to prevent scope creep.
- Define acceptance criteria and validation commands.
- Identify N.I.N.A., Advanced API, PINS, pinsdaemon, mobile, i18n, plugin, safety, release, and data risks.

Planner output should include:

- Task summary.
- Operating mode: conductor, orchestrator, or background/delegated.
- Affected areas.
- Runtime modes in scope: standard N.I.N.A., PINS/headless, mock.
- Non-goals.
- Implementation steps.
- Acceptance criteria.
- Test/eval plan.
- Risks or assumptions.

### Engineer

Engineer responsibilities:

- Convert the plan into a concrete technical design.
- Prefer existing interfaces, stores, composables, services, and local patterns.
- Keep N.I.N.A. Advanced API, Touch-N-Stars plugin server, PINS, pinsdaemon, and mobile clients in mind.
- Avoid rewrites unless the task requires them.
- Define data, service, store, component, plugin, transport, and runtime-mode contracts clearly.
- Define failure behavior and edge cases.
- Note backward compatibility and release/update behavior.

Engineer output should include:

- Technical design.
- Files/modules to modify.
- Interfaces/contracts to add or change.
- Runtime modes and transports affected.
- Edge cases and error states.
- Compatibility notes.
- Validation strategy.

### Developer

Developer responsibilities:

- Implement only the agreed scope.
- Use targeted patches.
- Preserve existing behavior unless the task explicitly changes it.
- Do not delete, revert, overwrite, or mass-format unrelated work.
- Add or update tests when behavior changes.
- Add or update i18n entries for user-facing text.
- Update docs/changelog when behavior changes and the project convention requires it.
- Add comments only for non-obvious logic.
- Re-read files immediately before editing if other changes may exist.
- Avoid dependency additions unless justified and documented.

Developer output should include:

- Implementation summary.
- Changed files.
- Tests/docs/i18n entries added or updated.
- Deviations from plan, if any.

### Reviewer

Reviewer responsibilities:

- Review the final diff before finishing.
- Check acceptance criteria.
- Check N.I.N.A. Advanced API and Touch-N-Stars plugin server compatibility.
- Check PINS/pinsdaemon and Raspberry Pi/Linux impact where relevant.
- Check connection/reconnection, polling, WebSocket, and SignalR behavior where relevant.
- Check existing mobile and desktop browser behavior.
- Check Capacitor Android/iOS packaging/update impact where relevant.
- Check plugin identity/routing behavior.
- Check i18n completeness for user-facing text.
- Check that real hardware or system-mutating operations are not triggered by default tests.
- Check secrets/tokens are not hardcoded.
- Check unrelated user/team changes were preserved.
- Check hallucinated dependencies, incorrect imports, dead code, and error handling gaps.
- Run relevant validation or state exactly why it was not run.

Reviewer output should include:

- Result: pass, pass with notes, or needs changes.
- Issues found.
- Required fixes, if any.
- Validation results.
- Remaining risks.

## Repository Safety

Before making changes:

```bash
git status --short
```

Treat any existing uncommitted changes as user/team work. Do not revert or overwrite them.

Never run destructive Git commands unless the user explicitly requests them:

- `git reset --hard`
- `git checkout -- .`
- `git clean -fd`
- force-push
- rebase or amend without explicit instruction

Prefer additive, targeted fixes over broad rewrites.

Before finishing:

```bash
git diff --stat
git diff
```

Review the diff and confirm it contains only task-related changes. Some project scripts can generate or modify files; inspect generated diffs before including them.

## N.I.N.A. And Advanced API Rules

N.I.N.A. operations are highly state-dependent. Many operations are valid only when equipment is connected, not parked, not already exposing, not already slewing, not sequencing, and not in a safety-restricted state.

Required rules:

- Do not assume an API command can always be issued safely.
- Do not invent Advanced API endpoints, response envelopes, command names, or WebSocket events.
- Preserve the expected response shape and error handling used by existing services.
- Treat common domain errors as normal states, not exceptional surprises: camera not connected, camera already exposing, mount parked, mount already slewing, guider unavailable, sequencer not initialized, profile unavailable, plate solve failed, safety monitor unsafe, weather source unavailable.
- HTTP `409` or equivalent invalid-state responses should usually produce clear UI guidance, not blind retries.
- Long-running or stateful operations must expose progress/errors clearly and must not hide failures from the user.
- Hardware-affecting UI must be explicit and must not silently trigger movement, exposure, sequence changes, or system mutation.

## Backend Handshake And Transport Rules

Respect the real connection sequence:

1. Connect to the Touch-N-Stars plugin server.
2. Check `/api/version`.
3. Resolve the Advanced API port using `/api/get-api-port`.
4. Use the returned Advanced API port.
5. Check `/v2/api/version`.
6. Detect whether PINS features are available.
7. Connect `/v2/socket` and subscribe to relevant events.
8. In PINS mode, connect SignalR hubs.
9. In PINS mode, query pinsdaemon on port `8000` only when needed.

Required rules:

- Do not assume Advanced API is always on fixed port `1888`; it may be discovered dynamically.
- Do not assume PINS mode is active just because the frontend is running.
- Do not treat a missing PINS endpoint as complete app failure; the user may be in standard N.I.N.A. mode.
- Preserve reconnection behavior, polling cadence, cleanup on instance switch, and transport teardown.
- Prefer event-driven assertions over arbitrary timing waits in tests.
- WebSocket and SignalR changes must handle disconnects, reconnection, duplicate subscriptions, and stale events.

### Background/Foreground Polling Rule

Any new `setInterval`/recursive `setTimeout` poller (store action or component-owned) **must** pause while the app is backgrounded and resume on foreground. On Android, backgrounded WebViews are throttled/suspended unpredictably rather than reliably killed outright, so an unpaused poller can keep hitting the backend for a variable window before the OS actually freezes it, and then fire a burst of stale/overlapping requests on resume.

Required rules:

- Do not add a raw `setInterval`/`setTimeout` poller. Use `createPoller` from `src/utils/poller.js` (guards against overlapping ticks) as the base primitive.
- If the poller simply runs while its component is mounted, use `usePolling(fetchFn, intervalMs)` from `src/composables/usePolling.js`. It starts on mount, stops on unmount, and pauses on background. Pass `autoStart: false` to control it through the returned `start()`/`stop()`.
- If the poller's active/inactive state is driven by a prop, `v-if`, or a computed condition (e.g. "only while this modal is open"), wrap it with `useBackgroundAwarePolling(fetchFn, intervalMs, activeRef)` from `src/utils/appLifecycle.js` instead of managing `onMounted`/`onUnmounted`/`watch` by hand. This automatically pauses on background and resumes on foreground without needing to be wired into `App.vue`.
- Both helpers resume on the regular interval, without an immediate tick: `App.vue` aborts stale requests shortly after the foreground switch, and an aborted request resolves as an empty response that callers would write into their state. Set `immediateOnResume: true` (`useBackgroundAwarePolling` only) only if waiting a full interval after resume is worse and `fetchFn` tolerates that empty response.
- If the poller is store-owned and view-scoped (started/stopped by a specific view's `onMounted`/`onUnmounted`, e.g. `guiderStore`, `pinsDeviceStore`, `sequenceV2Store`, `pinsAllSkyStore`), keep using `createPoller` directly, but register a `was<X>PollingBeforePause` flag and explicit `stop()`/`start()` calls in `App.vue`'s `pauseApp()`/`performResume()`, and add a `stop()` call to `store.js`'s `clearAllStates()`.
- Never add a poller that only stops in `onUnmounted`/`onBeforeUnmount` without also reacting to background/foreground — that was the recurring bug class this rule exists to prevent.
- Before pausing an existing timer, check whether it is also a heartbeat or a safety watchdog. Those must keep running for as long as the OS allows, and the code must say why. Examples: `FocusPanel.vue` in the LuckyCapture plugin keeps polling while it holds a lease because the poll carries the heartbeat for armed focus motion; `MeridianFlipDayTest.vue` keeps polling because the poll halts the mount when the flip is overdue.

## PINS And pinsdaemon Rules

PINS/headless support can involve Raspberry Pi/Linux hosts, daemon-backed system features, INDI/PHD2 integration, system services, firmware upload, Wi-Fi changes, updates, package installation, and diagnostic archives.

Required rules:

- Treat pinsdaemon and PINS system-mutating endpoints as dangerous by default.
- Never run system-mutating daemon operations in default PR tests or generated examples.
- Do not hardcode real bearer tokens, hostnames, Wi-Fi credentials, secrets, or API keys.
- Use environment variables or explicit test fixtures for tokens.
- Preserve standard N.I.N.A. behavior when adding PINS-specific logic.
- Do not assume Windows-only paths for code that may run in PINS/Raspberry Pi environments.
- Keep read-only status checks separate from mutating operations.

Dangerous operations require explicit user intent and a safe lab environment, for example:

- Firmware upload.
- System upgrade.
- Wi-Fi connect/disable/reconfigure.
- Package installation.
- Service restart on a real host.
- PHD2 service mutation.

## Hardware And Real-Session Safety Rules

The app may control or influence:

- Camera exposures.
- Mount movement, parking, unparking, tracking, slewing, and guiding.
- Autofocus, filter changes, rotator movement, flat panel brightness, dome state, sequence execution, TPPA, PHD2 service state, and safety/weather workflows.

Required rules:

- Default tests must not move real equipment, start real sequences, run long exposures, change Wi-Fi, install packages, restart services, upload firmware, or mutate a live session.
- Live smoke tests require simulator-backed N.I.N.A. or a dedicated lab PINS host, explicit user intent, and carefully gated commands.
- Prefer contract mocks for backend integration tests.
- Contract mocks and browser fixtures are not proof of real hardware correctness.
- UI must make dangerous operations explicit and understandable to field users.
- Never hide safety warnings or invalid equipment state messages for cleaner UI.

## Plugin System Rules

Touch-N-Stars supports dynamic plugins. Plugin routes may be generated or ordered dynamically.

Required rules:

- Do not assume `/plugin1`, `/plugin2`, or any ordinal route always means a specific plugin.
- Prefer stable plugin identity over route order.
- Use plugin metadata `id`, `data-plugin-id`, stable `data-testid`, ARIA roles, or semantic selectors for tests and UI hooks.
- Regenerate the plugin registry when plugin metadata or plugin entry points change.
- Avoid duplicate routes, stale routes, and duplicate nav items.
- Keep plugin-loading tests isolated with explicit fakes; production startup
  refreshes bundled metadata and initializes enabled plugins.
- Keep plugin-local state isolated unless a shared contract is explicitly required.

## UI, Mobile, And Accessibility Rules

Touch-N-Stars is used in the field on tablets and phones. UI changes must respect constrained screen sizes, touch input, low-light usage, and operational clarity.

Required rules:

- Preserve mobile-first layouts and touch-friendly controls.
- Keep operational controls dense, clear, and repeat-use friendly.
- Use accessible labels, roles, and stable selectors for important controls.
- Avoid relying on translated text as a primary test selector.
- Handle orientation changes and app background/foreground lifecycle where relevant.
- Preserve keep-awake behavior where relevant to imaging sessions.
- Do not regress dark/low-light operation or modal/dialog usability.
- For native behavior, consider Android and iOS Capacitor differences.

## i18n And Text Rules

All user-facing text must use the project’s i18n patterns.

Required rules:

- Do not hardcode user-facing strings in components.
- Add or update locale keys when UI text changes.
- At minimum, provide correct English entries and follow existing locale conventions.
- Keep translations concise because mobile space is limited.
- Use placeholders for dynamic values.
- Run i18n checks when translation files or keys change.
- Treat formatting-only translation changes separately from behavior changes when possible.

## Build, Generated Files, And Release Rules

Build and release behavior is part of the product surface.

Required rules:

- The plugin registry is generated; do not hand-edit generated output without understanding the generator.
- `public/whats-new.json` is generated from `CHANGELOG.md`; update changelog for notable changes when appropriate.
- Preserve Capacitor Android/iOS packaging behavior.
- Preserve OTA update flow and explicit user confirmation behavior.
- Do not add hidden network/cloud dependencies.
- Do not commit secrets, signing material, local machine paths, or app-store credentials.
- Be careful with scripts that auto-fix or regenerate files; review all resulting diffs.

## Testing And Evaluation Strategy

Use a three-layer testing model.

### 1. UI Mock Tests

Use for:

- App shell and navigation chrome.
- Responsive layout.
- Static rendering.
- Theme behavior.
- Translations.
- Offline/demo behavior.

Do not use UI mock tests as proof of:

- Real N.I.N.A. behavior.
- PINS plugin behavior.
- Advanced API behavior.
- WebSocket behavior.
- SignalR behavior.
- pinsdaemon behavior.
- Real connection lifecycle.

### 2. Contract Mock Tests

Use for:

- Backend handshake.
- Dynamic Advanced API port handling.
- REST response envelopes.
- WebSocket events.
- SignalR messages.
- PINS mode detection.
- pinsdaemon responses.
- Error states.
- Reconnect behavior.
- Plugin loading and identity.

Contract mocks should model the real communication shape without touching real hardware.

### 3. Live Smoke Tests

Use only for:

- Simulator-backed N.I.N.A.
- Dedicated lab PINS hosts.
- Safe read-only endpoints.
- Carefully gated manual workflows.

Never run live smoke tests against real production equipment in default PR CI.

## Suggested Validation

Choose commands relevant to the task:

```bash
git status --short
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run test:coverage
npm run format:check
npm run i18n:check
npm run build
npm run preview:smoke
```

The full Vue typecheck can exceed Node's default heap. Set
`NODE_OPTIONS=--max-old-space-size=6144` first (PowerShell:
`$env:NODE_OPTIONS='--max-old-space-size=6144'`) when validating the complete
application graph.

When native/mobile behavior is relevant:

```bash
npm run build:native
npm run sync:native
```

When plugin behavior or generated files are relevant:

```bash
npm run generate-plugins
npm run generate-whats-new
npm run build
```

When release/test deployment behavior is relevant on Windows/N.I.N.A. plugin paths:

```bash
npm run testbuild
```

`testbuild` deliberately skips the source-scoped lint gate so a local N.I.N.A.
deployment remains fast and deterministic. It
uses the normal `build:app` generators, deploys to the fixed plugin `app`
directory, and then verifies the Celestia view/engine chunks, the complete DSS
orders 3 and 4 including the order-3 Allsky preview, and removal of legacy
Stellarium data. Run the cached `npm run lint` separately before committing; CI
continues to enforce linting.

When using scripts that can auto-modify files, re-run:

```bash
git diff --stat
git diff
```

## Review Checklist

Every reviewer must specifically check:

- Did this preserve real-session safety?
- Did this preserve N.I.N.A. Advanced API and Touch-N-Stars plugin server contracts?
- Did this preserve connection handshake, dynamic port handling, polling, WebSocket, and SignalR behavior?
- Does every new/changed poller pause on app background and resume on foreground (via `usePolling`, `useBackgroundAwarePolling`, or `createPoller` with an explicit `App.vue` pause/resume hook), unless it is a heartbeat or safety watchdog?
- Did this preserve standard N.I.N.A., PINS/headless, and mock-mode semantics as relevant?
- Did this avoid real hardware or system mutation in default tests?
- Did this preserve mobile-first UX and Capacitor Android/iOS behavior?
- Did this preserve plugin identity/routing behavior?
- Did this add/update i18n entries for user-facing text?
- Did this avoid hardcoded secrets, tokens, hostnames, or local machine paths?
- Did this preserve unrelated user/team changes?
- Did this keep layers separated?
- Did docs/changelog/project state change when behavior changed?
- Were relevant validation commands run, and are failures explained?

## Final Response Format

Use this structure for implementation tasks:

```text
Task completed: <short summary>

Planner:
- <what was planned, operating mode, affected layers/runtime modes, non-goals>

Engineer:
- <technical approach and contracts>

Developer:
- <what was implemented>

Reviewer:
- <pass/pass with notes/needs changes and review result>

Changed files:
- <file list>

Validation:
- <commands run and results>

Notes:
- <limitations, assumptions, Context7 status, live-hardware caveats, unrelated local changes, or follow-up work>
```

For very small fixes, this can be concise, but it should still report changed files and validation.
