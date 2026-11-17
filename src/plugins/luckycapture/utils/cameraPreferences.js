export function cameraPreferenceKey(host, camera) {
  if (!camera?.connected) return null;
  return `luckycapture.camera.v1:${JSON.stringify([
    host,
    camera.sourceKind || 'real',
    camera.backend,
    camera.deviceId || camera.name,
  ])}`;
}

export function readCameraPreferences(storage, key) {
  if (!key) return null;
  try {
    const value = JSON.parse(storage.getItem(key));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCameraPreferences(storage, key, value) {
  if (!key) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Capture remains available if browser storage is disabled or full.
  }
}

export function sensorPoint(point, rotated) {
  return rotated ? { x: 1 - point.x, y: 1 - point.y } : point;
}

export function cameraDefaults(camera, controls, capabilities) {
  const value = (id) => controls.find((control) => control.id === id)?.currentValue ?? null;
  const exposure = controls.find((control) => control.id === 'exposure');
  const formats = capabilities.rawDepthOptions || [];
  return {
    exposureSeconds: Math.max(exposure?.min ?? 0, Math.min(exposure?.max ?? Infinity, 0.02)),
    gain: value('gain'),
    offset: value('offset'),
    usbLimit: value('usbLimit'),
    bitDepth: formats.find((depth) => depth >= camera.bitDepth) ?? formats[0] ?? camera.bitDepth,
    binX: camera.binX || 1,
    binY: camera.binY || 1,
    roi: null,
    acquisitionMode: 'auto',
    allowExperimentalStreaming: false,
    allowDriverReconnect: false,
    allowStreamDepthReduction: false,
  };
}
