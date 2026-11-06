const UNAVAILABLE = {
  available: false,
  enabled: false,
  running: false,
  connected: false,
  bootId: null,
  lastSeq: 0,
  lastEventAt: null,
  notificationsGranted: false,
  ignoringBatteryOptimizations: false,
};

export class SessionMonitorWeb {
  async start() {
    return { ...UNAVAILABLE };
  }

  async stop() {
    return { ...UNAVAILABLE };
  }

  async getStatus() {
    return { ...UNAVAILABLE };
  }

  async openBatterySettings() {}
}
