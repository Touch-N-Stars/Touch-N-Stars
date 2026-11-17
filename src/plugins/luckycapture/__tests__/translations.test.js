import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createI18n } from 'vue-i18n';
import { hasDamagedLocaleText } from '../../../../scripts/lib/localeTextIntegrity.mjs';

const directory = new URL('../../../locales/', import.meta.url);
const read = (name, section = 'luckycapture') =>
  JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(new URL(name, directory)))
  )[section];
const expected = Object.keys(read('en.json')).sort();

for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.json'))) {
  test(`LuckyCapture text is intact and renders in ${file}`, () => {
    const messages = read(file);
    assert.deepEqual(Object.keys(messages).sort(), expected);
    const locale = file.slice(0, -5);
    const i18n = createI18n({
      legacy: false,
      locale,
      messages: { [locale]: { luckycapture: messages } },
    });
    for (const [key, value] of Object.entries(messages)) {
      assert.equal(typeof value, 'string', `${file}: ${key}`);
      assert.ok(value.trim(), `${file}: ${key} is empty`);
      assert.equal(hasDamagedLocaleText(value), false, `${file}: ${key} has encoding damage`);
      assert.equal(
        i18n.global.t(
          `luckycapture.${key}`,
          Object.fromEntries([...value.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], match[0]]))
        ),
        value,
        `${file}: ${key} does not render verbatim`
      );
      if (key.startsWith('state') || ['finishing', 'reconnecting'].includes(key))
        assert.ok(!value.includes('?'), `${file}: ${key} has damaged status punctuation`);
    }
    assert.doesNotMatch(messages.invalidRoi, /\d\s+\?\s+\d/);
  });
}

for (const file of fs.readdirSync(directory).filter((name) => name.endsWith('.json'))) {
  test(`Focus and simulator text is intact and renders in ${file}`, () => {
    const messages = read(file, 'luckycaptureFocus');
    assert.deepEqual(
      Object.keys(messages).sort(),
      Object.keys(read('en.json', 'luckycaptureFocus')).sort()
    );
    const locale = file.slice(0, -5);
    const i18n = createI18n({
      legacy: false,
      locale,
      messages: { [locale]: { luckycaptureFocus: messages } },
    });
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(value.trim(), `${file}: ${key} is empty`);
      assert.equal(hasDamagedLocaleText(value), false, `${file}: ${key} has encoding damage`);
      assert.equal(
        i18n.global.t(
          `luckycaptureFocus.${key}`,
          Object.fromEntries([...value.matchAll(/\{(\w+)\}/g)].map((match) => [match[1], match[0]]))
        ),
        value,
        `${file}: ${key} does not render verbatim`
      );
    }
  });
}
