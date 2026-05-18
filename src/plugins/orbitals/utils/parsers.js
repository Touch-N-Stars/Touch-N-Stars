// Parsers for MPC and JPL orbital element files.
// Data formats are public standards published by MPC and JPL.
// Column layout verified against the MPC published format spec.
import { ymdfToJD } from './orbital-mechanics.js';

// ── MPC CometEls.txt ──────────────────────────────────────────────────────────
// Fixed-width format (MPCAccessor.cs field layout):
//   0- 3  Periodic comet number (4)
//   4     Orbit type  P/C/D/A/X/I (1)
//   5-13  Provisional designation (9)
//  14-18  Year of perihelion (5)
//  19-21  Month (3)
//  22-29  Day of perihelion TT, fractional (8)
//  30-40  Perihelion distance q, AU (11)
//  41-50  Eccentricity e (10)
//  51-60  Argument of perihelion ω (10)
//  61-70  Longitude of ascending node Ω (10)
//  71-80  Inclination i (10)
//  81-88  Epoch yyyyMMdd (8)
//  89-90  (skip)
//  91-95  Absolute magnitude H (5)
//  96-99  Slope G (4)
// 100-158 Designation / name (59)
// 159+    Reference (trailing)

function mpcField(line, start, len) {
  return line.substring(start, start + len).trim();
}

export function parseMPCComets(text) {
  const results = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.length < 102) continue;

    const orbitType = mpcField(line, 4, 1);
    if (!orbitType || !'PCDAXI'.includes(orbitType)) continue;

    const yearStr = mpcField(line, 14, 5);
    const monthStr = mpcField(line, 19, 3);
    const dayStr = mpcField(line, 22, 8);
    const qStr = mpcField(line, 30, 11);
    const eStr = mpcField(line, 41, 10);
    const wStr = mpcField(line, 51, 10);
    const nodeStr = mpcField(line, 61, 10);
    const iStr = mpcField(line, 71, 10);
    const hStr = mpcField(line, 91, 5);
    const gStr = mpcField(line, 96, 4);
    const nameStr = mpcField(line, 100, 59);

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseFloat(dayStr);
    const q = parseFloat(qStr);
    const e = parseFloat(eStr);
    const w = parseFloat(wStr);
    const node = parseFloat(nodeStr);
    const i = parseFloat(iStr);

    if (
      !isFinite(year) ||
      !isFinite(month) ||
      !isFinite(day) ||
      !isFinite(q) ||
      !isFinite(e) ||
      !isFinite(w) ||
      !isFinite(node) ||
      !isFinite(i)
    )
      continue;

    const tp_jd = ymdfToJD(year, month, day);
    const H = parseFloat(hStr) || null;
    const G = parseFloat(gStr) || null;
    const name = nameStr || mpcField(line, 5, 9);

    results.push({ type: 'comet', source: 'MPC', orbitType, name, e, q, w, node, i, tp_jd, H, G });
  }
  return results;
}

// ── JPL ELEMENTS.COMET ────────────────────────────────────────────────────────
// Dynamic fixed-width: column widths are determined from the header separator line.
// Columns: Num, Name, Epoch(MJD), q, e, i, w, Node, Tp(JD), Ref
// Epoch is Modified Julian Day: JD = MJD + 2400000.5
// Tp is Julian Date directly.

export function parseJPLComets(text) {
  const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
  const sepIdx = lines.findIndex((l) => /^[-\s]+$/.test(l) && l.includes('-'));
  if (sepIdx < 1) return [];

  // Column widths from separator dashes groups
  const sepLine = lines[sepIdx];
  const widths = [];
  const colStarts = [];
  let inDash = false;
  let segStart = 0;
  for (let ci = 0; ci <= sepLine.length; ci++) {
    const ch = sepLine[ci] || ' ';
    if (ch === '-' && !inDash) {
      inDash = true;
      segStart = ci;
    }
    if (ch !== '-' && inDash) {
      inDash = false;
      widths.push(ci - segStart);
      colStarts.push(segStart);
    }
  }

  // Header line tells us column names
  const headerLine = lines[sepIdx - 1].toLowerCase();
  // Map column names by their start position
  function colName(startPos) {
    const slice = headerLine.substring(startPos).trimStart();
    return slice.split(/\s/)[0].replace(/[^a-z_]/g, '');
  }

  function jplField(line, colIdx) {
    if (colIdx >= colStarts.length) return '';
    const s = colStarts[colIdx];
    const w = widths[colIdx];
    return line.substring(s, s + w).trim();
  }

  // Find column index by scanning header for keyword.
  // Single-char keywords use exact match to avoid false positives ('e' in 'name', 'q' in 'epoch').
  function findCol(keyword) {
    for (let c = 0; c < colStarts.length; c++) {
      const cell = headerLine
        .substring(colStarts[c], colStarts[c] + widths[c])
        .trim()
        .toLowerCase();
      if (keyword.length === 1 ? cell === keyword : cell.includes(keyword))
        return c;
    }
    return -1;
  }

  const colNum = findCol('num');
  const colName_ = colNum >= 0 ? colNum + 1 : 0; // name follows num, or is first
  const colEpoch = findCol('epoch');
  const colQ = findCol('q');
  const colE = findCol('e');
  const colI = findCol('i');
  const colW = findCol('w');
  const colNode = findCol('node');
  const colTp = findCol('tp');

  if ([colQ, colE, colI, colW, colNode, colTp].some((c) => c < 0)) return [];

  const results = [];
  for (let li = sepIdx + 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || line.trim() === '') continue;

    const name = jplField(line, colName_);
    const epoch = parseFloat(jplField(line, colEpoch));
    const q = parseFloat(jplField(line, colQ));
    const e = parseFloat(jplField(line, colE));
    const i = parseFloat(jplField(line, colI));
    const w = parseFloat(jplField(line, colW));
    const node = parseFloat(jplField(line, colNode));
    const tp_jd = parseFloat(jplField(line, colTp));

    if ([q, e, i, w, node, tp_jd].some((v) => !isFinite(v))) continue;

    results.push({
      type: 'comet',
      source: 'JPL',
      orbitType: 'J',
      name,
      e,
      q,
      w,
      node,
      i,
      tp_jd,
      H: null,
      G: null,
    });
  }
  return results;
}

// ── JPL ELEMENTS.NUMBR / ELEMENTS.UNNUM ──────────────────────────────────────
// Same dynamic-width approach. Columns: [Num,] Name, Epoch(MJD), a, e, i, w, Node, M, H, G, Ref
// Epoch: MJD → JD = MJD + 2400000.5
// M is mean anomaly in degrees at epoch.

function parseJPLAsteroidLines(lines, hasNumber) {
  const sepIdx = lines.findIndex((l) => /^[-\s]+$/.test(l) && l.includes('-'));
  if (sepIdx < 1) return [];

  const sepLine = lines[sepIdx];
  const widths = [];
  const colStarts = [];
  let inDash = false,
    segStart = 0;
  for (let ci = 0; ci <= sepLine.length; ci++) {
    const ch = sepLine[ci] || ' ';
    if (ch === '-' && !inDash) {
      inDash = true;
      segStart = ci;
    }
    if (ch !== '-' && inDash) {
      inDash = false;
      widths.push(ci - segStart);
      colStarts.push(segStart);
    }
  }

  const headerLine = lines[sepIdx - 1].toLowerCase();

  function jplField(line, colIdx) {
    if (colIdx >= colStarts.length) return '';
    return line.substring(colStarts[colIdx], colStarts[colIdx] + widths[colIdx]).trim();
  }

  // Single-char keywords use exact match to avoid false positives ('a' in 'name', 'm' in 'num', 'h' in 'epoch').
  function findCol(keyword) {
    for (let c = 0; c < colStarts.length; c++) {
      const cell = headerLine
        .substring(colStarts[c], colStarts[c] + (widths[c] || 10))
        .trim()
        .toLowerCase();
      if (keyword.length === 1 ? cell === keyword : cell.includes(keyword))
        return c;
    }
    return -1;
  }

  const nameCol = hasNumber ? 1 : 0;
  const numCol  = 0; // only meaningful when hasNumber
  const colEpoch = findCol('epoch');
  const colA = findCol('a');
  const colE = findCol('e');
  const colI = findCol('i');
  const colW = findCol('w');
  const colNode = findCol('node');
  const colM = findCol('m');
  const colH = findCol('h');
  const colG = findCol('g');

  if ([colEpoch, colA, colE, colI, colW, colNode, colM].some((c) => c < 0)) return [];

  const results = [];
  for (let li = sepIdx + 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line || line.trim() === '') continue;

    const rawName = jplField(line, nameCol);
    const name = hasNumber ? `${jplField(line, numCol)} ${rawName}`.trim() : rawName;
    const epochMJD = parseFloat(jplField(line, colEpoch));
    const a = parseFloat(jplField(line, colA));
    const e = parseFloat(jplField(line, colE));
    const i = parseFloat(jplField(line, colI));
    const w = parseFloat(jplField(line, colW));
    const node = parseFloat(jplField(line, colNode));
    const M0_deg = parseFloat(jplField(line, colM));
    const H = parseFloat(jplField(line, colH)) || null;
    const G = parseFloat(jplField(line, colG)) || null;

    if ([a, e, i, w, node, M0_deg, epochMJD].some((v) => !isFinite(v))) continue;

    const epoch_jd = epochMJD + 2400000.5;

    results.push({
      type: 'asteroid',
      source: hasNumber ? 'JPL-num' : 'JPL-unnum',
      name,
      e,
      a,
      w,
      node,
      i,
      epoch_jd,
      M0_deg,
      H,
      G,
    });
  }
  return results;
}

export function parseJPLNumberedAsteroids(text) {
  return parseJPLAsteroidLines(
    text.split('\n').map((l) => l.replace(/\r$/, '')),
    true
  );
}

export function parseJPLUnnumberedAsteroids(text) {
  return parseJPLAsteroidLines(
    text.split('\n').map((l) => l.replace(/\r$/, '')),
    false
  );
}

// ── Gzip decompression (browser DecompressionStream API) ─────────────────────
export async function decompressGzip(arrayBuffer) {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(arrayBuffer));
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const merged = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    merged.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(merged);
}
