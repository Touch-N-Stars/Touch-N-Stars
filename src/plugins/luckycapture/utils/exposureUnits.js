const scale = (unit) => (unit === 'ms' ? 1000 : 1);

export function displayExposure(seconds, unit) {
  if (seconds == null || seconds === '') return '';
  return Number((Number(seconds) * scale(unit)).toPrecision(14));
}

export function exposureSeconds(value, unit) {
  return value === '' || value == null ? null : Number(value) / scale(unit);
}

export function exposureSupported(seconds, control) {
  return (
    Number.isFinite(seconds) &&
    seconds > 0 &&
    (control.min == null || seconds >= control.min) &&
    (control.max == null || seconds <= control.max)
  );
}
