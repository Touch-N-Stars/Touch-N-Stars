import test from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserGlobals, freshPinia } from '../../../test-helpers/browserEnv.js';

installBrowserGlobals();

const { default: axios } = await import('axios');
const { default: apiPinsService } = await import('@/services/apiPinsService');
const { default: systemMetricsService } = await import('../services/systemMetricsService.js');
const { useSettingsStore } = await import('@/store/settingsStore');
const { apiStore } = await import('@/store/store');

freshPinia();
const settingsStore = useSettingsStore();
const store = apiStore();
settingsStore.connection.ip = '10.0.0.25';
settingsStore.connection.port = 5000;
store.apiPort = 1888;

test('power status is not requested or exposed outside PINS mode', async (t) => {
  store.isPINS = false;
  t.mock.method(axios, 'get', async () => ({ data: { CpuUsagePercent: 10 } }));
  const power = t.mock.method(apiPinsService, 'fetchSystemPowerStatus', async () => ({
    supplyVoltage: 5.1,
  }));

  const result = await systemMetricsService.fetchSystemMetrics();

  assert.equal(power.mock.callCount(), 0);
  assert.equal(result.SystemPowerStatus, undefined);
});

test('PINS mode merges temperature and power status into system metrics', async (t) => {
  store.isPINS = true;
  t.mock.method(axios, 'get', async () => ({ data: { CpuUsagePercent: 10 } }));
  t.mock.method(apiPinsService, 'fetchSystemTemperature', async () => ({
    celsius: 50,
    fahrenheit: 122,
    source: 'vcgencmd',
  }));
  t.mock.method(apiPinsService, 'fetchSystemPowerStatus', async () => ({
    supplyVoltage: 5.09,
    underVoltage: false,
    underVoltageOccurred: false,
    rawValue: '0x0',
  }));

  const result = await systemMetricsService.fetchSystemMetrics();

  assert.deepEqual(result.SystemPowerStatus, {
    supplyVoltage: 5.09,
    underVoltage: false,
    underVoltageOccurred: false,
    rawValue: '0x0',
  });
  assert.equal(result.SystemTemperature.celsius, 50);
});

test('Linux swap counters are passed through without requiring PINS mode', async (t) => {
  store.isPINS = false;
  const swap = {
    TotalBytes: 2147483648,
    UsedBytes: 536870912,
    AvailableBytes: 1610612736,
    UsedPercent: 25,
  };
  t.mock.method(axios, 'get', async () => ({ data: { Swap: swap } }));
  const result = await systemMetricsService.fetchSystemMetrics();
  assert.deepEqual(result.Swap, swap);
});

test('older backends without swap metrics remain supported', async (t) => {
  store.isPINS = false;
  t.mock.method(axios, 'get', async () => ({ data: { CpuUsagePercent: 10 } }));
  const result = await systemMetricsService.fetchSystemMetrics();
  assert.equal(result.Swap, undefined);
  assert.equal(result.CpuUsagePercent, 10);
});
