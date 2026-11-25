// Installs the 3rd party package that brings an INDI driver, for the driver finders.
import apiPinsService from '@/services/apiPinsService';
import { findPackageAsset } from '@/utils/mountDriverCatalog';
import { buildIndiInstallPayload, parseIndiInstallJobId } from './indiInstallUtils';
import { pollJobUntilFinished } from './pinsJobPolling';

// The pinsdaemon answers 502 when it cannot reach the release server - in practice: PINS has
// no internet. The global axios interceptor turns errors into { Success: false } responses
// instead of throwing.
function isNoInternet(response) {
  return response?.Success === false && Number(response?.StatusCode) === 502;
}

/**
 * @param {{ packageName: string, type: string, label: string }} driver  type and label go into
 *   PINS' driver registry
 * @returns {Promise<'installed'|'noInternet'|'packageMissing'>} anything else throws
 */
export async function installIndiDriver({ packageName, type, label }) {
  const list = await apiPinsService.getPinsIndi3rdpartyPackages({
    onlyNotInstalled: false,
    q: packageName,
  });
  if (isNoInternet(list)) return 'noInternet';
  if (!Array.isArray(list?.packages)) {
    throw new Error(list?.Error || list?.detail || 'no package list');
  }
  const asset = findPackageAsset(packageName, list.packages);
  if (!asset) return 'packageMissing';

  // Already installed but not in the driver list (an older install without registry entry) -
  // installing again rewrites the registry entry, which is what is missing.
  const started = await apiPinsService.installPinsIndi3rdparty(
    buildIndiInstallPayload(asset, { type, label })
  );
  if (isNoInternet(started)) return 'noInternet';
  if (started?.Success === false) {
    throw new Error(started.detail || started.Error || 'install failed');
  }
  const jobId = parseIndiInstallJobId(started);
  if (jobId) {
    const result = await pollJobUntilFinished(jobId);
    if (!result.success) throw new Error(result.result?.status || 'install failed');
  }
  return 'installed';
}
