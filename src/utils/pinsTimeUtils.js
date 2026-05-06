function pad2(value) {
  return String(value).padStart(2, '0');
}

export function formatDateTimeWithOffset(date) {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  const offsetMinutesTotal = -date.getTimezoneOffset();
  const sign = offsetMinutesTotal >= 0 ? '+' : '-';
  const offsetHours = pad2(Math.floor(Math.abs(offsetMinutesTotal) / 60));
  const offsetMinutes = pad2(Math.abs(offsetMinutesTotal) % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offsetHours}:${offsetMinutes}`;
}

export function getDeviceDateTimePayload(date = new Date()) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  return {
    dateTime: formatDateTimeWithOffset(date),
    timezone,
  };
}

export function parsePinsTimeToDate(deviceTime) {
  if (!deviceTime) return null;

  if (typeof deviceTime.dateTime === 'string') {
    const parsed = new Date(deviceTime.dateTime);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (typeof deviceTime.timestamp === 'number') {
    const parsed = new Date(deviceTime.timestamp * 1000);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

export function parsePinsTimeToSeconds(deviceTime) {
  const parsed = parsePinsTimeToDate(deviceTime);
  return parsed ? parsed.getTime() / 1000 : null;
}

export function formatPinsTimeForDisplay(deviceTime, locale = undefined, options = {}) {
  const parsed = parsePinsTimeToDate(deviceTime);
  if (!parsed) return '—';

  const formatOptions = Object.keys(options).length
    ? options
    : {
        timeZoneName: 'short',
      };

  return parsed.toLocaleString(locale, formatOptions);
}
