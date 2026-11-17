// A connected device is authoritative; draft selections are only used while disconnected.
export function connectionForDisplay(status, draft) {
  if (typeof status.connected !== 'boolean') return { transport: '', address: '' };
  if (!status.connected) {
    return {
      transport: draft.transport,
      address: draft.transport === 'usb' ? draft.usbSelection : draft.address,
    };
  }
  const transport = status.transport || (status.usbDevicePath ? 'usb' : 'wifi');
  return {
    transport,
    address: status.connectionAddress || (transport === 'usb' ? status.usbDevicePath : '') || '',
  };
}
