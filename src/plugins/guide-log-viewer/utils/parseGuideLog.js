// Parser of PHD2-format guide logs (log version 2.x), as written by the PINS native guider
// (NINA.GuideEngine GuidingLog, a port of PHD2's) and by PHD2 itself. Pure, no Vue, so it can
// be unit tested with node --test.
//
// Times: the log has wall-clock times without a zone ("Guiding Begins at 2026-10-12 19:37:06")
// and per step the seconds since that start. All times here are seconds of that wall clock
// read as if it were UTC ("wall seconds"), so they show as the rig's local time with UTC
// formatting and need no time zone. wallFromUtcMs() maps real instants (incidents, images)
// onto that axis.

/** Step columns kept per frame (arrays of equal length in section.steps). */
export const STEP_COLUMNS = [
  't', // wall seconds
  'frame',
  'dx', // camera axes, px
  'dy',
  'ra', // RARawDistance, px
  'dec', // DECRawDistance, px
  'raGuide', // RAGuideDistance, px (the error the algorithm corrected)
  'decGuide',
  'raMs', // pulse duration, ms (0 = none)
  'decMs',
  'raDir', // 'E' | 'W' | ''
  'decDir', // 'N' | 'S' | ''
  'mass',
  'snr',
  'err', // star error code (0 = ok)
  'drop', // true for a DROP row (no usable star)
];

const DATE_RE = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

/** Wall seconds of "yyyy-MM-dd HH:mm:ss", null when it does not parse. */
export function parseWallTime(text) {
  const m = typeof text === 'string' ? text.match(DATE_RE) : null;
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return Number.isFinite(ms) ? ms / 1000 : null;
}

function num(text) {
  if (text === undefined || text === null) return NaN;
  const s = String(text).trim();
  if (s === '') return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

function firstNum(line, re) {
  const m = line.match(re);
  return m ? num(m[1]) : NaN;
}

/** Splits a CSV row; quotes only wrap whole fields in these logs. */
export function splitCsv(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function emptySteps() {
  const steps = {};
  for (const c of STEP_COLUMNS) steps[c] = [];
  return steps;
}

function newSection(kind, start, index) {
  return {
    kind, // 'guiding' | 'calibration'
    index,
    start,
    end: null,
    endReason: null, // 'stopped' | 'closed' | 'truncated' | 'complete' | 'failed'
    header: { lines: [] },
    columns: null,
    steps: emptySteps(),
    events: [],
    calibration: kind === 'calibration' ? { steps: [], results: [], dropped: 0 } : null,
  };
}

/**
 * Header lines of a guiding or calibration section (everything between "... Begins at" and the
 * column header) into a flat object; unknown lines are kept in `lines` only.
 */
export function parseHeaderLine(header, raw) {
  const line = raw.trim();
  if (!line) return;
  header.lines.push(line);
  let m;
  if ((m = line.match(/^Equipment Profile = (.*)$/))) header.profile = m[1].trim();
  else if (line.startsWith('Dither = ')) {
    header.ditherRaOnly = /Dither = RA only/.test(line);
    header.ditherScale = firstNum(line, /Dither scale = ([-\d.]+)/);
    m = line.match(/Image noise reduction = ([^,]+)/);
    if (m) header.noiseReduction = m[1].trim();
  } else if (line.startsWith('Pixel scale = ')) {
    header.pixelScale = firstNum(line, /Pixel scale = ([\d.]+) arc-sec\/px/);
    header.binning = firstNum(line, /Binning = (\d+)/);
    header.focalLength = firstNum(line, /Focal length = ([\d.]+) mm/);
  } else if (line.startsWith('Search region = ')) {
    header.searchRegion = firstNum(line, /Search region = (\d+)/);
    header.multiStar = /Multi-star mode/.test(line);
    header.starListSize = firstNum(line, /list size = (\d+)/);
  } else if (line.startsWith('Camera = ')) {
    m = line.match(/^Camera = ([^,]*)/);
    header.camera = m ? m[1].trim() : '';
    header.gain = firstNum(line, /gain = ([-\d.]+)/);
    header.pixelSize = firstNum(line, /pixel size = ([\d.]+) um/);
    header.hasDark = /have dark/.test(line);
  } else if (line.startsWith('Exposure = ')) {
    header.exposureMs = firstNum(line, /Exposure = (\d+) ms/);
  } else if (line.startsWith('Mount = ')) {
    m = line.match(/^Mount = ([^,]*)/);
    header.mount = m ? m[1].trim() : '';
    if (/xAngle/.test(line)) {
      header.calibrationInfo = {
        xAngle: firstNum(line, /xAngle = ([-\d.]+)/),
        xRate: firstNum(line, /xRate = ([-\d.]+)/), // px/s
        yAngle: firstNum(line, /yAngle = ([-\d.]+)/),
        yRate: firstNum(line, /yRate = ([-\d.]+)/),
      };
      m = line.match(/parity = (\w+)\/(\w+)/);
      if (m) header.parity = `${m[1]}/${m[2]}`;
    }
    header.notCalibrated = /not calibrated/.test(line);
    header.calibrationStepMs = firstNum(line, /Calibration Step = (\d+) ms/);
    header.calibrationDistancePx = firstNum(line, /Calibration Distance = (\d+) px/);
  } else if (line.startsWith('Norm rates')) {
    header.normRaRate = firstNum(line, /RA = ([\d.]+)"\/s @ dec 0/); // arcsec/s at dec 0
    header.normDecRate = firstNum(line, /Dec = ([\d.]+)"\/s/);
  } else if ((m = line.match(/^X guide algorithm = (.*)$/))) {
    header.xAlgorithm = m[1].trim();
    const teeth = firstNum(line, /Worm teeth = (\d+)/);
    if (Number.isFinite(teeth) && teeth > 0) header.wormTeeth = teeth;
  } else if ((m = line.match(/^Y guide algorithm = (.*)$/))) header.yAlgorithm = m[1].trim();
  else if (line.startsWith('Backlash comp = ')) {
    header.backlashEnabled = /Backlash comp = enabled/.test(line);
    header.backlashMs = firstNum(line, /pulse = (\d+) ms/);
  } else if (line.startsWith('Max RA duration = ')) {
    header.maxRaMs = firstNum(line, /Max RA duration = (\d+)/);
    header.maxDecMs = firstNum(line, /Max DEC duration = (\d+)/);
    m = line.match(/DEC guide mode = (\w+)/);
    if (m) header.decGuideMode = m[1];
  } else if (line.startsWith('RA Guide Speed = ')) {
    header.raGuideSpeed = firstNum(line, /RA Guide Speed = ([\d.]+) a-s\/s/);
    header.decGuideSpeed = firstNum(line, /Dec Guide Speed = ([\d.]+) a-s\/s/);
    header.calDec = firstNum(line, /Cal Dec = ([-\d.]+)/);
  } else if (/^RA = [\d.]+ hr/.test(line) || line.startsWith('RA/Dec = ')) {
    header.raHours = firstNum(line, /^RA = ([\d.]+) hr/);
    header.decDeg = firstNum(line, /Dec = ([-\d.]+) deg/);
    header.hourAngle = firstNum(line, /Hour angle = ([-\d.]+) hr/);
    m = line.match(/Pier side = (\w+)/);
    header.pierSide = m && m[1] !== 'Unknown' ? m[1] : null;
    header.altDeg = firstNum(line, /Alt = ([-\d.]+) deg/);
    header.azDeg = firstNum(line, /Az = ([-\d.]+) deg/);
  } else if (line.startsWith('Lock position = ')) {
    header.lockX = firstNum(line, /Lock position = ([-\d.]+),/);
    header.lockY = firstNum(line, /Lock position = [-\d.]+, ([-\d.]+)/);
    header.hfd = firstNum(line, /HFD = ([\d.]+) px/);
  }
}

/** One INFO line (without "INFO: ") into an event { type, ...fields, text }. */
export function parseInfo(text) {
  let m;
  if ((m = text.match(/^DITHER by ([-\d.]+), ([-\d.]+), new lock pos = ([-\d.]+), ([-\d.]+)/))) {
    return {
      type: 'dither',
      dx: num(m[1]),
      dy: num(m[2]),
      lockX: num(m[3]),
      lockY: num(m[4]),
      text,
    };
  }
  if ((m = text.match(/^SETTLING STATE CHANGE, Settling (started|complete|failed)/i))) {
    const state = m[1].toLowerCase();
    return {
      type:
        state === 'started' ? 'settleStart' : state === 'complete' ? 'settleDone' : 'settleFailed',
      text,
    };
  }
  if ((m = text.match(/^Server received ALERT (\d+) (\w+): (.*)$/))) {
    return { type: 'alert', code: num(m[1]), name: m[2], message: m[3].trim(), text };
  }
  if ((m = text.match(/^Server received (.*)$/)))
    return { type: 'command', command: m[1].trim(), text };
  if ((m = text.match(/^Guiding parameter change, (.*)$/))) {
    return { type: 'param', change: m[1].trim(), text };
  }
  if ((m = text.match(/^SET LOCK POSITION, new lock pos = ([-\d.]+), ([-\d.]+)/))) {
    return { type: 'lockPos', lockX: num(m[1]), lockY: num(m[2]), text };
  }
  if ((m = text.match(/^Manual guide \((\w+)\) (\w+) (\d+) ms/))) {
    return { type: 'manual', direction: m[2], ms: num(m[3]), text };
  }
  if (/meridian flip/i.test(text)) return { type: 'flip', text };
  if (/^STAR LOST during calibration/.test(text)) return { type: 'calDrop', text };
  if (/^(Predictive|Pulse model|Play model|Backlash)/i.test(text)) return { type: 'model', text };
  return { type: 'info', text };
}

function pushStep(steps, row) {
  for (const c of STEP_COLUMNS) steps[c].push(row[c]);
}

function stepCount(section) {
  return section.steps.t.length;
}

function lastStepTime(section) {
  const n = stepCount(section);
  return n ? section.steps.t[n - 1] : section.start;
}

/**
 * Parses a guide log into { version, app, sections, logs, warnings }. Sections are guiding and
 * calibration runs in file order; a log can hold several app starts ("Log enabled at").
 */
export function parseGuideLog(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const sections = [];
  const logs = []; // { enabled, closed }
  const warnings = [];
  let version = null;
  let app = null;
  let current = null;
  let inHeader = false;
  let lastCalibrationHeader = null;

  const close = (end, reason) => {
    if (!current) return;
    current.end = end ?? lastStepTime(current);
    if (!current.endReason) current.endReason = reason;
    current = null;
    inHeader = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    // Steps first: by far the most lines
    if (
      current &&
      !inHeader &&
      current.kind === 'guiding' &&
      line.charCodeAt(0) >= 48 &&
      line.charCodeAt(0) <= 57
    ) {
      const f = splitCsv(line);
      const frame = num(f[0]);
      const t = current.start + num(f[1]);
      if (!Number.isFinite(frame) || !Number.isFinite(t)) continue;
      const mount = (f[2] || '').trim();
      if (mount === 'DROP') {
        pushStep(current.steps, {
          t,
          frame,
          dx: NaN,
          dy: NaN,
          ra: NaN,
          dec: NaN,
          raGuide: NaN,
          decGuide: NaN,
          raMs: 0,
          decMs: 0,
          raDir: '',
          decDir: '',
          mass: num(f[15]),
          snr: num(f[16]),
          err: num(f[17]),
          drop: true,
        });
        continue;
      }
      if (mount !== 'Mount') continue; // AO rows of PHD2 are not shown
      const raMs = num(f[9]);
      const decMs = num(f[11]);
      pushStep(current.steps, {
        t,
        frame,
        dx: num(f[3]),
        dy: num(f[4]),
        ra: num(f[5]),
        dec: num(f[6]),
        raGuide: num(f[7]),
        decGuide: num(f[8]),
        raMs: Number.isFinite(raMs) ? raMs : 0,
        decMs: Number.isFinite(decMs) ? decMs : 0,
        raDir: (f[10] || '').trim(),
        decDir: (f[12] || '').trim(),
        mass: num(f[15]),
        snr: num(f[16]),
        err: Number.isFinite(num(f[17])) ? num(f[17]) : 0,
        drop: false,
      });
      continue;
    }

    let m;
    if ((m = line.match(/^PHD2 version (.*?)(?:, Log version ([\d.]+))?\. Log enabled at (.*)$/))) {
      close(null, 'truncated');
      app = m[1].trim();
      version = m[2] || version;
      logs.push({ enabled: parseWallTime(m[3]), closed: null });
      continue;
    }
    if ((m = line.match(/^(Log closed|Log disabled) at (.*)$/))) {
      const t = parseWallTime(m[2]);
      close(t, 'closed');
      if (logs.length) logs[logs.length - 1].closed = t;
      continue;
    }
    if ((m = line.match(/^Guiding Begins at (.*)$/))) {
      const start = parseWallTime(m[1]);
      close(start, 'truncated');
      if (start === null) {
        warnings.push({ line: i + 1, text: line });
        continue;
      }
      current = newSection('guiding', start, sections.length);
      sections.push(current);
      inHeader = true;
      continue;
    }
    if ((m = line.match(/^Calibration Begins at (.*)$/))) {
      const start = parseWallTime(m[1]);
      close(start, 'truncated');
      if (start === null) {
        warnings.push({ line: i + 1, text: line });
        continue;
      }
      current = newSection('calibration', start, sections.length);
      sections.push(current);
      lastCalibrationHeader = current.header;
      inHeader = true;
      continue;
    }
    if ((m = line.match(/^Guiding Ends at (.*)$/))) {
      if (current?.kind === 'guiding') close(parseWallTime(m[1]), 'stopped');
      continue;
    }
    if (!current) continue;

    if (inHeader) {
      if (line.startsWith('Frame,Time,mount')) {
        current.columns = line.split(',');
        inHeader = false;
        continue;
      }
      if (line.startsWith('Direction,Step,dx')) {
        inHeader = false;
        continue;
      }
      parseHeaderLine(current.header, raw);
      continue;
    }

    if (line.startsWith('INFO: ')) {
      const event = parseInfo(line.slice(6));
      event.t = lastStepTime(current);
      // index of the first step after the event in the section's steps
      event.index = stepCount(current);
      if (current.kind === 'calibration' && event.type === 'calDrop') current.calibration.dropped++;
      current.events.push(event);
      continue;
    }

    if (current.kind === 'calibration') {
      const cal = current.calibration;
      // West, East, Backlash, North, South, NudgeSouth, ... (PHD2 and the native guider)
      if ((m = line.match(/^([A-Za-z]+)\s*,\s*(-?\d+)\s*,(.*)$/))) {
        const f = m[3].split(',').map(num);
        cal.steps.push({
          direction: m[1],
          step: num(m[2]),
          dx: f[0],
          dy: f[1],
          x: f[2],
          y: f[3],
          dist: f[4],
        });
        continue;
      }
      if (
        (m = line.match(
          /^(\w+) calibration complete\. Angle = ([-\d.]+) deg, Rate = ([-\d.]+) px\/sec, Parity = (\S+)/
        ))
      ) {
        cal.results.push({
          axis: m[1],
          angle: num(m[2]),
          rate: num(m[3]),
          parity: m[4],
        });
        continue;
      }
      if (/^Calibration complete/.test(line)) {
        current.endReason = 'complete';
        close(lastStepTime(current), 'complete');
        continue;
      }
      if (/fail/i.test(line)) {
        current.endReason = 'failed';
        current.events.push({ type: 'calFailed', text: line, t: current.start });
        close(current.start, 'failed');
        continue;
      }
    }
  }
  close(null, 'truncated');

  // Header facts a guiding section lacks (PHD2 logs the calibration's in its own header)
  for (const s of sections) {
    if (s.kind === 'guiding' && !Number.isFinite(s.header.pixelScale) && lastCalibrationHeader) {
      s.header.pixelScale = lastCalibrationHeader.pixelScale;
    }
  }

  return { version, app, sections, logs, warnings };
}

/** Number of frames of a section (rows incl. drops). */
export function sectionFrames(section) {
  return section?.steps?.t?.length ?? 0;
}

/**
 * Offset in minutes of an IANA zone at a UTC instant, via Intl; null when the zone is unknown
 * to this browser (e.g. a Windows zone id).
 */
export function zoneOffsetMinutes(timeZone, utcMs) {
  if (!timeZone) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(new Date(utcMs));
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    const wall = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second')
    );
    if (!Number.isFinite(wall)) return null;
    return Math.round((wall - Math.floor(utcMs / 1000) * 1000) / 60000);
  } catch {
    return null;
  }
}

/**
 * Wall seconds (see the file comment) of a UTC instant in ms, for the log's zone: the IANA id
 * when the browser knows it, else the fixed offset, else the browser's own zone.
 */
export function wallFromUtcMs(utcMs, zone = {}) {
  if (!Number.isFinite(utcMs)) return null;
  let offset = zoneOffsetMinutes(zone.timeZone, utcMs);
  if (offset === null && Number.isFinite(zone.utcOffsetMinutes)) offset = zone.utcOffsetMinutes;
  if (offset === null) offset = -new Date(utcMs).getTimezoneOffset();
  return utcMs / 1000 + offset * 60;
}
