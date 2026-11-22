import { PINS_INTERNAL_GUIDER_LOG_PATH, PINS_NINA_LOG_PATH } from './diagnosticsSupport.js';

// The native guider writes one guide log per night (noon to noon). Those files run to
// several MB each and compress poorly, so only the last three nights are collected.
const LOG_SOURCES = [
  { path: PINS_NINA_LOG_PATH, directory: 'nina-logs', count: 10 },
  { path: PINS_INTERNAL_GUIDER_LOG_PATH, directory: 'internal-guider-logs', count: 3 },
];

export async function addRecentNinaLogFiles(apiService, filesMap, logger = console) {
  for (const source of LOG_SOURCES) {
    try {
      const listing = await apiService.browseFilesystem(source.path);
      const files = Array.isArray(listing?.files) ? listing.files : [];
      const recentFiles = [...files]
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
        .slice(0, source.count);

      for (const file of recentFiles) {
        try {
          const buffer = await apiService.fetchFilesystemFileBuffer(file.path);
          filesMap.set(`${source.directory}/${file.name}`, buffer);
        } catch (fileError) {
          logger.warn(`Failed to read NINA log file "${file.path}":`, fileError);
        }
      }
    } catch (error) {
      logger.warn(`Failed to list NINA log files from "${source.path}":`, error);
    }
  }
}
