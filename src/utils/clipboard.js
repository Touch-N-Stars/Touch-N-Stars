// navigator.clipboard only exists in a secure context (HTTPS or localhost). Browsers that
// open the app via http://<nina-ip> have no clipboard API at all, so fall back to the
// legacy execCommand('copy') path there. Throws if neither path succeeds.
export async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Permission denied or document not focused -- try the legacy path below.
      console.warn('Clipboard API failed, using fallback:', error);
    }
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  // readonly keeps the on-screen keyboard closed; off-screen so nothing flashes.
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '-9999px';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  try {
    textArea.select();
    // iOS WebKit ignores select() on readonly fields without an explicit range.
    textArea.setSelectionRange(0, text.length);
    if (!document.execCommand('copy')) {
      throw new Error('execCommand copy was rejected');
    }
  } finally {
    document.body.removeChild(textArea);
  }
}
