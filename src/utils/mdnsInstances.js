// Merging the backends the app finds via mDNS into one entry per rig.
//
// A PINS rig announces itself twice: _touchnstars (the plugin, port 5000) and _pinsdaemon
// (normalized to the same backend port). mDNS renames the second announcement of a host
// ("pins-503ce-2"), and one of them sometimes arrives with only an IPv6 link-local address.
// Shown as is, a beginner saw two identical choices for one rig, and a single rig could not
// be taken over without asking.

export const PINS_DAEMON_SERVICE_TYPE = '_pinsdaemon._tcp';

/** A name without the counter mDNS appends on a name clash ("pins-503ce-2" -> "pins-503ce"). */
export function baseRigName(label) {
  return String(label ?? '')
    .trim()
    .replace(/(?:-| \()\d{1,2}\)?$/, '');
}

function isIpv4(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(String(host ?? ''));
}

/**
 * One entry per backend. Two finds are the same backend when they share address and port, or
 * name (without the mDNS counter) and port. The merged entry keeps an IPv4 address when either
 * has one, the daemon's source type when either came from it (it leads to the rig id), the
 * clean name and the hosts of both. Entries without address or port are dropped.
 */
export function mergeDiscoveredServices(services) {
  const merged = [];
  for (const service of services ?? []) {
    if (!service?.ip || !service?.port) continue;
    const name = baseRigName(service.label);
    const index = merged.findIndex(
      (kept) =>
        kept.port === service.port && (kept.ip === service.ip || baseRigName(kept.label) === name)
    );
    if (index < 0) {
      merged.push({ ...service, label: name || service.label });
      continue;
    }
    const kept = merged[index];
    const address = isIpv4(kept.ip) || !isIpv4(service.ip) ? kept : service;
    const fromDaemon = [kept, service].find((s) => s.sourceType === PINS_DAEMON_SERVICE_TYPE);
    merged[index] = {
      ...address,
      label: baseRigName(kept.label) || kept.label,
      sourceType: fromDaemon ? PINS_DAEMON_SERVICE_TYPE : address.sourceType,
      hosts: Array.from(new Set([...(kept.hosts ?? []), ...(service.hosts ?? [])])),
    };
  }
  return merged;
}
