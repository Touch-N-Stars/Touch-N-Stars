// Shared infrastructure for all API domain modules:
// URL building, PINS daemon auth and small request helpers.
import axios from 'axios';
import { getActivePinia } from 'pinia';
import { PINS_PORT, DEFAULT_PINS_DAEMON_API_TOKEN } from '../pinsConfig';

// Perihelion's own standalone server (see PerihelionApiServer.DefaultPort on the plugin side) --
// a separate port from ninaAPI's /v2/api, since Quick Track deliberately bypasses the sequencer
// entirely rather than going through ninaAPI. Keep these two values in sync.
const PERIHELION_PORT = 1899;

let settingsStore;
let store;

export const DEFAULT_TIMEOUT = 10000;

const initializeStore = () => {
  if (!settingsStore || !store) {
    const pinia = getActivePinia();
    if (!pinia) {
      throw new Error('Pinia store not initialized');
    }
    settingsStore = pinia._s.get('settings');
    store = pinia._s.get('store');

    // Watch for connection changes
    settingsStore.$onAction(({ name }) => {
      if (name === 'setConnection') {
        // Connection changed - URLs will be regenerated on next request
      }
    });
  }
};

const getBaseUrl = () => {
  initializeStore();
  const protocol = settingsStore.backendProtocol || 'http';
  const host = settingsStore.connection.ip || window.location.hostname;
  let port = settingsStore.connection.port || window.location.port || 80;
  const apiPort = store.apiPort;

  //devport auf 5000 umleiten
  const isDev = import.meta.env.DEV;
  if (isDev && port == 8080) {
    port = 5000;
  }

  return {
    base: `${protocol}://${host}:${apiPort}/v2/api`,
    api: `${protocol}://${host}:${port}/api/`,
    targetpic: `${protocol}://${host}:${port}/api/targetpic`,
    pluginServer: `${protocol}://${host}:${port}`,
    pinsDaemon: `${protocol}://${host}:${PINS_PORT}`,
    perihelion: `${protocol}://${host}:${PERIHELION_PORT}/perihelion/api`,
  };
};

export const getUrls = () => {
  const urls = getBaseUrl();
  return {
    BASE_URL: urls.base,
    API_URL: urls.api,
    TARGETPIC_URL: urls.targetpic,
    PLUGINSERVER_URL: urls.pluginServer,
    PINSDAEMON_URL: urls.pinsDaemon,
    PERIHELION_URL: urls.perihelion,
  };
};

export const resolvePinsDaemonApiToken = () => {
  initializeStore();

  const selectedInstance = settingsStore?.connection?.instances?.find(
    (instance) => instance.id === settingsStore?.selectedInstanceId
  );

  const tokenCandidates = [
    selectedInstance?.apiToken,
    settingsStore?.apiToken,
    settingsStore?.connection?.apiToken,
    localStorage.getItem('PINS_API_TOKEN'),
    localStorage.getItem('pinsApiToken'),
    localStorage.getItem('API_TOKEN'),
    localStorage.getItem('apiToken'),
    DEFAULT_PINS_DAEMON_API_TOKEN,
  ];

  const token = tokenCandidates.find(
    (candidate) => typeof candidate === 'string' && candidate.trim().length > 0
  );

  return token ? token.trim() : '';
};

export const getPinsDaemonAuthHeaders = () => {
  const token = resolvePinsDaemonApiToken();
  if (!token) {
    throw new Error('Missing API token for file endpoints');
  }
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const simpleGetRequest = (url) => {
  return axios
    .get(url)
    .then((response) => response.data)
    .catch((error) => {
      throw error;
    });
};

export const getWithParams = (url, params) => {
  return axios
    .get(url, { params })
    .then((response) => response.data)
    .catch((error) => {
      throw error;
    });
};
