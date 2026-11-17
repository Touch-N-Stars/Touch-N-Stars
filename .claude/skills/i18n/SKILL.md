---
name: i18n
description: Add, rename, or remove user-facing strings in src/locales. Use whenever a change introduces or touches a translated string, when `npm run i18n:check` fails, or when English-only keys need to be mirrored into the other 13 locales.
---

# i18n keys in Touch'N'Stars

`src/locales/` holds 14 files. `en.json` is the base locale; the other 13
(`ca cn cz de es fr it ja ko nl pl pt uk`) must mirror it **exactly** — same key
set, same placeholders, same plural forms. `npm run i18n:check` gates this and
runs in `ci:verify`.

## Working order (do not shortcut)

1. **English first.** While implementing a feature, add the new keys to
   `src/locales/en.json` only. Leave the other 13 alone.
2. `npm run i18n:check` will now fail with `missing (N)` for all 13 locales.
   That is the expected mid-work state — not a regression to chase.
3. **Ask the user before generating translations.** Do not silently write the
   other 13 locales. Ask once, listing the keys, then generate them in one pass.
4. After mirroring: `npm run i18n:check` must pass, then `npm run format:check`.

Step 3 is a standing rule from the user: translations are produced deliberately,
in one batch, right before the commit — never scattered through the work.

## Key naming

Top-level namespaces in `en.json`:
`common general pages app whatsnew updates setup components plugins pinsDevices
dialogs loading observationPlaner nightsummary indi nav`

- UI component strings go under `components.<componentName>.<key>`.
- Plugin strings go under `plugins.<pluginId>.<key>` (see [src/plugins/plugins.md](../../../src/plugins/plugins.md)).
- Reuse `common.*` for generic words (OK, cancel, close) instead of adding a
  component-local duplicate.

## What check-i18n.mjs actually enforces

Per locale, against `en.json`:

| Rule | Failure text |
| --- | --- |
| Every base key present | `missing (N)` |
| No keys absent from base | `extra (N)` |
| No empty / whitespace-only values | `empty (N)` |
| Identical `{placeholder}` set per key | `placeholder mismatches` |
| Identical plural suffix set per group (`zero one two few many other`) | `plural mismatches` |
| No duplicate keys in the same object | `duplicate keys` |
| Valid JSON | `invalid JSON` |
| Valid UTF-8; no replacement characters, repeated `??`, question marks inside words or common mojibake | `invalid JSON` / `damaged text` |

Placeholders are compared as a **set of names**, so `{count}` must survive
translation verbatim — a translator writing `{Anzahl}` fails the check. Plural
groups are detected purely by the last path segment, so a legitimate key ending
in `.one` or `.other` will be treated as a plural form.

## Editing: by hand vs. helper scripts

For a block of related keys, edit the JSON files directly — one edit per file
beats 10 script invocations, and it keeps the keys grouped in the right object.

Helper scripts exist for one-off keys:

```bash
npm run locale:entry -- de components.foo.bar "Wert"   # one locale
npm run locale:entry:all -- components.foo.bar "Value" # all 14, same value
npm run locale:find-missing-keys                       # en vs. de only
```

**Trap:** both `locale:entry` scripts rewrite the file with
`JSON.stringify(obj, null, 2)` and **no trailing newline**, which fails
`format:check`. Always run `npm run format` (or `npx prettier --write
src/locales`) after using them. They also write LF into CRLF files; git
normalizes that, so the diff stays clean, but do not be surprised by the
`LF will be replaced by CRLF` warning.

`locale:find-missing-keys` only compares `en` against `de` — it is not a
substitute for `i18n:check`.

## Translation quality

- Use the terms from [docs/i18n-glossary.md](../../../docs/i18n-glossary.md) for the
  concepts it lists (side of pier, settle), in labels and in help texts alike.
- Keep strings short: they render on narrow mobile viewports next to 48 px
  touch targets. A German string ~30% longer than English will wrap or clip.
- Keep astronomy/N.I.N.A. domain terms untranslated where the community uses
  the English term (e.g. *Framing*, *Flat*, *Dither*, *Meridian Flip*).
- Match the register of the surrounding keys. `de.json` is mixed: newer areas
  (setup wizard, PINS, tooltips) use informal "du", older error dialogs still
  use "Sie". Prefer "du" for new strings, but stay consistent within one screen
  — read the neighbouring keys before writing.
- Never translate `{placeholder}` names or the `|` separators of plural forms.

## Removing / renaming keys

Remove the key from all 14 files in the same change, otherwise the 13 locales
fail with `extra (N)`. Grep for the key before deleting:

```bash
grep -rn "components.foo.bar" src --include=*.vue --include=*.js
```
