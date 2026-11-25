// Reading what a backend announces via mDNS: its name, address and port.
import { PINS_MDNS_SERVICE_TYPE } from '@/services/rigEndpointResolver';

export const TNS_MDNS_SERVICE_TYPE = '_touchnstars._tcp';

const MDNS_INSTANCE_PREFIX = 'touchnstars_';

export function normalizeMdnsService(service, sourceType) {
  const txt = service?.txt || {};
  const { baseName, suffix } = splitInstanceName(service?.name ?? '');
  const ipFromTxt = typeof txt.ip === 'string' ? txt.ip.trim() : '';
  const ipFromHosts = pickPreferredHost(service?.hosts || []);
  const ip = ipFromTxt || ipFromHosts || '';
  const port =
    sourceType === PINS_MDNS_SERVICE_TYPE
      ? resolvePort(txt.backendPort, 5000)
      : resolvePort(txt.port, service?.port);
  const preferredName =
    (typeof txt.instanceName === 'string' && txt.instanceName.trim()) ||
    baseName ||
    service?.name ||
    '';
  const label = stripInstancePrefix(preferredName);
  const instanceId = (typeof txt.instanceId === 'string' && txt.instanceId.trim()) || suffix || '';
  const rawName = service?.name || preferredName;

  return {
    label,
    ip,
    port,
    instanceId,
    hosts: service?.hosts || [],
    txt,
    rawName,
    sourceType,
  };
}

function splitInstanceName(name) {
  if (typeof name !== 'string') {
    return { baseName: '', suffix: '' };
  }
  const trimmed = name.trim();
  if (!trimmed) {
    return { baseName: '', suffix: '' };
  }

  const suffixMatch = trimmed.match(/-([0-9a-fA-F]{6})$/);
  const suffix = suffixMatch ? suffixMatch[1] : '';
  const baseWithoutSuffix = suffixMatch
    ? trimmed.slice(0, trimmed.length - suffix.length - 1).trim()
    : trimmed;

  return { baseName: stripInstancePrefix(baseWithoutSuffix), suffix };
}

function stripInstancePrefix(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const prefix = MDNS_INSTANCE_PREFIX;
  const lower = trimmed.toLowerCase();
  const lowerPrefix = prefix.toLowerCase();
  if (lower.startsWith(lowerPrefix)) {
    return trimmed.slice(prefix.length);
  }
  return trimmed;
}

function pickPreferredHost(hosts) {
  if (!Array.isArray(hosts)) {
    return '';
  }
  const ipv4 = hosts.find((host) => typeof host === 'string' && host.includes('.'));
  const firstHost = hosts.find((host) => typeof host === 'string');
  return ipv4 || firstHost || '';
}

function resolvePort(txtPort, fallbackPort) {
  if (typeof txtPort === 'number' && Number.isFinite(txtPort)) {
    return txtPort;
  }
  if (typeof txtPort === 'string') {
    const parsed = parseInt(txtPort, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (typeof fallbackPort === 'number' && Number.isFinite(fallbackPort)) {
    return fallbackPort;
  }
  return 0;
}
