# Hocus Focus simple setup

Status: implemented, pending review
Date: 2026-10-25

## Goal

Users without autofocus expertise get a working Hocus Focus (HF) autofocus. The focus page shows
the handful of settings that matter in plain language, a guided assistant walks from optics to a
test run to the optimizer, and after every run a short diagnosis says whether the curve was good
and offers the fix with one tap. Builds on
[hocus-focus-focus-page.md](hocus-focus-focus-page.md).

## Scope

- Runtime modes: PINS, gated like the focus-page tabs (`hocusFocusStore.available`).
- Surface: focus page — Settings tab (simple card, assistant entry), Focus tab (diagnosis card).
- Backends touched: none — NINA profile writes via the existing profile API, HF options via the
  existing plugin-server `/api/hocusfocus/*` routes.

## Non-goals

- No backend change. Whether HF is selected as NINA's _Star Detector_ / _Auto Focus_ can only
  be explained and detected after the fact, not set.
- Without HF, the focus page behaves exactly as today.
- No HF or NINA value changes without an explicit user action — suggestions are shown, never
  auto-applied.

## Acceptance criteria

1. Given HF is available, the Autofocus sub-tab of the Settings tab opens first and shows the
   assistant entry, the optics summary with image scale, and AF exposure, step size and points
   per side in place of NINA's own sweep fields, followed by the remaining NINA autofocus values
   and the HF storage card (save runs + folder). Pixel scale, noise level, focus range and use
   optimized settings live only in the star detection under Crop & Stars. Every value is editable in exactly
   one place; each change lands in the NINA profile or HF options within one poll cycle (2 s).
2. The pixel-scale suggestion is computed from focal length, pixel size and AF binning and
   offered as a button; it is applied only when the user taps it.
3. The assistant can be completed end to end; autofocus starts and focuser moves happen only on
   an explicit tap, never automatically or as a retry.
4. Given a finished HF run with a flat curve, the diagnosis proposes a larger step size with a
   concrete value; tapping "Apply" writes `FocuserSettings-AutoFocusStepSize`.
5. Given `last-run` reports `IsActiveAutoFocuser: false` (NINA's own engine is selected), the
   diagnosis says HF is not selected as autofocus, with instructions.
6. Given `last-run` lacks the fields the diagnosis needs, no diagnosis card and no error appear;
   given the backend restarts during the assistant, it shows the error and can be continued.
7. The evaluation logic lives in `src/utils/hocusFocusAdvisor.js` and is covered by unit tests
   with five run fixtures: good, flat, steep, not bracketed, too few stars.

## Heuristics (to tune on real runs)

| Rule                      | Starting threshold                                                          |
| ------------------------- | --------------------------------------------------------------------------- |
| Pixel scale preset        | > 3 "/px WideField, 1–3 Typical, < 1 LongFocalLength                        |
| Curve too flat            | flatter edge HFR / minimum HFR < 1.8 → step size × 1.5                      |
| Curve too steep           | ratio > 5 → step size × 0.7                                                 |
| Stars lost when defocused | `AcceptedStarCountMin` < 30 % of max → Focus Range WideRange                |
| Not bracketed             | minimum at the first/last point → offset steps + 2, rough focus first       |
| Too few stars             | `AcceptedStarCountMax` < 15 → exposure × 2, narrowband-specific text        |
| Bad fit                   | hyperbolic R² below the HF threshold → check exposure/stars; never lower R² |
| Worse after the run       | final HFR > 1.1 × initial → hint on backlash, no fix                        |

Target from the HF docs: about four points per side, outer stars about 3× as wide as in focus.
The thresholds live as named constants in `src/utils/hocusFocusAdvisor.js`.

Observed on the Pi 192.168.2.129 (Sky Simulator camera and focuser): with step size 50 and 75
the edge ratio stays at about 1.2, because the simulator's stars barely grow when defocused.
The simulator therefore verifies the flow (diagnosis → apply → new run → new diagnosis), not the
thresholds; those need runs on real optics.

## Dimensions considered

| Dimension        | Applies | Note                                                                                                                     |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runtime modes    | yes     | PINS + HF status route, see the focus-page feature                                                                       |
| Polling          | yes     | Simple card reads the existing 2 s profile polling; diagnosis reuses the `last-run` fetch the finish chart already makes |
| Mobile           | yes     | `NumberInputPicker` for every number, 48 px targets, no `w-full` button trap in flex rows                                |
| i18n             | yes     | New keys in `en.json` only; other 13 locales in one batch before the commit                                              |
| Equipment safety | yes     | Criterion 3                                                                                                              |
| Error paths      | yes     | Criterion 6                                                                                                              |
| Native           | no      | Directory picker is server-side; nothing Capacitor-specific                                                              |
| Persistence      | no      | Assistant state is local and not persisted; settings live in profile/HF                                                  |
| Tests            | yes     | Criterion 7                                                                                                              |

## Open questions

- The plugin server does not expose Hocus Focus' `ReverseInitialDirection`, so the assistant
  has no SCT/backlash question; adding it needs a backend change. (user)
- Thresholds need tuning on real optics (see above). (user)
- If PINS does not preselect HF as Star Detector / Auto Focus, a plugin-server endpoint for
  `PluggableBehaviorSettings` is the real fix — follow-up feature. (user)
