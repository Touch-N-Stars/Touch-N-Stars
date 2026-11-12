// The manual rotator dialog reaches the app in two shapes:
// - NINA's WPF dialog sends ready-made texts (Text1..Text9, labels already translated)
// - the SignalR dialog under PINS sends raw values (Position, TargetPosition, Rotation, ...)
// toManualRotatorView() turns either into one view model for ManualRotatorDialog.vue.

export function isWpfRotatorContent(content) {
  return Boolean(content?.Text1 && content?.Text2);
}

export function parseCultureInvariantNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const raw = String(value).trim();
  if (!raw) {
    return 0;
  }

  // Keep only sign and numeric separators so values like "12,5°" are still parsed correctly.
  const cleaned = raw.replace(/[^0-9.,+-]/g, '');
  if (!cleaned) {
    return 0;
  }

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized = cleaned;
  if (lastComma > -1 && lastDot > -1) {
    // Assume the rightmost separator is decimal separator.
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = cleaned.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = cleaned.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAngleValue(value) {
  return parseCultureInvariantNumber(value).toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// NINA can send target positions outside 0–360° (e.g. 448°); WPF normalizes there.
const normalize360 = (val) => ((val % 360) + 360) % 360;

/**
 * @param {object} content - dialog content in either shape
 * @param {(key: string) => string} t - i18n translate, used for the SignalR labels
 */
export function toManualRotatorView(content, t) {
  const c = content || {};

  if (isWpfRotatorContent(c)) {
    return {
      currentLabel: c.Text1,
      targetLabel: c.Text4,
      currentAngle: parseCultureInvariantNumber(c.Text2),
      targetAngle: parseCultureInvariantNumber(c.Text5),
      currentText: formatAngleValue(c.Text2) + (c.Text3 ?? ''),
      targetText: formatAngleValue(c.Text5) + (c.Text6 ?? ''),
      rotationText: formatAngleValue(c.Text7) + (c.Text8 ?? ''),
      direction: c.Text9,
    };
  }

  const currentAngle = parseCultureInvariantNumber(c.Position || c.MechanicalPosition || '0');
  const targetAngle = normalize360(
    parseCultureInvariantNumber(c.AbsTargetPosition ?? c.TargetPosition ?? '0')
  );
  return {
    currentLabel: t('dialogs.manualRotator.currentPosition'),
    targetLabel: t('dialogs.manualRotator.targetPosition'),
    currentAngle,
    targetAngle,
    currentText: `${currentAngle.toFixed(2)}°`,
    targetText: `${targetAngle.toFixed(2)}°`,
    rotationText: `${parseCultureInvariantNumber(c.Rotation || '0').toFixed(2)}°`,
    direction: c.Direction || 'Clockwise',
  };
}
