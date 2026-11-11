import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();
const { default: axios } = await import('axios');
const { rawHttp } = await import('@/services/api/core');
const { setupErrorHandler } = await import('@/utils/errorHandler');
const { rpaRequest } = await import('../api');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');
freshPinia();
const settings = useSettingsStore();
settings.connection.ip = '10.0.0.5';
settings.connection.port = 5000;
settings.connection.instances = [];
settings.selectedInstanceId = null;
apiStore().apiPort = 1888;
setupErrorHandler();

test('RPA connection refusal retains its reason despite global error masking', async (t) => {
  const previous = rawHttp.defaults.adapter;
  rawHttp.defaults.adapter = async (config) => {
    throw new axios.AxiosError('HTTP 409', 'ERR_BAD_RESPONSE', config, null, {
      status: 409,
      data: {
        error: 'Several possible RPA USB devices found. Choose the RPA from the USB device list.',
      },
      headers: {},
      config,
    });
  };
  t.after(() => {
    rawHttp.defaults.adapter = previous;
  });
  await assert.rejects(
    rpaRequest('connect', { transport: 'usb', address: 'auto' }),
    /Several possible RPA USB devices/
  );
});
