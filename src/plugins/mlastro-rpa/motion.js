// Keep the controller's latched fault visible and permit a deliberate reconnect.
export function motionRecovery(status) {
  const faulted = status.motionState === 'Faulted' || Boolean(status.motionFault);
  return {
    faulted,
    inhibited: Boolean(status.motionInhibited) || faulted || status.motionState === 'Stopping',
  };
}

export function canDisconnect(status, localJogActive, busy) {
  if (busy || !status.connected) return false;
  if (motionRecovery(status).faulted) return true;
  return !status.automationEnabled && !localJogActive && !status.jogActive;
}
