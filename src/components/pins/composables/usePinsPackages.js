import { ref, watch } from 'vue';
import apiPinsService from '@/services/apiPinsService';
import { apiStore } from '@/store/store';
import { parseJobIdFromResponse, pollJobUntilFinished } from './pinsJobPolling';

// Packages kept out of the list: the app itself depends on ninaapi, touch-n-stars, pins and
// joko (Hocus Focus, used by the focus page), so none of them may be uninstalled by accident;
// orbitals is not offered to users.
const HIDDEN_NINA_PACKAGES = new Set([
  'pins-plugin-ninaapi',
  'pins-plugin-touch-n-stars',
  'pins-plugin-pins',
  'pins-plugin-joko',
  'pins-plugin-orbitals',
]);

/**
 * Normalizes the daemon's `GET /plugins` payload into the rows the plugin card shows.
 * @returns {{ packageName: string, installed: boolean, installedVersion: string|null, availableVersion: string|null }[]}
 */
export function normalizeNinaPackages(payload) {
  const apiPlugins = Array.isArray(payload?.plugins) ? payload.plugins : [];
  return apiPlugins
    .filter((plugin) => plugin?.packageName && !HIDDEN_NINA_PACKAGES.has(plugin.packageName))
    .map((plugin) => ({
      packageName: plugin.packageName,
      installed: Boolean(plugin.installed),
      installedVersion: plugin.installedVersion || null,
      availableVersion: plugin.availableVersion || null,
    }));
}

/** NINA plugin packages (Software tab). */
export function usePinsPackages({ t, runner }) {
  const store = apiStore();
  const { status, isBusy, appendLog, getIp } = runner;

  const ninaPackages = ref([]);
  const isNinaPackagesLoading = ref(false);
  const ninaPackagesCheckedAt = ref('');
  const busyPackage = ref('');

  async function loadNinaPackages() {
    if (!getIp() || isNinaPackagesLoading.value) return;

    isNinaPackagesLoading.value = true;
    try {
      const payload = (await apiPinsService.getPinsPlugins()) || {};
      ninaPackagesCheckedAt.value = payload.checkedAt || '';
      ninaPackages.value = normalizeNinaPackages(payload);
    } catch (error) {
      console.error(error);
      if (error.response?.status === 502) {
        appendLog(t('plugins.pins.logs.pluginsLoadMetadataFailed'));
      } else {
        appendLog(t('plugins.pins.logs.pluginsLoadFailed', { message: error.message }));
      }
    } finally {
      isNinaPackagesLoading.value = false;
    }
  }

  async function runPackageAction(action, packageName) {
    if (isBusy.value || busyPackage.value) return;

    const ip = getIp();
    if (!ip) {
      appendLog(t('plugins.pins.logs.noIp'));
      return;
    }

    const endpoint = action === 'install' ? 'install' : 'uninstall';
    const startMessageKey =
      action === 'install'
        ? 'plugins.pins.logs.pluginInstallStart'
        : 'plugins.pins.logs.pluginUninstallStart';

    runner.beginOperation('pins-plugin');
    busyPackage.value = packageName;
    appendLog(t(startMessageKey, { packageName }));

    try {
      const data = await apiPinsService.runPinsPluginAction(endpoint, packageName);
      const returnedJobId = parseJobIdFromResponse(data);

      if (!returnedJobId) {
        appendLog(t('plugins.pins.logs.error', { message: 'No valid jobId returned.' }));
        status.value = 'Failed';
        return;
      }

      appendLog(t('plugins.pins.logs.jobCreated', { jobId: returnedJobId }));

      const pollResult = await pollJobUntilFinished(returnedJobId, {
        onStatusChange: (jobStatus) =>
          appendLog(t('plugins.pins.logs.jobStatus', { status: jobStatus })),
      });
      if (pollResult.success) {
        status.value = 'Success';
        appendLog(t('plugins.pins.logs.pluginActionSuccess', { packageName }));
      } else {
        status.value = 'Failed';
        appendLog(
          t('plugins.pins.logs.pluginActionFailed', {
            packageName,
            status: pollResult.result?.status || 'unknown',
          })
        );
      }
    } catch (error) {
      console.error(error);
      status.value = 'Failed';
      appendLog(t('plugins.pins.logs.error', { message: error.message }));
      runner.logServerError(error);
    } finally {
      await loadNinaPackages();
      busyPackage.value = '';
    }
  }

  watch(
    () => store.isPINS,
    (isPins) => {
      if (isPins) loadNinaPackages();
    },
    { immediate: true }
  );

  return {
    ninaPackages,
    isNinaPackagesLoading,
    ninaPackagesCheckedAt,
    busyPackage,
    loadNinaPackages,
    installPackage: (packageName) => runPackageAction('install', packageName),
    uninstallPackage: (packageName) => runPackageAction('uninstall', packageName),
  };
}
