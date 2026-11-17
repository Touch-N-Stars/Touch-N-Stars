---
name: feature-kickoff
description: Turn a rough feature idea into a written goal and testable acceptance criteria before any code is written. Use when the user wants a new feature, says "ich möchte ein Feature", or hands over an idea that has no defined done-state yet.
---

# Feature kickoff

Interview first, criteria second, code never. This skill produces one file —
`docs/features/<slug>.md` — containing the goal and the acceptance criteria the
user agreed to, and — if the user confirms — the feature branch to work on.
Implementation is a separate request.

The point is to force the question *how will we know this is done?* before the
first line of code, in a codebase where "works on my machine" can mean "works in
NINA mode, on a phone, in German, with the mount already connected".

## Step 0 — do not skip to the answer

A one-line idea is not a spec. Do not start reading implementation files to
guess what the user wants, and do not propose a design. If the request is
actually a bug fix, a locale change or a one-liner, say so and stop — this skill
is overhead for those.

## Step 1 — ask about the goal

Ask in **one** round, not one question at a time. Use `AskUserQuestion` for
anything with enumerable options and free text for the rest.

Always establish:

1. **Outcome, not mechanism.** What can the user do afterwards that they cannot
   do today? If the answer describes a button, ask what the button is for.
2. **Trigger.** Which real session moment does this serve — setup, framing,
   running sequence, meridian flip, teardown, troubleshooting?
3. **Runtime modes.** NINA/WPF, PINS/headless, or both? Never assume both, and
   never assume one.
4. **Surface.** New view, existing view, plugin, settings, wizard step?
5. **Non-goals.** What must explicitly *not* change. Ask directly — this is the
   field users skip and reviewers need.

Do not ask what the code already answers. Check `src/views`, `src/store` and
`src/services/api/` first if the feature may already exist in part; a question
whose answer is in the repo wastes the user's turn.

## Step 2 — ground the criteria before writing them

Read enough to make the criteria concrete rather than generic. Typically:

- the store that owns the state (`src/store/`),
- the API surface it needs (`src/services/api/`, and whether the endpoint exists
  at all on the plugin server / Advanced API / pinsdaemon),
- the nearest existing screen to match.

If the feature needs a backend endpoint that does not exist yet, that is an
acceptance criterion of its own and a dependency on the plugin-server repo —
name it explicitly. Load the `api-endpoint` skill when that is the case.

## Step 3 — write criteria that can fail

Each criterion is one observable outcome, phrased so a reviewer can decide
pass/fail without asking the author. Format: **given** a state, **when** an
action, **then** an observable result.

Bad — cannot fail:

```text
1. The cooler UI is improved.
2. Errors are handled properly.
```

Good — can fail:

```text
1. Given a connected camera, when the target temperature is set to -10 °C,
   the cooling progress is visible within one poll cycle (2 s).
2. Given the backend restarts mid-cooldown, the view shows the disconnected
   state instead of the last known temperature.
3. In PINS mode the same flow works without `TempChangeRunning`, using the
   feature-detected fallback.
```

Aim for 4–8 criteria. More than that means the feature should be split, and
saying so is part of this skill's job.

## Step 4 — the dimensions that are always in scope

Walk this list explicitly and write a criterion for every one that applies. Say
in the file which ones were considered and ruled out — a ruled-out dimension is
information, an unmentioned one is an oversight.

| Dimension | The question to answer |
| --- | --- |
| Runtime modes | Does it work in NINA *and* PINS? Fields only one stack reports must be feature-detected on the payload, not branched on `store.isPINS` (`src/store/cameraStore.js:109`) |
| Polling | Any new state needs polling, not `/v2/socket` events. New pollers go through `createPoller` (`src/utils/poller.js:9`) and pause when backgrounded |
| Mobile | Narrow viewport, safe areas, orientation, 48 px touch targets (`min-h-touch`) |
| i18n | Every user-facing string gets an `en.json` key; the other 13 locales come in one batch before the commit |
| Equipment safety | Can this issue a command that moves hardware? Then it needs explicit user intent, not a default or a retry |
| Error paths | Backend restart, timeout, missing payload field, empty device list — what does the user see? |
| Native | Does Capacitor Android/iOS behave differently (permissions, filesystem, keep-awake, resume)? |
| Persistence | Does it survive an instance switch and `apiStore.clearAllStates()`? |
| Tests | Which logic is extractable into a testable util rather than living in the component? |

For domain-specific constraint blocks and validation commands, reuse the
matching variant in [docs/AGENT_TASK_TEMPLATE.md](../../../docs/AGENT_TASK_TEMPLATE.md)
instead of inventing new ones. Do not restate them here.

## Step 5 — confirm, then write the file

Present the goal and the numbered criteria in chat and get an explicit yes. Then
write `docs/features/<slug>.md`, slug in kebab-case from the feature name:

```markdown
# <Feature name>

Status: proposed
Date: <YYYY-MM-DD>

## Goal

<2–4 sentences. The user outcome, not the implementation.>

## Scope

- Runtime modes: <NINA | PINS | both>
- Surface: <view / plugin / settings / wizard>
- Backends touched: <plugin server /api | Advanced API /v2/api | pinsdaemon :8000 | none>

## Non-goals

- <what must not change>

## Acceptance criteria

1. <given / when / then>
2. …

## Dimensions considered

| Dimension | Applies | Note |
| --- | --- | --- |
| Runtime modes | yes/no | … |
| … | | |

## Open questions

- <unresolved, with who decides>
```

Keep `Open questions` — an honest open question is worth more than a criterion
invented to fill the section.

## Step 6 — offer a branch, never create one unasked

After the file is written, **ask** whether to create a feature branch. Do not
create one as a side effect of this skill, and do not create one before the
criteria are agreed — a branch named after a goal that then changes is worse
than no branch.

If the user says no, stay on the current branch and continue to Step 7.

If the user says yes:

```bash
git status --short              # must be clean apart from docs/features/<slug>.md
git fetch origin
git switch --no-track -c <branch> origin/develop
git push -u origin <branch>
git branch -vv | grep '^\*'     # must show [origin/<branch>], not [origin/develop]
```

Branch off **`origin/develop`**, not `master` and not whatever branch happens to
be checked out. `develop` is the integration branch; `master` is the release
branch.

The user's yes to the branch covers publishing it: the branch must show up on
GitHub right away, so push it in the same step. `--no-track` is mandatory —
without it git sets `origin/develop` as the upstream, and every later `git push`
(including VS Code's push/sync button) writes the feature commits straight into
`develop` while no branch of that name ever appears on GitHub. The final check
catches that; if it still shows `[origin/develop]`, fix it with
`git branch --set-upstream-to=origin/<branch>` before handing back.

Naming follows what the repo already uses — lowercase kebab-case describing the
change, matching the file slug so the two stay findable together:
`feat-nightsummary-for-NINA`, `phd2-interrupt-and-wait`, `flat-and-livestack`,
`fix-wifi`. Propose the name and let the user override it; do not invent a new
prefix scheme.

Two stop conditions:

- **Dirty working tree** with unrelated changes: do not switch, do not stash.
  Report what is uncommitted and let the user decide.
- **Branch already exists** (locally or on the remote): do not force, do not
  reuse silently. Say so and ask.

The criteria file is left uncommitted. Committing is the user's call — offer a
commit title, do not run `git commit`.

## Step 7 — stop there

Do not implement, do not plan file-by-file changes, do not commit. Say the file
is written and that implementation is the next, separate request.

Later, `tns-review` reviews the diff; the criteria file is what it gets reviewed
against. When the feature ships, update `Status:` to `done` and add the
CHANGELOG entry via the `changelog` skill.
