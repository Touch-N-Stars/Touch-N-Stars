import { registerPlugin } from '@capacitor/core';

// Native plugin that keeps the pinsdaemon notification stream open while the app is in
// the background and posts phone notifications:
// - Android: android/.../SessionMonitorPlugin.java (foreground service)
// - iOS: ios/App/App/SessionMonitorPlugin.swift (Local Push Connectivity, needs the
//   PushProvider extension, see docs/features/ios-session-notifications.md)
// The web fallback reports it as unavailable.
const SessionMonitor = registerPlugin('SessionMonitor', {
  web: () => import('./sessionMonitorWeb').then((m) => new m.SessionMonitorWeb()),
});

export { SessionMonitor };
