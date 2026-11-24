// How a computer reaches the pictures over the rig's network share. Name and folder are fixed in
// the pinsdaemon's manage-samba.sh; the daemon only reports whether the share is on.
export const SAMBA_SHARE_NAME = 'Documents';
export const SAMBA_SHARE_FOLDER = '/home/pi/Documents';
// The account the same script creates. The share also allows guests, but current Windows
// versions may refuse a guest login and ask for a user.
export const SAMBA_USER = 'pi';
export const SAMBA_DEFAULT_PASSWORD = 'pins';

/**
 * @param {string} host  address of the rig as the app reaches it
 * @param {string} imageFolder  NINA's image folder (ImageFileSettings.FilePath)
 * @returns {{ windows: string, mac: string, outside: boolean }} addresses down to the image
 *   folder when it lies in the share, otherwise of the share itself. `outside` is only set when
 *   the folder is known; a link on the rig can still lead into the share, so it is a hint.
 */
export function sambaAddresses(host, imageFolder) {
  const folder = String(imageFolder ?? '').replace(/\/+$/, '');
  const inside = folder === SAMBA_SHARE_FOLDER || folder.startsWith(`${SAMBA_SHARE_FOLDER}/`);
  const parts = [
    SAMBA_SHARE_NAME,
    ...(inside ? folder.slice(SAMBA_SHARE_FOLDER.length).split('/').filter(Boolean) : []),
  ];
  return {
    windows: `\\\\${host}\\${parts.join('\\')}`,
    mac: `smb://${host}/${parts.map(encodeURIComponent).join('/')}`,
    outside: Boolean(folder) && !inside,
  };
}
