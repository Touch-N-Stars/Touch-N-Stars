import {
  parseMPCComets,
  parseJPLComets,
  parseJPLNumberedAsteroids,
  parseJPLUnnumberedAsteroids,
  decompressGzip,
} from './parsers.js';

self.onmessage = async ({ data: { source, buf } }) => {
  try {
    const isGz = source === 'JPL-num' || source === 'JPL-unnum';
    const text = isGz ? await decompressGzip(buf) : new TextDecoder().decode(buf);

    let parsed;
    if (source === 'MPC')          parsed = parseMPCComets(text);
    else if (source === 'JPL')     parsed = parseJPLComets(text);
    else if (source === 'JPL-num') parsed = parseJPLNumberedAsteroids(text);
    else                           parsed = parseJPLUnnumberedAsteroids(text);

    self.postMessage({ ok: true, source, parsed });
  } catch (err) {
    self.postMessage({ ok: false, error: err.message });
  }
};
