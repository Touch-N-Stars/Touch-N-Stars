// Path helpers for sequence files saved through the plugin server. The path is resolved on the
// backend host, so the separator has to match its OS, not the client's.

/**
 * Joins the profile's sequence folder with a file name.
 *
 * PINS runs on Linux, so it always gets '/'. Guessing from the folder alone is not enough
 * there: a relative folder such as 'N.I.N.A' (what PINS falls back to when ~/Documents is
 * missing) contains no separator, and a '\' would become part of the file name on Linux.
 * Windows NINA keeps the folder's own separator and defaults to '\'.
 *
 * @param {string} folder  DefaultSequenceFolder from the NINA profile
 * @param {string} name    file name, with or without '.json'
 * @param {boolean} isPINS backend is PINS (Linux)
 */
export function joinSequenceFilePath(folder, name, isPINS) {
  const fileName = name.toLowerCase().endsWith('.json') ? name : name + '.json';
  if (!folder) return fileName;
  if (folder.endsWith('/') || folder.endsWith('\\')) return folder + fileName;
  let sep;
  if (isPINS) sep = '/';
  else if (folder.includes('\\')) sep = '\\';
  else if (folder.includes('/')) sep = '/';
  else sep = '\\';
  return folder + sep + fileName;
}

/**
 * True for a folder that is not an absolute path on Linux ('/…') or Windows ('C:\…', 'C:/…',
 * UNC '\\server\…'). The backend resolves such a folder against NINA's working directory.
 */
export function isRelativeFolder(folder) {
  if (!folder) return false;
  return !(folder.startsWith('/') || folder.startsWith('\\\\') || /^[A-Za-z]:[\\/]/.test(folder));
}
