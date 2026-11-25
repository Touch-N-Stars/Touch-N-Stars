// "Connect all" / "Disconnect all" for the devices of the active profile, shared by the
// equipment page and the simple mode home page so both connect in the same order and
// apply the same INDI/PINS workarounds.
import { computed, ref, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { apiStore } from '@/store/store';
import { useGuiderStore } from '@/store/guiderStore';
import { useEquipmentStore } from '@/store/equipmentStore';
import apiService from '@/services/apiService';
import { checkMountConnectionPermission } from '@/utils/locationSyncUtils';
import {
  apiActionForApiName,
  getIndiDriver,
  isOfflineDevice,
  redirectManualFilterWheel,
  reloadIndiDriver,
  resolveReloadedDevice,
  setProfileDevice,
} from '@/utils/equipmentDevices';
import { equipmentInUse, isNativeGuiderInUse, usesGuideCameraSlot } from '@/utils/nativeGuider';

// Module level, so a connect started on one page still shows as running on the other.
const isConnecting = ref(false);
const isDisconnecting = ref(false);
// apiNames of the devices with a driver finder that the last connectAll could not connect. Taken
// from the connect's own answer: the polled state follows the event history and may lag by 15 s.
const failedConnects = ref([]);

/**
 * @param {{ selectedGuiderDevice?: import('vue').Ref<string> | string }} [options]
 *   The guider picked in the equipment page's chooser (display name). Without one, the
 *   connected guider or the profile's guider decides whether the guide camera slot counts.
 */
export function useEquipmentConnection({ selectedGuiderDevice = '' } = {}) {
  const { t } = useI18n();
  const store = apiStore();
  const guiderStore = useGuiderStore();
  const equipmentStore = useEquipmentStore();

  // The PINS native guider neither needs the PHD2 guide camera pick nor PHD2's mount-first rule.
  const isNativeGuiderChoice = computed(() =>
    isNativeGuiderInUse(store, unref(selectedGuiderDevice))
  );
  // One guide camera row per guider: the PINS slot only for the native guider.
  const guideCameraSlot = computed(() => usesGuideCameraSlot(store, unref(selectedGuiderDevice)));
  // What 'connect all' handles: without the slot while PHD2 is the guider.
  const equipmentToConnect = computed(() =>
    equipmentInUse(store.existingEquipmentList, { guideCameraSlot: guideCameraSlot.value })
  );

  function isDeviceConnected(apiName) {
    switch (apiName) {
      case 'camera':
        return store.cameraInfo.Connected;
      case 'guidecamera':
        return store.guideCameraInfo.Connected;
      case 'mount':
        return store.mountInfo.Connected;
      case 'filter':
        return store.filterInfo.Connected;
      case 'focuser':
        return store.focuserInfo.Connected;
      case 'rotator':
        return store.rotatorInfo.Connected;
      case 'guider':
        return store.guiderInfo.Connected;
      case 'safety':
        return store.safetyInfo.Connected;
      case 'flatdevice':
        return store.flatdeviceInfo.Connected;
      case 'dome':
        return store.domeInfo.Connected;
      case 'weather':
        return store.weatherInfo.Connected;
      case 'switch':
        return store.switchInfo.Connected;
      default:
        return false;
    }
  }

  const allConnected = computed(() =>
    equipmentToConnect.value.every((device) => isDeviceConnected(device.apiName))
  );

  const hasAnyConnection = computed(() =>
    store.existingEquipmentList.some((device) => isDeviceConnected(device.apiName))
  );

  function waitForMountConnected(timeoutMs = 30000) {
    if (store.mountInfo.Connected) return Promise.resolve(true);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        unwatch();
        resolve(false);
      }, timeoutMs);
      const unwatch = watch(
        () => store.mountInfo.Connected,
        (connected) => {
          if (connected) {
            clearTimeout(timer);
            unwatch();
            resolve(true);
          }
        }
      );
    });
  }

  /**
   * Devices powered by the switch only appear on the USB bus after their port is on — too
   * late for an INDI driver that was started earlier. PINS then lists them as OFFLINE and
   * every connect attempt fails. Restart those drivers before the connect loop runs.
   */
  async function reloadOfflineIndiDrivers() {
    let reloaded = false;

    for (const device of equipmentToConnect.value) {
      const apiAction = apiActionForApiName(device.apiName);
      // Skip everything that is not INDI-backed; native drivers re-enumerate on their own.
      if (!apiAction || !getIndiDriver(apiAction)) continue;
      // Reloading a driver tears down its connection — never touch the switch we just
      // connected, or anything else that is already up.
      if (isDeviceConnected(device.apiName)) continue;

      try {
        const response = await apiService[apiAction]('list-devices');
        const list = Array.isArray(response?.Response) ? response.Response : [];
        const entry = list.find((d) => String(d.Id) === String(device.id));
        if (!isOfflineDevice(entry)) continue;
        if (!(await reloadIndiDriver(apiAction))) continue;
        reloaded = true;

        // The restarted driver derives the Id from the INDI device name, which need not match
        // the Id the profile stored. Since connectAll() connects without ?to=, it would keep
        // using the dead profile Id — so write the resolved one back.
        const refreshed = await apiService[apiAction]('list-devices');
        const resolved = resolveReloadedDevice(
          entry,
          Array.isArray(refreshed?.Response) ? refreshed.Response : []
        );
        if (!resolved) {
          console.warn(`[Connect Equipment] ${device.apiName} did not come back after the reload`);
          continue;
        }
        if (String(resolved.Id) !== String(device.id)) {
          await setProfileDevice(apiAction, String(resolved.Id));
        }
      } catch (error) {
        // One device must not stop the others from connecting.
        console.warn(`[Connect Equipment] INDI driver reload failed for ${device.apiName}`, error);
      }
    }

    // Only refresh the selects when a driver actually changed; otherwise this would fire an
    // extra list-devices per device on every connectAll.
    if (reloaded) {
      equipmentStore.triggerReload();
    }
  }

  /**
   * connectAll() connects without ?to=, so a profile still pointing at the INDI manual wheel
   * has to be rewritten to NINA's built-in one first (see equipmentDevices.js for why).
   */
  async function redirectManualFilterWheelBeforeConnect() {
    if (isDeviceConnected('filter')) return;
    try {
      if (await redirectManualFilterWheel()) {
        equipmentStore.triggerReload();
      }
    } catch (error) {
      // The connect loop reports the failure if the wheel really cannot be connected.
      console.warn('[Connect Equipment] manual filter wheel redirect failed', error);
    }
  }

  async function connectAll() {
    isConnecting.value = true;
    failedConnects.value = [];
    const noteFailure = (apiName, response) => {
      if (response?.Success === false) failedConnects.value.push(apiName);
    };
    try {
      const hasSwitch = store.existingEquipmentList.some((d) => d.apiName === 'switch');
      if (hasSwitch) {
        await apiService.switchAction('connect');
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      await reloadOfflineIndiDrivers();
      await redirectManualFilterWheelBeforeConnect();

      for (const device of equipmentToConnect.value) {
        switch (device.apiName) {
          case 'camera':
            noteFailure('camera', await apiService.cameraAction('connect'));
            break;
          case 'guidecamera':
            noteFailure('guidecamera', await apiService.guideCameraAction('connect'));
            break;
          case 'mount': {
            const canConnect = await checkMountConnectionPermission(t);
            if (!canConnect) {
              return;
            }
            await apiService.mountAction('connect');
            if (!(await waitForMountConnected())) failedConnects.value.push('mount');
            break;
          }
          case 'filter':
            noteFailure('filter', await apiService.filterAction('connect'));
            break;
          case 'focuser':
            noteFailure('focuser', await apiService.focusAction('connect'));
            break;
          case 'rotator':
            await apiService.rotatorAction('connect');
            break;
          case 'guider':
            if (store.isPINS && !isNativeGuiderChoice.value) {
              if (!store.mountInfo.Connected || !guiderStore.guidecamOk) {
                console.warn(
                  '[Connect Equipment] Mount must be connected or guide camera must be match before connecting guider in PINS mode'
                );
                continue;
              }
            }
            await apiService.guiderAction('connect');
            break;
          case 'safety':
            await apiService.safetyAction('connect');
            break;
          case 'flatdevice':
            await apiService.flatdeviceAction('connect');
            break;
          case 'dome':
            await apiService.domeAction('connect');
            break;
          case 'weather':
            await apiService.weatherAction('connect');
            break;
          case 'switch':
            break;
        }
      }
    } catch (error) {
      console.error(t('components.connectEquipment.connectAllError'), error);
    } finally {
      isConnecting.value = false;
    }
  }

  async function disconnectAll() {
    isDisconnecting.value = true;
    try {
      // The guider stops before its camera goes away, so the guide camera is disconnected after the loop.
      let hasGuideCamera = false;
      for (const device of store.existingEquipmentList) {
        switch (device.apiName) {
          case 'camera':
            await apiService.cameraAction('disconnect');
            break;
          case 'guidecamera':
            hasGuideCamera = true;
            break;
          case 'mount':
            await apiService.mountAction('disconnect');
            break;
          case 'filter':
            await apiService.filterAction('disconnect');
            break;
          case 'focuser':
            await apiService.focusAction('disconnect');
            break;
          case 'rotator':
            await apiService.rotatorAction('disconnect');
            break;
          case 'guider':
            if (device.id === 'PHD2_Single') {
              try {
                await apiService.setPHD2StopGuiding();
              } catch (_) {
                /* not guiding */
              }
              await apiService.disconnectPHD2Equipment();
            }
            await apiService.guiderAction('disconnect');
            break;
          case 'safety':
            await apiService.safetyAction('disconnect');
            break;
          case 'flatdevice':
            await apiService.flatdeviceAction('disconnect');
            break;
          case 'dome':
            await apiService.domeAction('disconnect');
            break;
          case 'weather':
            await apiService.weatherAction('disconnect');
            break;
          case 'switch':
            await apiService.switchAction('disconnect');
            break;
        }
      }
      if (hasGuideCamera) {
        await apiService.guideCameraAction('disconnect');
      }
    } catch (error) {
      console.error(t('components.connectEquipment.disconnectAllError'), error);
    } finally {
      isDisconnecting.value = false;
    }
  }

  return {
    isConnecting,
    isDisconnecting,
    failedConnects,
    isNativeGuiderChoice,
    guideCameraSlot,
    equipmentToConnect,
    allConnected,
    hasAnyConnection,
    isDeviceConnected,
    connectAll,
    disconnectAll,
  };
}
