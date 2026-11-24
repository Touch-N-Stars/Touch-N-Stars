import test from 'node:test';
import assert from 'node:assert/strict';
import { sambaAddresses } from '../sambaShare.js';

test('sambaAddresses leads to the image folder inside the share', () => {
  assert.deepEqual(sambaAddresses('10.42.0.1', '/home/pi/Documents/N.I.N.A/'), {
    windows: '\\\\10.42.0.1\\Documents\\N.I.N.A',
    mac: 'smb://10.42.0.1/Documents/N.I.N.A',
    outside: false,
  });
});

test('sambaAddresses names the share and flags an image folder outside of it', () => {
  const result = sambaAddresses('10.42.0.1', '/media/usb/Astro');
  assert.equal(result.windows, '\\\\10.42.0.1\\Documents');
  assert.equal(result.outside, true);
  // A folder that only starts with the same letters is not inside
  assert.equal(sambaAddresses('h', '/home/pi/Documents2').outside, true);
});

test('sambaAddresses does not warn while the image folder is unknown', () => {
  assert.equal(sambaAddresses('h', undefined).outside, false);
  assert.equal(sambaAddresses('h', '/home/pi/Documents').windows, '\\\\h\\Documents');
});

test('sambaAddresses encodes a blank only in the URL form', () => {
  const result = sambaAddresses('h', '/home/pi/Documents/My Pictures');
  assert.equal(result.windows, '\\\\h\\Documents\\My Pictures');
  assert.equal(result.mac, 'smb://h/Documents/My%20Pictures');
});
