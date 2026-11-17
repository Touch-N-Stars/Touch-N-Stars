import fs from 'node:fs';
import path from 'node:path';
import { hasDamagedLocaleText } from './lib/localeTextIntegrity.mjs';

const LOCALES_DIR = path.resolve('src/locales');
const BASE_LOCALE = 'en.json';
const PLACEHOLDER_RE = /\{\s*([A-Za-z0-9_]+)\s*\}/g;
// Linked messages (@:{'general.backendName'} or @:some.key) count as placeholders too,
// so a translation cannot drop the reference or swap it for a hard-coded word.
const LINKED_RE = /@(?:\.\w+)?:(?:\{\s*'([^']+)'\s*\}|([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*))/g;
const PLURAL_SUFFIXES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

function parseJsonWithDuplicateCheck(filePath) {
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(filePath));
  const duplicates = [];
  let i = 0;

  function skipWs() {
    while (i < raw.length && /\s/.test(raw[i])) i += 1;
  }

  function parseString() {
    if (raw[i] !== '"') throw new Error('Expected string');
    i += 1;
    let out = '';

    while (i < raw.length) {
      const ch = raw[i];
      i += 1;

      if (ch === '"') return out;
      if (ch !== '\\') {
        out += ch;
        continue;
      }

      const esc = raw[i];
      i += 1;

      if (esc === 'u') {
        const hex = raw.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new Error('Invalid unicode escape');
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        const map = {
          '"': '"',
          '\\': '\\',
          '/': '/',
          b: '\b',
          f: '\f',
          n: '\n',
          r: '\r',
          t: '\t',
        };
        out += map[esc] ?? esc;
      }
    }

    throw new Error('Unterminated string');
  }

  function parseLiteral(lit, val) {
    if (raw.slice(i, i + lit.length) !== lit) throw new Error('Unexpected token');
    i += lit.length;
    return val;
  }

  function parseNumber() {
    const start = i;

    if (raw[i] === '-') i += 1;
    while (/\d/.test(raw[i])) i += 1;

    if (raw[i] === '.') {
      i += 1;
      while (/\d/.test(raw[i])) i += 1;
    }

    if (raw[i] === 'e' || raw[i] === 'E') {
      i += 1;
      if (raw[i] === '+' || raw[i] === '-') i += 1;
      while (/\d/.test(raw[i])) i += 1;
    }

    return Number(raw.slice(start, i));
  }

  function parseArray(pathStack) {
    const arr = [];
    i += 1;
    skipWs();

    if (raw[i] === ']') {
      i += 1;
      return arr;
    }

    while (true) {
      arr.push(parseValue(pathStack));
      skipWs();

      if (raw[i] === ']') {
        i += 1;
        return arr;
      }

      if (raw[i] !== ',') throw new Error('Expected comma in array');
      i += 1;
      skipWs();
    }
  }

  function parseObject(pathStack) {
    const obj = {};
    const seen = new Set();

    i += 1;
    skipWs();

    if (raw[i] === '}') {
      i += 1;
      return obj;
    }

    while (true) {
      const key = parseString();

      if (seen.has(key)) duplicates.push(pathStack.concat(key).join('.'));
      seen.add(key);

      skipWs();
      if (raw[i] !== ':') throw new Error('Expected colon');
      i += 1;
      skipWs();

      obj[key] = parseValue(pathStack.concat(key));

      skipWs();
      if (raw[i] === '}') {
        i += 1;
        return obj;
      }

      if (raw[i] !== ',') throw new Error('Expected comma in object');
      i += 1;
      skipWs();
    }
  }

  function parseValue(pathStack = []) {
    skipWs();
    const ch = raw[i];

    if (ch === '"') return parseString();
    if (ch === '{') return parseObject(pathStack);
    if (ch === '[') return parseArray(pathStack);
    if (ch === 't') return parseLiteral('true', true);
    if (ch === 'f') return parseLiteral('false', false);
    if (ch === 'n') return parseLiteral('null', null);
    if (ch === '-' || /\d/.test(ch)) return parseNumber();

    throw new Error('Unexpected value');
  }

  const data = parseValue([]);
  skipWs();
  if (i !== raw.length) throw new Error('Trailing content');

  return { data, duplicates };
}

function flatten(obj, prefix = '', out = {}) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, out);
      else out[p] = v;
    }
    return out;
  }

  out[prefix] = obj;
  return out;
}

function placeholders(value) {
  if (typeof value !== 'string') return [];
  const named = [...value.matchAll(PLACEHOLDER_RE)].map((m) => m[1]);
  const linked = [...value.matchAll(LINKED_RE)].map((m) => `@:${m[1] ?? m[2]}`);
  return [...new Set([...named, ...linked])].sort();
}

function pluralGroups(flatMap) {
  const out = new Map();

  for (const key of Object.keys(flatMap)) {
    const parts = key.split('.');
    const suffix = parts[parts.length - 1];

    if (!PLURAL_SUFFIXES.has(suffix) || parts.length < 2) continue;

    const group = parts.slice(0, -1).join('.');
    if (!out.has(group)) out.set(group, new Set());
    out.get(group).add(suffix);
  }

  return out;
}

function sameArray(a, b) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

if (!fs.existsSync(LOCALES_DIR)) {
  console.error(`Locales directory not found: ${LOCALES_DIR}`);
  process.exit(1);
}

const files = fs
  .readdirSync(LOCALES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (!files.includes(BASE_LOCALE)) {
  console.error(`Base locale missing: ${BASE_LOCALE}`);
  process.exit(1);
}

const localeMap = new Map();
let hasFailure = false;

for (const file of files) {
  const fullPath = path.join(LOCALES_DIR, file);

  try {
    const parsed = parseJsonWithDuplicateCheck(fullPath);
    localeMap.set(file, parsed);

    if (parsed.duplicates.length > 0) {
      hasFailure = true;
      console.error(`[${file}] duplicate keys:`);
      for (const duplicateKey of parsed.duplicates) {
        console.error(`  - ${duplicateKey}`);
      }
    }
  } catch (error) {
    hasFailure = true;
    console.error(`[${file}] invalid JSON: ${error.message}`);
  }
}

const baseFlat = flatten(localeMap.get(BASE_LOCALE).data);
const basePlural = pluralGroups(baseFlat);

for (const [file, parsed] of localeMap.entries()) {
  const flat = flatten(parsed.data);
  const damaged = Object.entries(flat)
    .filter(([, value]) => hasDamagedLocaleText(value))
    .map(([key]) => key);

  const missing = Object.keys(baseFlat).filter((k) => !(k in flat));
  const extra = Object.keys(flat).filter((k) => !(k in baseFlat));
  const empty = Object.entries(flat)
    .filter(([, v]) => typeof v === 'string' && v.trim() === '')
    .map(([k]) => k);

  const placeholderMismatch = [];
  for (const key of Object.keys(baseFlat)) {
    if (!(key in flat)) continue;
    const basePlaceholders = placeholders(baseFlat[key]);
    const localePlaceholders = placeholders(flat[key]);
    if (!sameArray(basePlaceholders, localePlaceholders)) {
      placeholderMismatch.push({
        key,
        base: basePlaceholders,
        locale: localePlaceholders,
      });
    }
  }

  const pluralMismatch = [];
  const localePlural = pluralGroups(flat);

  for (const [group, baseFormsSet] of basePlural.entries()) {
    const baseForms = [...baseFormsSet].sort();
    const localeForms = [...(localePlural.get(group) ?? new Set())].sort();

    if (!sameArray(baseForms, localeForms)) {
      pluralMismatch.push({ group, base: baseForms, locale: localeForms });
    }
  }

  if (
    missing.length > 0 ||
    extra.length > 0 ||
    empty.length > 0 ||
    damaged.length > 0 ||
    placeholderMismatch.length > 0 ||
    pluralMismatch.length > 0
  ) {
    hasFailure = true;
    console.error(`\n[${file}]`);

    if (missing.length > 0) {
      console.error(`  missing (${missing.length}): ${missing.slice(0, 25).join(', ')}`);
    }

    if (extra.length > 0) {
      console.error(`  extra (${extra.length}): ${extra.slice(0, 25).join(', ')}`);
    }

    if (empty.length > 0) {
      console.error(`  empty (${empty.length}): ${empty.slice(0, 25).join(', ')}`);
    }
    if (damaged.length > 0) {
      console.error(`  damaged text (${damaged.length}): ${damaged.slice(0, 25).join(', ')}`);
    }

    if (placeholderMismatch.length > 0) {
      console.error(`  placeholder mismatches (${placeholderMismatch.length})`);
      for (const mismatch of placeholderMismatch.slice(0, 15)) {
        console.error(
          `    - ${mismatch.key} | base=${mismatch.base.join('|')} locale=${mismatch.locale.join('|')}`
        );
      }
    }

    if (pluralMismatch.length > 0) {
      console.error(`  plural mismatches (${pluralMismatch.length})`);
      for (const mismatch of pluralMismatch.slice(0, 15)) {
        console.error(
          `    - ${mismatch.group} | base=${mismatch.base.join('|')} locale=${mismatch.locale.join('|')}`
        );
      }
    }
  }
}

if (hasFailure) {
  console.error('\nI18n validation failed.');
  process.exit(1);
}

console.log('I18n validation passed.');
