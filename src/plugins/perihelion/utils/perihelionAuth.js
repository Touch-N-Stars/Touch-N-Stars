const STORAGE_KEY = 'perihelion:apiToken';

// Perihelion's standalone API requires this on every request (see the plugin's own
// PerihelionAuthModule) -- generated on the plugin side and entered here once, in Settings.
export function getPerihelionToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setPerihelionToken(token) {
  try {
    const trimmed = (token || '').trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // localStorage unavailable (private browsing, etc.) -- token just won't persist
  }
}
