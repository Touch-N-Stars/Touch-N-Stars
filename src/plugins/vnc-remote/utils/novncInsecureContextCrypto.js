import { ecb } from '@noble/ciphers/aes.js';
import * as legacyCryptoModule from '@novnc/novnc/lib/crypto/crypto.js';

// noVNC's Apple Remote Desktop authentication (security type 30) does the
// Diffie-Hellman and MD5 steps in JavaScript but encrypts the credentials with
// window.crypto.subtle (AES-ECB). Browsers only expose crypto.subtle in a
// secure context, and Touch'N'Stars is usually opened over plain HTTP on the
// Pi's LAN address, so the login crashed with "reading 'importKey'".
//
// PINS' wayvnc needs this login since Raspberry Pi's wayvnc 0.10.2-1+rpt2,
// which disconnects every client that did not log in as the desktop user.
//
// This replaces only noVNC's own AES-ECB entry with a pure JavaScript
// implementation; nothing global is patched.
class PureAesEcbKey {
  constructor(key) {
    this._key = new Uint8Array(key);
  }

  get algorithm() {
    return { name: 'AES-ECB' };
  }

  static async importKey(key) {
    return new PureAesEcbKey(key);
  }

  async encrypt(_algorithm, plaintext) {
    const data = new Uint8Array(plaintext);
    // Same contract as noVNC's AESECBCipher: whole blocks only.
    if (data.length % 16 !== 0) return null;
    return ecb(this._key, { disablePadding: true }).encrypt(data);
  }
}

// noVNC's lib/ is CommonJS. Depending on the bundler's interop the default
// import is either the LegacyCrypto instance or the whole exports object.
function resolveNoVncCrypto(module) {
  let candidate = module;
  for (let depth = 0; candidate && depth < 3; depth += 1) {
    if (candidate._algorithms) return candidate;
    candidate = candidate.default;
  }
  return null;
}

export function needsInsecureContextCrypto() {
  return typeof window !== 'undefined' && !window.crypto?.subtle;
}

export function installInsecureContextCrypto(cryptoRegistry = legacyCryptoModule) {
  if (!needsInsecureContextCrypto()) return false;
  const algorithms = resolveNoVncCrypto(cryptoRegistry)?._algorithms;
  if (!algorithms) return false;
  algorithms['AES-ECB'] = PureAesEcbKey;
  return true;
}

export { PureAesEcbKey };
