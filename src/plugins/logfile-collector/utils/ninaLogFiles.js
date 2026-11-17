import { PINS_INTERNAL_GUIDER_LOG_PATH, PINS_NINA_LOG_PATH } from './diagnosticsSupport.js';

const LOG_FILE_COUNT = 10;
const LOG_SOURCES = [
  { path: PINS_NINA_LOG_PATH, directory: 'nina-logs' },
  { path: PINS_INTERNAL_GUIDER_LOG_PATH, directory: 'internal-guider-logs' },
];

export async function addRecentNinaLogFiles(apiService, filesMap, logger = console) {
  for (const source of LOG_SOURCES) {
    try {
      const listing = await apiService.browseFilesystem(source.path);
      const files = Array.isArray(listing?.files) ? listing.files : [];
      const recentFiles = [...files]
        .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
        .slice(0, LOG_FILE_COUNT);

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
