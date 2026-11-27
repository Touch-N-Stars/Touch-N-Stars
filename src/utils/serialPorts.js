// Helpers for the list from apiService.availableSerialPorts().

// That list also carries the /dev/serial/by-id and /dev/serial/by-path links, which name the
// same devices a second and third time. A beginner should see every device once.
export function physicalSerialPorts(list) {
  return (list || []).filter(
    (entry) => !entry.separator && entry.Port && !entry.Port.startsWith('/dev/serial/')
  );
}

// The port that can be taken without asking: no port chosen yet and exactly one device
// plugged in. Otherwise null.
export function autoSerialPort(ports, currentPort) {
  if (currentPort) return null;
  return ports.length === 1 ? ports[0].Port : null;
}

export function serialPortLabel(entry) {
  return entry.Description ? `${entry.Port} – ${entry.Description}` : entry.Port;
}
