import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { saveAs } from 'file-saver';
import { createDownloadNotifier } from './downloadNotifications';

const notificationManager = createDownloadNotifier({
  containerId: 'log-download-notifications',
  progressId: 'download-progress',
  progressTitle: 'Preparing Download',
  progressText: 'Processing log files...',
  successTitle: 'Download Complete!',
  errorTitle: 'Download Failed',
});

/**
 * Downloads logs to file system or browser
 * @param {Array} logs - Array of log entries with timestamp, level, and message
 * @param {Function} formatTimestamp - Function to format timestamp
 * @param {Object} options - Additional options
 * @param {string} options.filePrefix - Prefix for the filename (default: 'logs')
 * @param {string} options.folderName - Folder name for mobile platforms (default: 'TNS-Logs')
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function downloadLogs(logs, formatTimestamp, options = {}) {
  const { filePrefix = 'logs', folderName = 'TNS-Logs' } = options;

  // Show progress notification
  notificationManager.showProgress();

  try {
    const logContent = logs
      .map((entry) => `[${formatTimestamp(entry.timestamp)}] ${entry.level}: ${entry.message}`)
      .join('\n');

    const fileName = `${filePrefix}-${new Date().toISOString().slice(0, 10)}.log`;
    const platform = Capacitor.getPlatform();

    if (platform === 'android' || platform === 'ios') {
      // Use Documents directory for both platforms for better compatibility
      const directory = Directory.Documents;

      // Create folder directory if it doesn't exist
      try {
        await Filesystem.mkdir({
          path: folderName,
          directory: directory,
          recursive: true,
        });
      } catch (mkdirError) {
        // Directory might already exist, ignore error
        if (
          !mkdirError.message.includes('Directory exists') &&
          !mkdirError.message.includes('already exists')
        ) {
          console.warn('Error creating directory:', mkdirError);
        }
      }

      // Write the log file
      await Filesystem.writeFile({
        path: `${folderName}/${fileName}`,
        data: logContent,
        directory: directory,
        encoding: 'utf8',
      });

      console.log(`Log file saved successfully to ${folderName}/${fileName}`);

      // Show success notification with platform-specific message
      if (platform === 'android') {
        // For Android, try to get the file URI for better user feedback
        try {
          const uriResult = await Filesystem.getUri({
            path: `${folderName}/${fileName}`,
            directory: directory,
          });
          console.log(`File URI: ${uriResult.uri}`);
        } catch (uriError) {
          console.warn('Error getting file URI:', uriError);
        }

        notificationManager.showSuccess(
          `Saved to ${folderName} folder in device storage`,
          `File: ${fileName} • ${logs.length} log entries`
        );
      } else if (platform === 'ios') {
        notificationManager.showSuccess(
          `Saved to ${folderName} folder`,
          `Access via Files app • ${fileName} • ${logs.length} entries`
        );
      }

      return true;
    } else {
      // Web browser fallback using file-saver
      const blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, fileName);

      notificationManager.showSuccess(
        `Download started: ${fileName}`,
        `${logs.length} log entries • Check your Downloads folder`
      );

      return true;
    }
  } catch (error) {
    console.error('Error saving log file:', error);

    // Show error notification
    notificationManager.showError(`Failed to save log file: ${error.message || 'Unknown error'}`);

    return false;
  }
}
