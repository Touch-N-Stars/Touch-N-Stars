import perihelionApi from './perihelionClient';
import { getPerihelionToken, setPerihelionToken } from './perihelionAuth';
import { getUrls } from '@/services/api/core';

// A Perihelion install with no token claimed yet hands it to whoever asks first, so a PINS user
// never has to type anything in by hand on first connection. Safe to call every time the app
// starts: once a token is stored locally, or once some other client has already claimed it, this
// is a silent no-op and the existing "missing/wrong token" handling takes over instead.
export async function attemptPairing() {
  if (getPerihelionToken()) return;
  const { PERIHELION_URL } = getUrls();
  try {
    const response = await perihelionApi.post(`${PERIHELION_URL}/pair`);
    if (response.data?.Success && response.data?.Token) {
      setPerihelionToken(response.data.Token);
    }
  } catch {
    // Not installed, unreachable, etc. -- checkPluginInstalled's own probe reports this.
  }
}
