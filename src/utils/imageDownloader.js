import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { Media } from '@capacitor-community/media';
import { MediaScanner } from './mediaScanner';
import { createDownloadNotifier } from './downloadNotifications';

// Note: MediaStoreImageSaver plugin removed to fix performance issues on Android

const notificationManager = createDownloadNotifier({
  containerId: 'image-download-notifications',
  progressId: 'image-download-progress',
  progressTitle: 'Saving Image',
  progressText: 'Processing image file...',
  successTitle: 'Image Saved!',
  errorTitle: 'Save Failed',
});

/**
 * Helper function to detect and handle different image data formats with size validation
 * @param {string} imageData - The image data (base64, blob URL, or regular URL)
 * @returns {Promise<{blob: Blob, base64: string, size: number}>} - Returns blob, base64 data and size
 */
async function processImageData(imageData) {
  try {
    let blob;
    let base64;

    if (imageData.startsWith('data:image')) {
      // Already a base64 data URL
      base64 = imageData.split(',')[1];

      // Quick size estimation: base64 length * 0.75 ≈ original size
      const estimatedSize = Math.floor(base64.length * 0.75);

      // Log file size info (no limits, just info)
      if (estimatedSize > 20 * 1024 * 1024) {
        console.log(
          `[ImageDownloader] Large image detected: ${Math.round(estimatedSize / 1024 / 1024)}MB - using optimized processing`
        );
      }

      // Convert base64 to blob (memory efficient for large files)
      const byteCharacters = atob(base64);
      const chunks = [];

      // Dynamic chunk size based on file size
      let chunkSize = 8192; // 8KB for smaller files
      if (estimatedSize > 50 * 1024 * 1024) {
        chunkSize = 32768; // 32KB for very large files (50MB+)
      } else if (estimatedSize > 20 * 1024 * 1024) {
        chunkSize = 16384; // 16KB for large files (20MB+)
      }

      console.log(`[ImageDownloader] Processing with ${chunkSize / 1024}KB chunks...`);

      for (let i = 0; i < byteCharacters.length; i += chunkSize) {
        const chunk = byteCharacters.slice(i, i + chunkSize);
        const byteNumbers = new Array(chunk.length);
        for (let j = 0; j < chunk.length; j++) {
          byteNumbers[j] = chunk.charCodeAt(j);
        }
        chunks.push(new Uint8Array(byteNumbers));

        // For very large files, yield control occasionally to prevent blocking
        if (estimatedSize > 50 * 1024 * 1024 && i % (chunkSize * 10) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      blob = new Blob(chunks, { type: 'image/jpeg' });
    } else {
      // It's a blob URL or regular URL, fetch it
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      // Check Content-Length header if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength);
        if (size > 20 * 1024 * 1024) {
          console.log(
            `[ImageDownloader] Large image detected: ${Math.round(size / 1024 / 1024)}MB - using optimized processing`
          );
        }
      }

      blob = await response.blob();

      // For large files (>10MB), process in background to avoid UI blocking
      if (blob.size > 10 * 1024 * 1024) {
        console.log('[ImageDownloader] Large file detected, using optimized processing...');

        // Use a more memory-efficient approach for large files
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const result = reader.result;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read blob as base64'));

          // Process in next tick to avoid blocking UI
          setTimeout(() => {
            reader.readAsDataURL(blob);
          }, 0);
        });
      } else {
        // Standard processing for smaller files
        base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            try {
              const result = reader.result;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = () => reject(new Error('Failed to read blob as base64'));
          reader.readAsDataURL(blob);
        });
      }
    }

    return { blob, base64, size: blob.size };
  } catch (error) {
    console.error('Error processing image data:', error);
    throw error;
  }
}

/**
 * Downloads an image with visual feedback notifications
 * @param {string} imageData - Base64 or URL of the image
 * @param {string} imageDate - Date string for filename
 * @param {Object} options - Additional options
 * @param {string} options.folderPrefix - Prefix for folder name (default: 'TNS-Images')
 * @param {string} options.filePrefix - Prefix for filename (default: 'TNS')
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function downloadImage(imageData, imageDate = '0000-00-00', options = {}) {
  const { folderPrefix = 'TNS-Images', filePrefix = 'TNS' } = options;

  // Show progress notification
  notificationManager.showProgress();
  let fileName; // Declare fileName in outer scope for fallback access

  try {
    const now = new Date();
    const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeString = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    const platform = Capacitor.getPlatform();

    // For Android, use a fixed folder name "TouchNStars" to store all images in the gallery
    // For other platforms, use date-based folder structure
    let folderName;
    if (platform === 'android') {
      folderName = 'TouchNStars';
    } else {
      folderName = `${folderPrefix}-${currentDate}`;
    }

    if (imageDate === '0000-00-00') {
      fileName = `${filePrefix}-${currentDate}_${timeString}.jpg`;
    } else {
      // Clean imageDate by removing invalid characters for Android filesystem
      const cleanImageDate = imageDate.replace(/[T:+]/g, '-').replace(/\.\d+/g, '');
      fileName = `${filePrefix}-${cleanImageDate}_${timeString}.jpg`;
    }

    if (platform === 'android' || platform === 'ios') {
      console.log('[ImageDownloader] Handling mobile platform download');
      console.log('[ImageDownloader] Platform:', platform);
      console.log(
        '[ImageDownloader] Image source type:',
        imageData.startsWith('data:') ? 'base64' : imageData.startsWith('blob:') ? 'blob' : 'url'
      );

      // iOS: Use @capacitor-community/media to save to Photos app (Camera Roll)
      // Note: Album support has issues - first photo goes to Camera Roll, subsequent photos to album
      // We save to Camera Roll directly to ensure consistent behavior
      if (platform === 'ios') {
        console.log('[ImageDownloader] Using @capacitor-community/media for iOS');

        try {
          // Process the image data to get base64
          const { base64 } = await processImageData(imageData);

          console.log('[ImageDownloader] Saving to iOS Photos app (Camera Roll)');
          console.log('[ImageDownloader] Image size:', Math.round(base64.length / 1024), 'KB');

          // Save to Photos app (Camera Roll / Recents)
          // Note: We don't use albumIdentifier because of iOS album creation issues
          const result = await Media.savePhoto({
            path: `data:image/jpeg;base64,${base64}`,
          });

          console.log('[ImageDownloader] Media.savePhoto success:', result);

          notificationManager.showSuccess(
            `Image saved to Photos`,
            `Saved to Camera Roll • File: ${fileName}`
          );

          return true;
        } catch (iosError) {
          console.error('[ImageDownloader] iOS Media.savePhoto failed:', iosError);
          console.error('[ImageDownloader] Error details:', JSON.stringify(iosError));

          // Check if it's a permission error
          if (
            iosError.message &&
            (iosError.message.includes('permission') ||
              iosError.message.includes('authorized') ||
              iosError.message.includes('denied'))
          ) {
            notificationManager.showError(
              `Photo library permission denied. Please enable photo access in Settings > Touch-N-Stars > Photos`
            );
          } else {
            notificationManager.showError(
              `Failed to save to Photos app: ${iosError.message || 'Unknown error'}`
            );
          }

          return false;
        }
      }

      // Check and request permissions for Android
      if (platform === 'android') {
        try {
          console.log('[ImageDownloader] Checking Android permissions...');
          const permissionStatus = await Filesystem.checkPermissions();
          console.log('[ImageDownloader] Current permission status:', permissionStatus);

          if (permissionStatus.publicStorage !== 'granted') {
            console.log('[ImageDownloader] Requesting permissions...');
            const requestResult = await Filesystem.requestPermissions();
            console.log('[ImageDownloader] Permission request result:', requestResult);
          }
        } catch (permissionError) {
          console.log('[ImageDownloader] Permission handling failed:', permissionError);
          // Continue anyway, we'll use app-specific directories
        }
      }

      // Use different directory strategy based on platform
      let primaryDirectory, primaryDirName;
      if (platform === 'android') {
        // For Android, use ExternalStorage to save in Pictures folder (visible in Gallery)
        primaryDirectory = Directory.ExternalStorage;
        primaryDirName = 'Pictures';
      } else {
        // For iOS, Documents directory works well
        primaryDirectory = Directory.Documents;
        primaryDirName = 'Documents';
      }

      // Skip MediaStore plugin (was causing performance issues) and use direct Filesystem API

      // Process the image data for fallback methods
      console.log('[ImageDownloader] Processing image data for mobile download...');
      const { base64, size } = await processImageData(imageData);

      // Show file size info
      const sizeMB = Math.round((size / 1024 / 1024) * 10) / 10;
      console.log(`[ImageDownloader] Processing ${sizeMB}MB image file...`);

      // Update progress notification for large files
      if (size > 10 * 1024 * 1024) {
        // Determine processing type based on size
        let processingType = 'Large Image';
        let statusText = `Processing ${sizeMB}MB file...`;

        if (size > 50 * 1024 * 1024) {
          processingType = 'Very Large Image';
          statusText = `Processing ${sizeMB}MB file with optimized chunks...`;
        } else if (size > 100 * 1024 * 1024) {
          processingType = 'Huge Image';
          statusText = `Processing ${sizeMB}MB file - this may take a while...`;
        }

        // Show updated progress with file size
        notificationManager.showProgress(`Saving ${processingType}`, statusText);
      }

      // For Android, construct the full path including Pictures folder
      let fullPath;
      if (platform === 'android') {
        fullPath = `Pictures/${folderName}`;
      } else {
        fullPath = folderName;
      }

      // Create folder directory if it doesn't exist
      try {
        await Filesystem.mkdir({
          path: fullPath,
          directory: primaryDirectory,
          recursive: true,
        });
        console.log(`[ImageDownloader] Created directory: ${fullPath} in ${primaryDirName}`);
      } catch (mkdirError) {
        // Directory might already exist, this is fine
        if (
          mkdirError.message.includes('Directory exists') ||
          mkdirError.message.includes('already exists') ||
          mkdirError.message.includes('FILE_EXISTS') ||
          mkdirError.code === 'DIRECTORY_EXISTS'
        ) {
          console.log(`[ImageDownloader] Directory already exists: ${fullPath}`);
        } else {
          console.warn('[ImageDownloader] Error creating directory:', mkdirError);
          // Don't throw here, try to continue with file write
        }
      }

      // Write the image file to the folder
      try {
        console.log(`[ImageDownloader] Attempting to write to ${primaryDirName}/${fullPath}...`);
        await Filesystem.writeFile({
          path: `${fullPath}/${fileName}`,
          data: base64,
          directory: primaryDirectory,
          // Omit encoding for binary data (base64)
        });
        console.log(
          `[ImageDownloader] Image saved successfully to ${fullPath}/${fileName} in ${primaryDirName}`
        );

        // Trigger media scanner on Android to make image visible in Gallery
        if (platform === 'android') {
          try {
            const fileUri = await Filesystem.getUri({
              path: `${fullPath}/${fileName}`,
              directory: primaryDirectory,
            });
            console.log('[ImageDownloader] File URI:', fileUri.uri);

            // Scan file to make it visible in gallery
            await MediaScanner.scanFile({ path: fileUri.uri });
            console.log('[ImageDownloader] Media scan completed');
          } catch (scanError) {
            console.warn('[ImageDownloader] Media scan failed (non-critical):', scanError);
            // Don't fail the whole operation if media scan fails
          }
        }

        // Show success notification
        if (platform === 'android') {
          notificationManager.showSuccess(
            `Image saved to Gallery`,
            `Folder: ${folderName} • File: ${fileName}`
          );
        } else if (platform === 'ios') {
          notificationManager.showSuccess(
            `Image saved to ${folderName} folder`,
            `Access via Files app • ${fileName}`
          );
        }

        return true;
      } catch (writeError) {
        console.error('File write error:', writeError);

        // Try alternative approach for Android - multiple fallback strategies
        if (platform === 'android') {
          console.log('Trying alternative write methods for Android...');

          const fallbackStrategies = [
            // Strategy 1: Try Documents root (user accessible)
            {
              name: 'Documents root',
              async write() {
                return await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.Documents,
                });
              },
            },
            // Strategy 2: Try Data directory (app-specific, should always work)
            {
              name: 'Data directory (app-specific)',
              async write() {
                return await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.Data,
                });
              },
            },
            // Strategy 3: Try Cache directory (app-specific, should always work)
            {
              name: 'Cache directory',
              async write() {
                return await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.Cache,
                });
              },
            },
            // Strategy 4: Try External directory (app-specific)
            {
              name: 'External directory',
              async write() {
                return await Filesystem.writeFile({
                  path: fileName,
                  data: base64,
                  directory: Directory.External,
                });
              },
            },
          ];

          let lastError = writeError;
          let success = false;

          for (const strategy of fallbackStrategies) {
            try {
              console.log(`Trying ${strategy.name}...`);
              await strategy.write();
              console.log(`Image saved successfully using ${strategy.name}: ${fileName}`);

              notificationManager.showSuccess(
                `Image saved successfully using ${strategy.name}`,
                `File: ${fileName}`
              );

              success = true;
              break;
            } catch (strategyError) {
              console.log(`${strategy.name} failed:`, strategyError);
              lastError = strategyError;
            }
          }

          if (!success) {
            console.error('All Android fallback strategies failed:', lastError);
            throw lastError;
          }

          return true;
        } else {
          throw writeError; // Re-throw if it's not Android
        }
      }
    } else {
      // Standard web browser download
      console.log('Processing image data for web download...');
      const { blob } = await processImageData(imageData);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      notificationManager.showSuccess(
        `Download started: ${fileName}`,
        `Check your Downloads folder`
      );

      return true;
    }
  } catch (error) {
    console.error('Error saving image:', error);
    console.error('Image data type:', typeof imageData);
    console.error('Image data preview:', imageData?.substring(0, 100));
    console.error('Platform:', Capacitor.getPlatform());

    // Show error notification
    notificationManager.showError(`Failed to save image: ${error.message || 'Unknown error'}`);

    // Try fallback method for mobile platforms
    if (Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios') {
      try {
        console.log('Attempting fallback download method...');

        // Ensure fileName is defined for fallback
        const now = new Date();
        const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const timeString = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;

        let fallbackFileName;
        if (imageDate === '0000-00-00') {
          fallbackFileName = `${filePrefix}-${currentDate}_${timeString}.jpg`;
        } else {
          fallbackFileName = `${filePrefix}-${imageDate}_${timeString}.jpg`;
        }

        // For blob URLs, we need a different approach
        if (imageData.startsWith('blob:')) {
          // Convert blob URL to blob first
          const response = await fetch(imageData);
          const blob = await response.blob();

          // Create a new blob URL for download
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fallbackFileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
          }, 1000);
        } else {
          // Regular URL fallback
          const response = await fetch(imageData);
          const blob = await response.blob();
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = fallbackFileName;
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
          }, 1000);
        }

        notificationManager.showSuccess(
          'Image downloaded using fallback method',
          'Check your Downloads folder'
        );

        return true;
      } catch (fallbackError) {
        console.error('Fallback download failed:', fallbackError);
        notificationManager.showError('Download failed completely. Please try again.');
        return false;
      }
    }

    return false;
  }
}
