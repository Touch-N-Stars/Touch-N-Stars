import { defineStore } from 'pinia';
import apiService from '@/services/apiService';
import { apiStore } from '@/store/store';
import { useSettingsStore } from './settingsStore';
import { useHistogramStore } from './histogramStore';

export const useImagetStore = defineStore('imageStore', {
  state: () => ({
    imageData: null,
    captureStatsFull: null,
    isImageFetching: false,
    isSequenceImageFetching: false,
    pendingFetch: false,
    lastImage: {
      index: 0,
      quality: 0,
      resize: false,
      scale: 0,
      image: null,
    },
  }),
  actions: {
    calcScale() {
      const settingsStore = useSettingsStore();
      const store = apiStore();
      const cameraWidth = store.profileInfo?.FramingAssistantSettings?.CameraWidth;
      const cameraHeight = store.profileInfo?.FramingAssistantSettings?.CameraHeight;
      const maxDimension = Math.max(cameraWidth, cameraHeight);
      const maxDimensionSetting = settingsStore.camera.maxDimension;
      const scale = maxDimension > maxDimensionSetting ? maxDimensionSetting / maxDimension : 100;
      console.log(
        `[ImageStore] Calculated scale: ${scale}% for camera size ${cameraWidth}x${cameraHeight}`
      );
      return scale;
    },

    async getImage() {
      if (this.isImageFetching) {
        console.log(
          '[ImageStore] getImage: skip — fetch in progress, queueing pending re-fetch'
        );
        this.pendingFetch = true;
        return;
      }
      const settingsStore = useSettingsStore();
      const quality = settingsStore.camera.imageQuality;
      const scale = this.calcScale();
      const resize = scale < 1;
      this.isImageFetching = true;
      const fetchStartTime = Date.now();

      try {
        // Wait if another fetch is in progress
        if (this.isSequenceImageFetching) {
          console.log('[ImageStore] Waiting for getImageByIndex() to complete...');
          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (!this.isSequenceImageFetching) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(interval);
              resolve();
            }, 15000);
          });
        }

        console.log(
          `[ImageStore] ImageStore.getImage: Fetching image with quality: ${quality}, resize: ${resize}, scale: ${scale}`
        );
        const imageResponse = await apiService.getImagePrepared(quality, resize, scale);

        console.log('[ImageStore] Image fetched from API', imageResponse.data);
        console.log(
          '[ImageStore] getImage: response type =',
          imageResponse?.data?.type,
          'size =',
          imageResponse?.data?.size
        );

        if (imageResponse && imageResponse.data.type !== 'application/json') {
          if (this.imageData) {
            URL.revokeObjectURL(this.imageData);
            // Clean up old image from histogram store
            const histogramStore = useHistogramStore();
            histogramStore.clearImageCache(this.imageData);
          }
          this.imageData = URL.createObjectURL(imageResponse.data);
          await this.validateImage(this.imageData);
        } else {
          console.log(
            '[ImageStore] getImage: response is JSON (no image yet on backend), imageData unchanged'
          );
        }
      } catch (error) {
        console.error('[ImageStore] Error fetching information:', error);
      } finally {
        // Ensure isImageFetching is true for at least 1 second
        const elapsedTime = Date.now() - fetchStartTime;
        const minDuration = 1000; // 1 second in milliseconds
        if (elapsedTime < minDuration) {
          await new Promise((resolve) => setTimeout(resolve, minDuration - elapsedTime));
        }
        this.isImageFetching = false;
        if (this.pendingFetch) {
          console.log('[ImageStore] getImage: pending fetch triggered, re-running');
          this.pendingFetch = false;
          this.getImage();
        }
      }
    },

    async getImageByIndex(index, retryCount = 0) {
      console.log(`[ImageStore] ImageStore.getImageByIndex: Getting image by index: ${index}`);
      const settingsStore = useSettingsStore();
      const quality = settingsStore.camera.imageQuality;
      const scale = this.calcScale();

      // check cache
      if (this.lastImage.image && index === this.lastImage.index) {
        console.log('[ImageStore] lastImage from cache');
        const isValid = await this.validateImage(this.lastImage.image);
        if (!isValid) {
          console.warn('[ImageStore] Cached image is corrupted, fetching new image');
          if (this.lastImage.image) {
            URL.revokeObjectURL(this.lastImage.image);
          }
          this.lastImage.image = null;
          // Nur einmal retry beim Cache
          if (retryCount < 1) {
            return this.getImageByIndex(index, retryCount + 1);
          } else {
            console.error('[ImageStore] Max retries reached for cached image');
            return null;
          }
        }
        return this.lastImage.image;
      }

      this.isSequenceImageFetching = true;
      try {
        // Wait if another fetch is in progress
        if (this.isImageFetching) {
          console.log('[ImageStore] Waiting for getImage() to complete...');
          await new Promise((resolve) => {
            const interval = setInterval(() => {
              if (!this.isImageFetching) {
                clearInterval(interval);
                resolve();
              }
            }, 100);
            setTimeout(() => {
              clearInterval(interval);
              resolve();
            }, 15000);
          });
        }

        // Load image from API
        console.log('[ImageStore] Loding sequneceimage from API...');
        const result = await apiService.getSequenceImage(index, quality, true, scale);
        if (result.status !== 200) {
          console.error('[ImageStore] Unknown error: Check NINA Logs for more information');
          return null;
        }
        const blob = result.data;

        // Prüfe ob der Blob gültig ist
        if (!blob || blob.size === 0) {
          console.error('[ImageStore] Received empty blob from API');
          return null;
        }

        const imageUrl = URL.createObjectURL(blob);

        // Warte kurz, damit der Browser den Blob prozessieren kann
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Valid new image
        const isValid = await this.validateImage(imageUrl);
        if (!isValid) {
          console.error('[ImageStore] Fetched sequneceimage is corrupted');
          // Gebe neue URL frei wenn ungültig
          URL.revokeObjectURL(imageUrl);

          // Verhindere Endlosschleife - max 2 Versuche
          if (retryCount < 2) {
            console.log(`[ImageStore] Retrying... (attempt ${retryCount + 1}/2)`);
            await new Promise((resolve) => setTimeout(resolve, 100));
            return this.getImageByIndex(index, retryCount + 1);
          } else {
            console.error('[ImageStore] Max retries reached, image validation failed');
            return null;
          }
        }

        // Gebe alte cached URL frei bevor neue gespeichert wird
        if (this.lastImage.image && this.lastImage.image !== imageUrl) {
          URL.revokeObjectURL(this.lastImage.image);
          // Clean up old image from histogram store
          const histogramStore = useHistogramStore();
          histogramStore.clearImageCache(this.lastImage.image);
        }

        // Save to cache
        this.lastImage.scale = scale;
        this.lastImage.quality = quality;
        this.lastImage.index = index;
        this.lastImage.image = imageUrl;

        return imageUrl;
      } catch (error) {
        console.error(
          `[ImageStore] An error happened while getting image with index ${index}`,
          error.message
        );
        return null;
      } finally {
        this.isSequenceImageFetching = false;
      }
    },

    async getThumbnailByIndex(index, imageType = null) {
      try {
        const blob = await apiService.getSequenceThumbnail(index, imageType);
        const imageUrl = URL.createObjectURL(blob);
        return imageUrl;
      } catch (error) {
        console.error(
          `[ImageStore] An error happened while getting image with index ${index}`,
          error.message
        );
        return null;
      }
    },

    async validateImage(imageUrl) {
      return new Promise((resolve) => {
        if (!imageUrl) {
          console.error('[ImageStore] No imageUrl provided for validation');
          resolve(false);
          return;
        }

        const img = new Image();
        let resolved = false;

        const cleanup = () => {
          // Entferne Event-Listener und setze src zurück um Speicher freizugeben
          img.onload = null;
          img.onerror = null;
          img.src = '';
        };

        img.onload = () => {
          if (!resolved) {
            resolved = true;
            // Prüfe ob das Bild eine gültige Größe hat
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              console.log(
                '[ImageStore] Image is valid',
                `${img.naturalWidth}x${img.naturalHeight}`
              );
              cleanup();
              resolve(true);
            } else {
              console.error('[ImageStore] Image loaded but has invalid dimensions');
              cleanup();
              resolve(false);
            }
          }
        };

        img.onerror = (error) => {
          if (!resolved) {
            resolved = true;
            console.error('[ImageStore] Image is corrupted or invalid', error);
            cleanup();
            resolve(false);
          }
        };

        // Setze src erst nach event listeners
        try {
          img.src = imageUrl;
        } catch (error) {
          console.error('[ImageStore] Failed to set image src', error);
          cleanup();
          resolved = true;
          resolve(false);
        }

        // Timeout nach 10 Sekunden für den Fall, dass das Bild nicht lädt
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error('[ImageStore] Image loading timeout after 10s');
            cleanup();
            resolve(false);
          }
        }, 10000);
      });
    },

    clearImageCache() {
      if (this.imageData) {
        // Clean up from histogram store
        const histogramStore = useHistogramStore();
        histogramStore.clearImageCache(this.imageData);
      }
      this.imageData = null;
      this.isImageFetching = false;
      this.isSequenceImageFetching = false;
      this.pendingFetch = false;
      this.lastImage.index = 0;
      this.lastImage.image = null;
      console.log('[ImageStore] Clearing image cache');
    },
  },
});
