// The info poller only re-reads the active profile every few seconds. Every
// profile write from the app flags it stale here, so the very next poll cycle
// picks the change up even when the caller does not refresh explicitly.
let profileStale = false;

export function markProfileStale() {
  profileStale = true;
}

export function takeProfileStale() {
  const wasStale = profileStale;
  profileStale = false;
  return wasStale;
}
