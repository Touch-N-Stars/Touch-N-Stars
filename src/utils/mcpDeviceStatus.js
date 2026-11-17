const LABELS = {
  camera: 'camera',
  mount: 'mount',
  focuser: 'focuser',
  filter_wheel: 'filter',
  guider: 'guider',
  rotator: 'rotator',
  flat_device: 'flat',
  dome: 'dome',
  switch: 'switch',
  weather: 'weather',
  safety_monitor: 'safety',
};

// Missing/malformed connection flags must never be presented as connected.
export function deviceStatusRows(result) {
  if (result?.isError || !Array.isArray(result?.devices)) return [];
  return result.devices
    .filter((entry) => typeof entry?.device === 'string' && entry.device.trim())
    .map((entry, index) => ({
      id: `${index}:${entry.device}`,
      name: entry.device,
      labelKey: Object.hasOwn(LABELS, entry.device)
        ? `components.connectEquipment.${LABELS[entry.device]}.name`
        : null,
      connected: typeof entry.connected === 'boolean' ? entry.connected : null,
    }));
}
