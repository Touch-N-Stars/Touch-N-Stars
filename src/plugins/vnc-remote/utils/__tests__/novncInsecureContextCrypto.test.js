import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals } from '../../../../test-helpers/browserEnv.js';

installBrowserGlobals();

// noVNC reads window at import time, so load it after the globals exist.
const { PureAesEcbKey, installInsecureContextCrypto } =
  await import('../novncInsecureContextCrypto.js');

const hex = (s) => Uint8Array.from(s.match(/../g).map((b) => parseInt(b, 16)));
const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

test('AES-128-ECB matches the FIPS-197 test vector per block', async () => {
  const key = await PureAesEcbKey.importKey(hex('000102030405060708090a0b0c0d0e0f'));
  const block = '00112233445566778899aabbccddeeff';
  const out = await key.encrypt({ name: 'AES-ECB' }, hex(block + block));
  assert.equal(toHex(out), '69c4e0d86a7b0430d8cdb78070b4c55a'.repeat(2));
  assert.equal(key.algorithm.name, 'AES-ECB');
});

test('rejects partial blocks like noVNC does', async () => {
  const key = await PureAesEcbKey.importKey(new Uint8Array(16));
  assert.equal(await key.encrypt({ name: 'AES-ECB' }, new Uint8Array(5)), null);
});

test('replaces AES-ECB only without crypto.subtle', () => {
  const original = globalThis.window;
  try {
    const registry = { _algorithms: { 'AES-ECB': 'webcrypto', MD5: 'md5' } };
    globalThis.window = { crypto: { subtle: {} } };
    assert.equal(installInsecureContextCrypto(registry), false);
    assert.equal(registry._algorithms['AES-ECB'], 'webcrypto');

    globalThis.window = { crypto: {} };
    assert.equal(installInsecureContextCrypto(registry), true);
    assert.equal(registry._algorithms['AES-ECB'], PureAesEcbKey);
    assert.equal(registry._algorithms.MD5, 'md5');

    // CommonJS interop can hand over the exports object instead.
    const wrapped = { default: { default: { _algorithms: { 'AES-ECB': 'webcrypto' } } } };
    assert.equal(installInsecureContextCrypto(wrapped), true);
    assert.equal(wrapped.default.default._algorithms['AES-ECB'], PureAesEcbKey);
  } finally {
    globalThis.window = original;
  }
});
