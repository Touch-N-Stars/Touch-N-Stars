// The view model of one night: a guide log parsed and analysed once, for every panel of the
// viewer. Pure, no Vue (the caller marks it raw: it holds large typed arrays).
import { parseGuideLog } from './parseGuideLog';
import {
  buildSeries,
  findFindings,
  median,
  rangeStats,
  rollingRms,
  sectionSummary,
} from './analyzeGuideLog';
import { nightSpan } from './logView';

/** Durations (s) of the settles that completed, from "Settling started" to "complete". */
export function settleDurations(log) {
  const out = [];
  for (const s of log.sections) {
    let start = null;
    for (const e of s.events) {
      if (e.type === 'settleStart') start = e.t;
      else if (e.type === 'settleDone' && start !== null) {
        out.push(e.t - start);
        start = null;
      }
    }
  }
  return out;
}

/**
 * Parses and analyses a guide log: { ...meta, log, series, rolling, typicalRms/Ra/Dec, findings,
 * span, nightStats, summaries, dithers, settleMedian, guidedSeconds, pixelScale }.
 */
export function analyzeNight(text, meta = {}) {
  const log = parseGuideLog(text);
  const series = buildSeries(log);
  const axes = {};
  const rolling = rollingRms(series, undefined, axes);
  const summaries = series.sectionRanges.map((r) =>
    sectionSummary(series, r, log.sections[r.section])
  );
  let dithers = 0;
  for (const s of log.sections) for (const e of s.events) if (e.type === 'dither') dithers++;
  return {
    ...meta,
    log,
    series,
    rolling,
    typicalRms: median(Array.from(rolling)),
    typicalRa: median(Array.from(axes.ra)),
    typicalDec: median(Array.from(axes.dec)),
    findings: findFindings(log, series, rolling),
    span: nightSpan(log),
    nightStats: rangeStats(series, 0, series.n, {}),
    summaries,
    dithers,
    settleMedian: median(settleDurations(log)),
    guidedSeconds: summaries.reduce((a, s) => a + Math.max(0, (s.end ?? s.start) - s.start), 0),
    // the night's arcsec per px for values that span sessions (first section that logs one)
    pixelScale: log.sections.find((s) => s.header.pixelScale > 0)?.header.pixelScale ?? NaN,
  };
}
