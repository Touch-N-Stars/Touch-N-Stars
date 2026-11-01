# Raw-data histogram and stretch

Status: in progress
Date: 2026-10-11

## Goal

The histogram shows the real ADU distribution of the captured frame, not of the preview JPEG,
and the stretch works on the 16-bit sensor data. Until now both ran on the JPEG that NINA had
already auto-stretched, scaled and compressed: the histogram was an 8-bit luminance histogram of
that picture, and the "stretch" an 8-bit levels LUT on it, which could not recover what NINA's
stretch or the JPEG had clipped and posterised visibly.

## Scope

- Runtime modes: NINA and PINS (same plugin server on both).
- Surfaces: camera page, image history modal, Livestack page, flat assistant (last image).
- Backend: Touch'N'Stars plugin server, new `RawImageController` / `RawImageService` /
  `RawImageEncoder`. No Advanced API change.
- Platforms: browser, Android, iOS. The stretch runs in a worker with `OffscreenCanvas`, on the
  main thread where that is missing (older iOS WebViews).

## Non-goals

- No raw histogram for TPPA and focus images in the image modal (no source; button hidden).
- Livestack colour combinations of separate mono filters: the plugin aligns them internally and
  saves only a stretched PNG, so there is no raw data. OSC colour stacks are supported.

## Design

```
plugin: IImageData ─► full-res histogram (65536 bins/channel) + stats ─┐
                    └► superpixel debayer (OSC) ─► box downsample ──────┴► binary container (gzip)
app:    parseRawImage ─► histogramStore (stats, cumulative histograms, levels)
                      └► rawImageWorker: 65536-entry LUT per channel ─► JPEG blob for the view
```

The histogram and statistics are computed from the full-resolution data; the downsampled planes
only feed the preview, because averaging narrows the noise distribution.

### Endpoints (plugin server, `/api`)

| Route                                                | Source                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET raw-image/prepared?maxDim=`                     | image NINA prepared last (`IImagingMediator.ImagePrepared`)                                                              |
| `GET raw-image/history?filename=&maxDim=`            | saved frame by file name (PINS fork history)                                                                             |
| `GET raw-image/history?index=&mean=&median=&maxDim=` | saved frame by history index, confirmed against mean/median (official Advanced API, which has no file name)              |
| `GET raw-image/livestack?target=&filter=&maxDim=`    | `<WorkingDirectory>/stacks/{target}-{filter}.fits` of the Livestack plugin; `RGB` = the three `R_OSC/G_OSC/B_OSC` stacks |

Errors are JSON `{ success: false, code, error }`. Codes: `no-image`, `file-not-found`,
`history-mismatch`, `invalid-filename`, `invalid-parameters`, `livestack-save-disabled`,
`livestack-rgb-unsupported`, `load-failed`, `internal-error`. A 404 without a code means the
plugin predates this feature (`unsupported` in the app).

### Container format (little-endian)

`uint32 headerLength` · UTF-8 JSON header · zero padding to 4 bytes · `uint32[65536]` histogram
per channel · `uint16[width*height]` preview plane per channel.

Header: `version` (1), `imageId`, `width`, `height` (preview), `sourceWidth`, `sourceHeight`,
`channels` (1 or 3), `bitDepth`, `isBayered`, `bayerPattern`, `stats[]` with `min`, `max`,
`mean`, `median`, `mad` (integer ADU, like NINA), `clipLow`, `clipHigh` (fractions).

### Older plugins (1.5.0.0 and before)

Without the raw-image route (`unsupported`), `histogramStore` decodes the JPEG the view shows and
`rawFromRgba` (`src/utils/rawImage/displayImage.js`) builds the same `{ meta, histograms, planes }`
as 8-bit data with `meta.displayImage = true`. Chart, statistics and stretch run unchanged. The
JPEG is already stretched and colour balanced by NINA, so it starts with linear levels and no
background offsets; the panel shows a hint to update the plugin. If decoding fails as well, the
old `unsupported` message stays.

### Stretch

Levels are normalised to the bit depth: black point, white point and the MTF midtone balance.
Auto is a port of NINA's `ImageUtility.GetStretchMap` (shadows at median − 2.8 · 1.4826 · MAD,
midtone so the median lands on 0.2). Linked colour neutralises the background first: each
channel is shifted by the distance of its median above the darkest channel (offset only, no
scaling), and one shared set of levels applies to the shifted data, so dragging moves all three
channels alike and the background stays grey. The chart draws the channels shifted the same way.
Unlinked uses one full auto stretch per channel. Until the user changes something the view keeps the original
image from the backend; the levels shown match it.

## Acceptance criteria

1. The histogram counts sum to the frame's pixel count (per channel, half resolution for OSC).
2. Median, MAD, min and max match NINA's statistics of the same frame.
3. Moving black, midtone or white point re-renders from 16-bit data without tonal banding;
   Auto brings back a view like NINA's.
4. Works for mono and OSC frames, on NINA and PINS, in browser, Android and iOS.
5. Livestack without "Save stacked lights" shows a clear hint; an older plugin falls back to the
   8-bit histogram and stretch of the preview JPEG with an update hint.

## Verification

- Plugin: `RawImageEncoderTests` (histogram, statistics, superpixel, downsampling, container).
- App: `src/utils/__tests__/rawImage.test.js` (parser, MTF/auto stretch, LUT, column binning,
  zoom range).
- Manual: PINS VM / Pi with a mono and an OSC camera, Livestack with and without saved stacks.
