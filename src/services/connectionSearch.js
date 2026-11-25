// Looks for the selected rig, and for other backends, while the app has no connection.
// Read-only: it asks for a PINS daemon's health and a plugin server's version, nothing else.
// The search itself never switches; see useConnectionHelp.js for what happens with a find.
import { Capacitor } from '@capacitor/core';
import {
  buildPinsEndpointCandidates,
  normalizeCandidateHost,
  PINS_HOTSPOT_HOST,
  PINS_MDNS_SERVICE_TYPE,
  probePinsHealth,
} from '@/services/rigEndpointResolver';
import { withWifiBindingTo } from '@/services/wifiBindingService';
import { normalizeMdnsService, TNS_MDNS_SERVICE_TYPE } from '@/utils/mdnsServices';

const DEFAULT_BACKEND_PORT = 5000;
const DISCOVERY_TIMEOUT_MS = 3500;
const PROBE_TIMEOUT_MS = 2200;

/**
 * The backends announcing themselves via mDNS (native apps only).
 * @returns {Promise<{ services: Array, failed: boolean }>} failed: the phone refused every scan
 */
export async function discoverServices(types) {
  if (!Capacitor.isNativePlatform() || types.length === 0) return { services: [], failed: false };
  const { mDNS } = await import('@acovanconis/capacitor-mdns');
  const services = [];
  let failures = 0;
  // One after the other: the native plugin keeps a single listener, parallel scans cancel
  // each other.
  for (const type of types) {
    try {
      const result = await mDNS.discover({ type, timeout: DISCOVERY_TIMEOUT_MS });
      if (result?.error) throw new Error(result.errorMessage);
      services.push(...(result?.services || []).map((s) => normalizeMdnsService(s, type)));
    } catch (error) {
      failures += 1;
      console.warn(`[ConnectionSearch] ${type} scan failed:`, error?.message || error);
    }
  }
  return { services, failed: failures === types.length };
}

/** Resolves when a Touch'N'Stars plugin server answers there, rejects otherwise. */
export async function probePluginServer(host, port) {
  const formattedHost = host.includes(':') ? `[${host}]` : host;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(`http://${formattedHost}:${port}/api/version`, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
    if (!response.ok) throw new Error(`Version probe returned HTTP ${response.status}`);
    const body = await response.json();
    if (!body?.version) throw new Error('Endpoint is not a plugin server');
  } finally {
    clearTimeout(timeoutId);
  }
}

function serviceHosts(service) {
  return [service.ip, ...service.hosts].map(normalizeCandidateHost).filter(Boolean);
}

/**
 * One round of the search.
 *
 * @param {object} options
 * @param {'pins'|'nina'|'unknown'} options.kind  a backend known as NINA is never asked as PINS
 * @returns {Promise<{ boxAnswers: boolean, own: object|null, found: Array, refused: boolean }>}
 *   boxAnswers: the rig is on at the configured address, only PINS does not answer;
 *   own: the selected rig at another address, as probePinsHealth returns it;
 *   found: other backends, as { kind, label, host, port, rigId };
 *   refused: the phone did not let the app search the network
 */
export async function searchBackends({
  kind,
  instance = null,
  currentHost = '',
  currentPort = DEFAULT_BACKEND_PORT,
  pageHost = '',
  probeRig = probePinsHealth,
  probeServer = probePluginServer,
  discover = discoverServices,
  bindWifi = withWifiBindingTo,
}) {
  const expectedRigId = instance?.rigId || '';
  const host = normalizeCandidateHost(currentHost);
  const askPins = kind !== 'nina';
  const rigs = [];

  if (askPins && host) {
    try {
      const current = await probeRig({ host, source: 'active' });
      if (!expectedRigId || current.health.rigId === expectedRigId) {
        return { boxAnswers: true, own: null, found: [], refused: false };
      }
      // Another rig got the address in the meantime.
      rigs.push(current);
    } catch {
      // Nothing there: look elsewhere.
    }
  }

  const { services, failed: refused } = await discover([
    ...(askPins ? [PINS_MDNS_SERVICE_TYPE] : []),
    ...(kind === 'pins' ? [] : [TNS_MDNS_SERVICE_TYPE]),
  ]);
  const rigServices = services.filter((s) => s.sourceType === PINS_MDNS_SERVICE_TYPE);

  if (askPins) {
    const candidates = buildPinsEndpointCandidates({
      instance,
      currentHost: host,
      pageHost,
      mdnsHosts: rigServices.flatMap(serviceHosts),
    }).filter((candidate) => candidate.host !== host);
    // With mobile data on, Android sends everything for the rig's hotspot into the mobile
    // network unless the app is bound to the Wi-Fi.
    const probes = await bindWifi(PINS_HOTSPOT_HOST, () =>
      Promise.allSettled(candidates.map((candidate) => probeRig(candidate)))
    );
    rigs.push(...probes.filter((p) => p.status === 'fulfilled').map((p) => p.value));
  }

  const own = expectedRigId ? rigs.find((rig) => rig.health.rigId === expectedRigId) : null;
  if (own) return { boxAnswers: false, own, found: [], refused };

  const found = [];
  for (const { host: rigHost, health } of rigs) {
    if (found.some((entry) => entry.rigId === health.rigId)) continue;
    const service = rigServices.find((s) => serviceHosts(s).includes(rigHost));
    found.push({
      kind: 'pins',
      label: health.rigId,
      host: rigHost,
      port: service?.port || DEFAULT_BACKEND_PORT,
      rigId: health.rigId,
    });
  }

  // A PINS rig announces its plugin server as well; that one is in the list already.
  const rigHosts = new Set([...rigs.map((rig) => rig.host), ...rigServices.flatMap(serviceHosts)]);
  for (const service of services) {
    if (service.sourceType !== TNS_MDNS_SERVICE_TYPE || !service.ip || !service.port) continue;
    if (serviceHosts(service).some((h) => rigHosts.has(h))) continue;
    if (normalizeCandidateHost(service.ip) === host && service.port === Number(currentPort)) {
      continue;
    }
    if (found.some((entry) => entry.host === service.ip && entry.port === service.port)) continue;
    try {
      await probeServer(service.ip, service.port);
    } catch {
      continue;
    }
    found.push({
      kind: 'nina',
      label: service.label || service.ip,
      host: service.ip,
      port: service.port,
      rigId: '',
    });
  }

  return { boxAnswers: false, own: null, found, refused };
}
