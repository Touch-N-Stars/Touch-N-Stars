# Atlas: NSNS narrowband survey as a second background

Status: implemented, device test on PINS VM/Pi pending
Date: 2026-10-03

## Goal

Besides the DSS colour survey, the user can download the Northern Sky Narrowband Survey
(NSNS DR0.2, false-colour product `ohs8`: [OIII] red, Hα green, [SII] blue, continuum
removed) for the Atlas and switch the Atlas background between DSS and NSNS. Emission
nebulae become visible in their real extent, which helps framing narrowband targets.
Download, storage and serving follow the DSS survey feature
([atlas-dss-survey-download.md](atlas-dss-survey-download.md)) on NINA and PINS alike.

## Background

- NSNS by Stefan Ziegenbalg, www.simg.de/nebulae3/dr0_2, citation DOI
  10.3847/2515-5172/adfec7. Licence **CC BY-NC-SA 4.0**. Touch'N'Stars is free (GPL-3) and
  the project does not redistribute any tile: the user's own plugin server downloads them
  on request. Attribution (author, licence, link) is shown in the download section and in
  the About section.
- HiPS `simg.de/P/NSNS/DR0_2/ohs8`: equatorial, 512 px RGBA PNG tiles, `hips_order = 6`,
  `moc_sky_fraction ≈ 0.65` (northern sky down to Dec −16°). Tiles outside the coverage
  do not exist (404). `Moc.fits` (MOC 2.0, NUNIQ int32) lists the coverage; computed tile
  counts per order 3–6 are 528 / 2016 / 8000 / 31872 and matched 40 of 40 sampled tiles
  (covered → 200, uncovered → 404).
- Sources measured 2026-10-03: master `https://www.simg.de/nebulae3/dr0_2/ohs8` ~0.3 s per
  tile; CDS mirror `https://alasky.cds.unistra.fr/simg.de/simg.de_P_NSNS_DR0_2_ohs8`
  10–20 s per tile (fallback only).
- Source PNGs are ~610 kB per tile (≈ 21 GB up to order 6). The plugin server therefore
  flattens them on black and stores JPEG q85. Means of 40 random tiles per order:
  68 / 78 / 92 / 81 kB for orders 3–6, i.e. base (3–4) ≈ 190 MB, +order 5 ≈ 0.9 GB,
  +order 6 ≈ 3.5 GB.
- The celestia-atlas engine renders one survey at a time (`viewer.setSkySurvey`).

## Scope

- Runtime modes: both (same plugin server on Windows/NINA and PINS)
- Surface: Atlas settings dialog (survey section), Atlas layer panel, About section
- Backends touched: plugin server `/api/atlas/survey/*` (new optional `survey` parameter)
  and a second static route `/celestia-atlas-data/surveys/nsns`

## Non-goals

- No blending of NSNS over DSS and no DSS fallback south of Dec −16° (needs an engine
  change in celestia_atlas).
- No other NSNS products (`hbr8`, `halpha8`, linear FITS data).
- The Perihelion framing-offset view keeps using DSS.
- The DSS behaviour, endpoints and stored files stay unchanged; an app that does not send
  `survey` keeps talking to DSS.

## Acceptance criteria

1. **Independent download.** Given a plugin server with this version, when the user opens
   the Atlas settings and selects NSNS, then status, size estimate per order (base 3–4, 5,
   6), free space, progress, cancel/resume and delete work exactly like for DSS, and the
   NSNS usage notice (author, CC BY-NC-SA 4.0, northern sky only) is shown.
2. **Coverage-aware.** Given the NSNS coverage, when a download runs, then only tiles
   inside the MOC are requested, tile totals and completeness are counted against the
   MOC, and an order is advertised in `properties` once every covered tile exists.
3. **Compact storage.** Tiles are stored as `.jpg` (PNG flattened on black, q85); no PNG
   remains on disk.
4. **One job at a time.** Given a running DSS download, when the user starts NSNS (or the
   other way round), then the start is refused with a readable reason.
5. **Switching.** Given an installed survey, when the user selects DSS or NSNS as the
   Atlas background, then the Atlas shows that survey without reload; the choice
   persists. With NSNS selected but not installed the background stays empty and the
   settings say why.
6. **Backwards compatible.** An older app against the new plugin still gets DSS for every
   survey endpoint; the new app against an older plugin shows the "update the plugin"
   hint for NSNS while DSS keeps working.
7. **Attribution.** The About section lists NSNS with author, licence, DOI and link.

## Dimensions considered

| Dimension | Applies | Note |
| --- | --- | --- |
| Runtime modes | yes | One plugin-server implementation for both, no `isPINS` branch |
| Polling | yes | Same `createPoller` status loop, now per survey |
| Mobile | yes | Survey selector and download block at 400 px width, 48 px touch targets |
| i18n | yes | New `en.json` keys; 13 locales in one batch before commit |
| Equipment safety | no | No hardware command involved |
| Error paths | yes | simg.de unreachable (CDS fallback), MOC download fails (job fails with reason), 404 inside the MOC (counted as failed tile), server restart mid-job |
| Native | yes | Tiles via `resolveCelestiaAtlasDataBaseUrl` from the host, never fetched by the phone |
| Persistence | yes | Survey choice in `settingsStore.celestiaAtlas.skySurveySource`; data on the host |
| Tests | yes | Server: MOC parser, coverage tile sets, PNG→JPEG conversion, survey parameter default. App: survey definitions, source factory, store per survey, settings default |

## Open questions

- Ask Stefan Ziegenbalg whether app-driven downloads of several GB from simg.de are fine
  (courtesy, not a licence requirement) — user.
- Whether the Perihelion framing-offset view should follow the selected survey — user.
