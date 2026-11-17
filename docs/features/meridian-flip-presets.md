# Meridian flip presets

Status: in progress
Date: 2026-10-24

## Goal

A beginner sets up the meridian flip by answering one question about the mount instead
of typing three minute values whose meaning nobody explains. The settings tab shows what
the values do on a timeline, turns on what NINA strongly recommends where the mount
supports it, and makes an inconsistent window impossible.

## Scope

- Runtime modes: both (NINA/WPF and PINS/headless — same `MeridianFlipSettings-*` profile
  keys, the same `MeridianFlipTrigger` reads them)
- Surface: Settings → Meridian flip tab (`src/components/mount/settings/MeridianFlipSettings.vue`)
- Backends touched: Advanced API `/v2/api/profile/change-value` only (existing)

## Non-goals

- NINA's flip logic itself does not change.
- All nine profile values stay reachable for experts.
- The per-instruction flip fields of the advanced sequence editor are not touched.
- Reporting a failed flip is a separate feature (needs testing on the VM first, the NINA
  docs say nothing about failure handling).

## Acceptance criteria

1. Given the tab is open, a question "How far can your mount track past the meridian?"
   offers _Barely_ (pause 2 / min 0 / max 2), _A few minutes_ (0 / 5 / 15),
   _A lot_ (0 / 10 / 30) and _Custom_. Picking a preset writes the three minute values
   and `Recenter = true` to the profile.
2. When the mount is connected, a preset also writes `UseSideOfPier`: `true` if the mount
   reports a pier side, `false` if it reports `pierUnknown`. With the mount disconnected
   the value is left alone.
3. The selection reflects the stored profile: values matching a preset show that preset,
   anything else shows _Custom_ — also after a restart or a change from another client.
4. A timeline shows the pause before the meridian, the meridian and the flip window. It
   follows the stored values; with min = max it states that NINA waits for that moment.
5. The individual minute fields sit under a collapsed "Advanced" section. Max can never
   be set below min: its picker is clamped to min, and raising min above max raises max
   along with it.
6. Settle time, recenter, side of pier, auto focus after flip and rotate image carry a
   one-sentence help taken from the NINA documentation.

## Dimensions considered

| Dimension        | Applies | Note                                                                             |
| ---------------- | ------- | -------------------------------------------------------------------------------- |
| Runtime modes    | yes     | profile keys identical in both; no `isPINS` branch                               |
| Polling          | yes     | values come from `profileInfo`, refreshed by the existing poll; nothing new      |
| Mobile           | yes     | preset cards stack on narrow screens, `min-h-touch` targets                      |
| i18n             | yes     | new keys in `en.json`; other locales in one batch before the commit              |
| Equipment safety | no      | profile writes only, nothing moves                                               |
| Error paths      | yes     | a failed profile write leaves the stored values, the selection follows them      |
| Native           | no      | no Capacitor API involved                                                        |
| Persistence      | yes     | lives in the NINA profile, so it survives instance switch and `clearAllStates()` |
| Tests            | yes     | preset matching and value derivation in `src/utils/meridianFlipPresets.js`       |

## Open questions

- Preset numbers are a first proposal; revisit after field feedback (maintainer).
