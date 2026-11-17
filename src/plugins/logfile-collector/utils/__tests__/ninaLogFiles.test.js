import test from 'node:test';
import assert from 'node:assert/strict';
import { addRecentNinaLogFiles } from '../ninaLogFiles.js';

const NINA_PATH = '/home/pi/.local/share/NINA/Logs';
const GUIDER_PATH = '/home/pi/.local/share/NINA/InternalGuider/Logs';

test('collects the newest ten files from each source into separate archive directories', async () => {
  const browsed = [];
  const fetched = [];
  const filesMap = new Map();
  await addRecentNinaLogFiles(
    {
      async browseFilesystem(path) {
        browsed.push(path);
        return {
          files: Array.from({ length: 12 }, (_, index) => ({
            name: `${index}.log`,
            path: `${path}/${index}.log`,
            lastModified: new Date(Date.UTC(2026, 9, index + 1)).toISOString(),
          })),
        };
      },
      async fetchFilesystemFileBuffer(path) {
        fetched.push(path);
        return new TextEncoder().encode(path);
      },
    },
    filesMap
  );
  assert.deepEqual(browsed, [NINA_PATH, GUIDER_PATH]);
  assert.equal(fetched.length, 20);
  assert.equal(filesMap.size, 20);
  for (const [directory, path] of [
    ['nina-logs', NINA_PATH],
    ['internal-guider-logs', GUIDER_PATH],
  ]) {
    assert.equal(filesMap.has(`${directory}/0.log`), false);
    assert.equal(filesMap.has(`${directory}/1.log`), false);
    assert.equal(new TextDecoder().decode(filesMap.get(`${directory}/11.log`)), `${path}/11.log`);
  }
});

test('a missing log directory does not prevent collection from the other source', async () => {
  for (const missingPath of [NINA_PATH, GUIDER_PATH]) {
    const filesMap = new Map();
    const warnings = [];
    await addRecentNinaLogFiles(
      {
        async browseFilesystem(path) {
          if (path === missingPath) throw new Error('Directory missing');
          return { files: [{ name: 'current.log', path: `${path}/current.log` }] };
        },
        async fetchFilesystemFileBuffer() {
          return 'log contents';
        },
      },
      filesMap,
      { warn: (...args) => warnings.push(args) }
    );
    const directory = missingPath === NINA_PATH ? 'internal-guider-logs' : 'nina-logs';
    assert.equal(filesMap.get(`${directory}/current.log`), 'log contents');
    assert.equal(filesMap.size, 1);
    assert.equal(warnings.length, 1);
  }
});

test('an unreadable file does not prevent collecting remaining InternalGuider logs', async () => {
  const filesMap = new Map();
  const warnings = [];
  await addRecentNinaLogFiles(
    {
      async browseFilesystem(path) {
        return path === NINA_PATH
          ? { files: [] }
          : {
              files: ['unreadable.log', 'current.log'].map((name) => ({
                name,
                path: `${path}/${name}`,
              })),
            };
      },
      async fetchFilesystemFileBuffer(path) {
        if (path.endsWith('/unreadable.log')) throw new Error('File removed');
        return 'guider contents';
      },
    },
    filesMap,
    { warn: (...args) => warnings.push(args) }
  );
  assert.equal(filesMap.get('internal-guider-logs/current.log'), 'guider contents');
  assert.equal(filesMap.size, 1);
  assert.equal(warnings.length, 1);
});
