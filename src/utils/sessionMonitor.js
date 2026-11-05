import { registerPlugin } from '@capacitor/core';

// Android-only native plugin (android/.../SessionMonitorPlugin.java): a foreground
// service that keeps the pinsdaemon notification stream open while the app is in the
// background and posts phone notifications. iOS has no implementation yet (it needs
// an NEAppPushProvider extension), so callers check the platform first.
const SessionMonitor = registerPlugin('SessionMonitor', {
  web: () => import('./sessionMonitorWeb').then((m) => new m.SessionMonitorWeb()),
});

export { SessionMonitor };
