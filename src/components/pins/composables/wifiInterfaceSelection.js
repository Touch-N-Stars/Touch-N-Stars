export function resolveWifiInterfaceSelection(adapters, clientInterface, hotspotInterface) {
  const availableInterfaces = adapters.map((adapter) => adapter.interface).filter(Boolean);
  const availableIfaces = new Set(availableInterfaces);
  if (availableInterfaces.length === 0) {
    return { clientInterface: '', hotspotInterface: '' };
  }

  const defaultInterface = availableIfaces.has('wlan0') ? 'wlan0' : availableInterfaces[0];
  const resolvedClient = availableIfaces.has(clientInterface) ? clientInterface : defaultInterface;
  const resolvedHotspot = availableIfaces.has(hotspotInterface) ? hotspotInterface : resolvedClient;
  return { clientInterface: resolvedClient, hotspotInterface: resolvedHotspot };
}
