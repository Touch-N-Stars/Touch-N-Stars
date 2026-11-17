// npm records GitHub git dependencies in package-lock.json as git+ssh://git@github.com/...
// even when package.json asks for git+https. Machines without a GitHub SSH key (CI runners,
// contributors) then fail or hang on `npm ci`. Runs as postinstall and rewrites them back to
// HTTPS, so the lockfile that gets committed always matches package.json. Guarded by the
// celestia-atlas lockfile test (src/integrations/celestiaAtlas/__tests__/observed-frame.test.js).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SSH_PREFIX = '"git+ssh://git@github.com/';
const HTTPS_PREFIX = '"git+https://github.com/';

export function rewriteToHttps(text) {
  return text.split(SSH_PREFIX).join(HTTPS_PREFIX);
}

const lockfile = fileURLToPath(new URL('../package-lock.json', import.meta.url));

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && existsSync(lockfile)) {
  const text = readFileSync(lockfile, 'utf8');
  const fixed = rewriteToHttps(text);
  if (fixed !== text) {
    writeFileSync(lockfile, fixed);
    console.log('[lockfile] GitHub git dependencies rewritten from SSH to HTTPS');
  }
}
