import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import appVersion from '@/version';
import { useSettingsStore } from '@/store/settingsStore';

let SUPPORTED_PLATFORMS = new Set(['android', 'ios']);
let UPDATE_ASSET_NAME = 'dist.zip';

const UPSTREAM_REPO = 'Touch-N-Stars/Touch-N-Stars';
const DEV_REPO = 'JohannesWorks/Touch-N-Stars';

function getGithubApiBase(channel = getPreferredUpdateChannel()) {
  const repo = channel === 'dev' ? DEV_REPO : UPSTREAM_REPO;
  return `https://api.github.com/repos/${repo}`;
}

export function getPreferredUpdateChannel() {
  try {
    const settingsStore = useSettingsStore();
    if (settingsStore?.devChannelUnlocked && settingsStore?.useDevUpdateChannel) {
      return 'dev';
    }
    return settingsStore?.useBetaFeatures ? 'beta' : 'stable';
  } catch (error) {
    // Store not initialized yet, use stable channel by default
    return 'stable';
  }
}

const defaultHeaders = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'touch-n-stars-updater',
};

function buildHeaders(acceptType, options = {}) {
  const { includeUserAgent = true } = options;
  const headers = { ...defaultHeaders };
  if (!includeUserAgent) {
    delete headers['User-Agent'];
  }
  if (acceptType) {
    headers.Accept = acceptType;
  }
  return headers;
}

function getPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch (error) {
    console.warn('[Updater] Failed to resolve platform:', error);
    return 'web';
  }
}

export function isNativePlatform() {
  return SUPPORTED_PLATFORMS.has(getPlatform());
}

export async function syncNativeUpdateChannel(channel, options = {}) {
  if (!isNativePlatform()) {
    return { skipped: true, reason: 'non-native-platform' };
  }

  const triggerAutoUpdate = options.triggerAutoUpdate === true;

  try {
    if (channel !== 'stable') {
      // The dev channel maps onto the native beta channel; release selection happens in
      // fetchLatestRelease() against the dev repository.
      const result = await CapacitorUpdater.setChannel({
        channel: 'beta',
        triggerAutoUpdate,
      });
      console.info(
        `[Updater] Native update channel set to beta (app channel: ${channel}):`,
        result
      );
      return { channel, result };
    }

    await CapacitorUpdater.unsetChannel({ triggerAutoUpdate });
    console.info('[Updater] Native update channel reset to default stable channel');
    return { channel: 'stable' };
  } catch (error) {
    console.warn('[Updater] Failed to sync native update channel:', error);
    return { channel, error };
  }
}

function parseVersion(version) {
  if (!version) {
    return { major: 0, minor: 0, patch: 0, prerelease: [], prereleaseParts: [] };
  }

  const trimmed = version.trim();
  const withoutPrefix = trimmed.replace(/^v/gi, '');

  const [corePart, ...prereleaseParts] = withoutPrefix.split(/[-+]/);
  const match = corePart.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);

  if (!match) {
    return { major: 0, minor: 0, patch: 0, prerelease: [], prereleaseParts: [] };
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10) || 0;
  const patch = Number.parseInt(match[3], 10) || 0;

  const prereleasePart = prereleaseParts.join('-');
  const prerelease = prereleasePart ? prereleasePart.split('.') : [];

  return {
    major,
    minor,
    patch,
    prerelease,
    prereleaseParts,
  };
}

function normalizePrereleaseParts(parts = []) {
  return parts.filter((part) => part && part.toLowerCase() !== 'stable');
}

function normalizeVersionForComparison(version) {
  const parsed = parseVersion(version);
  const normalizedPrerelease = normalizePrereleaseParts(parsed.prerelease);
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${
    normalizedPrerelease.length > 0 ? `-${normalizedPrerelease.join('.')}` : ''
  }`;
}

function compareVersions(remote, local) {
  const remoteVersion = parseVersion(remote);
  const localVersion = parseVersion(local);

  if (remoteVersion.major !== localVersion.major) {
    return remoteVersion.major > localVersion.major ? 1 : -1;
  }
  if (remoteVersion.minor !== localVersion.minor) {
    return remoteVersion.minor > localVersion.minor ? 1 : -1;
  }
  if (remoteVersion.patch !== localVersion.patch) {
    return remoteVersion.patch > localVersion.patch ? 1 : -1;
  }

  const remoteHasPrerelease = remoteVersion.prerelease.length > 0;
  const localHasPrerelease = localVersion.prerelease.length > 0;

  if (remoteHasPrerelease && !localHasPrerelease) return -1;
  if (!remoteHasPrerelease && localHasPrerelease) return 1;

  if (remoteHasPrerelease && localHasPrerelease) {
    const maxLength = Math.max(remoteVersion.prerelease.length, localVersion.prerelease.length);
    for (let i = 0; i < maxLength; i++) {
      const remotePart = remoteVersion.prerelease[i] ?? '';
      const localPart = localVersion.prerelease[i] ?? '';

      const remoteNum = Number.parseInt(remotePart, 10);
      const localNum = Number.parseInt(localPart, 10);
      const remoteIsNum = !Number.isNaN(remoteNum);
      const localIsNum = !Number.isNaN(localNum);

      if (remoteIsNum && localIsNum) {
        if (remoteNum !== localNum) return remoteNum > localNum ? 1 : -1;
      } else if (remoteIsNum !== localIsNum) {
        return remoteIsNum ? -1 : 1;
      } else {
        if (remotePart !== localPart) return remotePart > localPart ? 1 : -1;
      }
    }
  }

  return 0;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: defaultHeaders });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${url} failed (${response.status}): ${text}`);
  }
  return response.json();
}

function mapReleaseToUpdateMetadata(release, channel = 'stable') {
  const assets = Array.isArray(release.assets) ? release.assets : [];

  console.info('[Updater] Release assets found:', assets.map((a) => a?.name).filter(Boolean));

  const updateAsset = assets.find((a) => a?.name === UPDATE_ASSET_NAME) || null;
  if (!updateAsset || !updateAsset.browser_download_url) {
    throw new Error(`Release ${release.tag_name} does not expose ${UPDATE_ASSET_NAME}`);
  }

  const changelogAsset = assets.find((a) => a?.name === 'CHANGELOG.md') || null;

  const versionString = release.tag_name || release.name;
  const normalizedVersion = normalizeVersionForComparison(versionString);

  if (!normalizedVersion || normalizedVersion === '0.0.0') {
    throw new Error(`Release ${release.tag_name} has an unparseable version`);
  }

  return {
    channel,
    tagName: release.tag_name,
    version: normalizedVersion,
    name: release.name || release.tag_name,
    notes: release.body || '',
    assetUrl: updateAsset.browser_download_url,
    changelogUrl: changelogAsset ? changelogAsset.browser_download_url : null,
    publishedAt: release.published_at,
    isPrerelease: release.prerelease,
  };
}

async function fetchLatestRelease() {
  const channel = getPreferredUpdateChannel();
  // The dev repository publishes with the unmodified beta workflow, so it uses the beta tag rules.
  const useBetaTagRules = channel === 'beta' || channel === 'dev';

  try {
    const releases = await fetchJson(`${getGithubApiBase(channel)}/releases?per_page=30`);
    const channelReleases = (Array.isArray(releases) ? releases : []).filter((release) => {
      if (!release || release.draft) return false;

      const tagName = String(release.tag_name || '').toLowerCase();
      if (useBetaTagRules) {
        return Boolean(release.prerelease) && tagName.endsWith('-beta');
      }

      return !release.prerelease && tagName.endsWith('-stable');
    });

    if (channelReleases.length === 0) {
      console.warn(`[Updater] No ${channel} releases found`);
      return null;
    }

    for (const release of channelReleases) {
      try {
        const mapped = mapReleaseToUpdateMetadata(release, channel);
        console.info(`[Updater] Using ${channel} release:`, mapped.tagName);
        return mapped;
      } catch (error) {
        console.warn('[Updater] Skipping release candidate:', release?.tag_name, error?.message);
      }
    }

    return null;
  } catch (error) {
    console.warn('[Updater] Failed to resolve latest release:', error);
    return null;
  }
}

async function resolveCurrentVersion(fallbackVersion = appVersion) {
  if (!isNativePlatform()) {
    return fallbackVersion;
  }

  try {
    const current = await CapacitorUpdater.current();
    const currentBundleVersion = current?.bundle?.version;
    const nativeVersion = current?.native;

    // "builtin" means no OTA bundle is active yet, so use native/app version.
    if (currentBundleVersion && currentBundleVersion !== 'builtin') {
      return currentBundleVersion;
    }

    if (nativeVersion) {
      return nativeVersion;
    }
  } catch (error) {
    console.warn('[Updater] Failed to resolve current bundle version:', error);
  }

  return fallbackVersion;
}

export async function checkForManualUpdate(currentVersion = appVersion, options = {}) {
  const { allowDowngrade = false } = options;

  console.log('[Updater] checkForManualUpdate called - version:', currentVersion);

  if (!isNativePlatform()) {
    return { available: false, reason: 'non-native-platform' };
  }

  const latestRelease = await fetchLatestRelease();
  if (!latestRelease) {
    return { available: false, reason: 'no-release' };
  }

  const effectiveCurrentVersion = await resolveCurrentVersion(currentVersion);
  console.log('[Updater] Effective current version:', effectiveCurrentVersion);

  const normalizedCurrentVersion = normalizeVersionForComparison(effectiveCurrentVersion);
  console.log('[Updater] Normalized current version:', normalizedCurrentVersion);

  const versionComparison = compareVersions(latestRelease.version, normalizedCurrentVersion);
  console.log('[Updater] Version comparison:', versionComparison);

  if (!allowDowngrade && versionComparison <= 0) {
    return { available: false, reason: 'no-newer-version' };
  }

  return {
    available: true,
    ...latestRelease,
    currentVersion: normalizedCurrentVersion,
    isDowngrade: versionComparison < 0,
    // Only reachable with allowDowngrade: the latest release is the version already installed.
    isCurrent: versionComparison === 0,
  };
}

export async function downloadAndApplyUpdate(options) {
  const { version, downloadUrl, onProgress, onPreparing } = options;

  if (!isNativePlatform()) {
    throw new Error('Updates are only supported on native platforms');
  }
  if (!version || !downloadUrl) {
    throw new Error('Missing download metadata');
  }

  let listener;
  try {
    listener = await CapacitorUpdater.addListener('download', (event) => {
      if (event?.bundle?.version !== version) return;
      if (typeof onProgress === 'function') {
        onProgress(event.percent ?? 0);
      }
    });
  } catch (error) {
    console.warn('[Updater] Failed to attach download listener:', error);
  }

  try {
    const bundle = await CapacitorUpdater.download({ version, url: downloadUrl });

    if (!bundle?.id) throw new Error('Download completed without a valid bundle identifier');

    if (typeof onPreparing === 'function') onPreparing();

    await CapacitorUpdater.set({ id: bundle.id });
    return bundle;
  } finally {
    if (listener?.remove) {
      try {
        await listener.remove();
      } catch (removeError) {
        console.warn('[Updater] Failed to remove download listener:', removeError);
      }
    }
  }
}

export async function markAppReady() {
  if (!isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (error) {
    console.warn('[Updater] notifyAppReady failed:', error);
  }
}

function extractLatestChangelogSection(markdown) {
  if (!markdown) return null;

  const lines = markdown.split(/\r?\n/);
  let startIdx = lines.findIndex((line) => line.startsWith('## ['));
  if (startIdx === -1) return null;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## [')) {
      endIdx = i;
      break;
    }
  }

  const sectionLines = lines.slice(startIdx, endIdx);
  const heading = sectionLines[0]?.trim() ?? '';
  const match = heading.match(/^## \[(.+?)\]\s*-\s*(.+)$/);
  const version = match ? match[1].trim() : 'unknown';
  const date = match ? match[2].trim() : '';

  const bodyLines = sectionLines.slice(1).filter((line) => line.trim());

  return {
    version,
    date,
    heading,
    bodyLines,
    markdown: [heading, '', ...bodyLines].join('\n'),
  };
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function changelogLinesToHtml(lines, heading) {
  const parts = [];

  if (heading) {
    const titleText = heading.replace(/^##\s*/, '');
    parts.push(`<h2 class="text-xl sm:text-2xl font-bold mb-3">${escapeHtml(titleText)}</h2>`);
  }

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith('### ')) {
      parts.push(
        `<h3 class="text-lg sm:text-xl font-semibold mt-4 mb-2">${escapeHtml(line.slice(4))}</h3>`
      );
      index++;
      continue;
    }

    if (line.startsWith('- ')) {
      const items = [];
      while (index < lines.length && lines[index].startsWith('- ')) {
        items.push(lines[index].slice(2));
        index++;
      }
      parts.push(
        `<ul class="pl-5 space-y-1">${items
          .map(
            (item) =>
              `<li class="ml-4 list-disc"><span class="align-middle">${escapeHtml(
                item
              )}</span></li>`
          )
          .join('')}</ul>`
      );
      continue;
    }

    parts.push(`<p class="mb-2">${escapeHtml(line)}</p>`);
    index++;
  }

  return parts.join('\n');
}

export async function fetchChangelogWhatsNew(latestRelease = null) {
  try {
    console.info('[Updater] Fetching latest changelog');

    // Use provided release info or fetch it if not provided
    const release = latestRelease || (await fetchLatestRelease());
    console.log('[Updater] Latest release for changelog:', release);

    if (!release?.changelogUrl) {
      console.warn('[Updater] No changelog asset found in release');
      return null;
    }

    // Fetch from GitHub API at the specific release tag to avoid CORS issues
    const apiUrl = `${getGithubApiBase(release.channel)}/contents/CHANGELOG.md?ref=${
      release.tagName
    }`;
    console.log('[Updater] Fetching changelog from API:', apiUrl);

    const response = await fetch(apiUrl, {
      headers: buildHeaders('application/vnd.github.raw'),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    console.log('[Updater] Changelog fetched successfully');
    const markdown = await response.text();
    const section = extractLatestChangelogSection(markdown);
    if (!section) {
      throw new Error('Changelog has no valid section');
    }

    const html = changelogLinesToHtml(section.bodyLines, section.heading);
    const titleBase = `What's New in ${section.version}`;
    const title = section.date ? `${titleBase} (${section.date})` : titleBase;

    return {
      version: section.version,
      date: section.date,
      title,
      html,
      markdown: section.markdown,
    };
  } catch (error) {
    console.warn('[Updater] Failed to load changelog whats-new:', error?.message ?? error);
    return null;
  }
}
