import { defineStore } from 'pinia';
import { markRaw } from 'vue';
import apiService from '@/services/apiService';
import { useSettingsStore } from '@/store/settingsStore';
import { parseRawImage } from '@/utils/rawImage/parseRawImage';
import { rawFromRgba } from '@/utils/rawImage/displayImage';
import {
  autoStretch,
  buildLut,
  dataRangeLevels,
  linearLevels,
  neutralizeBackground,
  renderRgba,
  shiftLevels,
} from '@/utils/rawImage/stretch';
import { cumulative } from '@/utils/rawImage/histogramView';

// Histogram and stretch on the real sensor data. The plugin server delivers a full-resolution
// histogram with exact statistics plus 16-bit preview planes; the stretch runs here, so the
// sliders respond without a round trip. Entries are keyed by the URL of the image the view
// shows, which is what imageStore already uses to release them.

const useWorker =
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined' &&
  typeof createImageBitmap === 'function';

const WORKER_TIMEOUT_MS = 30_000;
const MAX_PREVIEW_DIM = 2048;

class WorkerEngine {
  constructor() {
    this.worker = null;
    this.nextId = 1;
    this.disposed = false;
    this.pending = new Map(); // id -> { reject, handler }
  }

  _send(type, payload, transfer) {
    return new Promise((resolve, reject) => {
      if (this.disposed || !this.worker) {
        reject(new Error('Engine disposed'));
        return;
      }
      const id = this.nextId++;
      let timeoutId = null;

      const cleanup = () => {
        clearTimeout(timeoutId);
        if (this.worker) this.worker.removeEventListener('message', handler);
        this.pending.delete(id);
      };

      const handler = (event) => {
        if (event.data?.id !== id) return;
        cleanup();
        if (event.data.ok) resolve(event.data.result);
        else reject(new Error(event.data.error || 'Worker error'));
      };

      // Guards against silent worker termination on iOS/WKWebView, where the OS can kill
      // workers without firing an 'error' event.
      timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Worker request timed out'));
      }, WORKER_TIMEOUT_MS);

      this.pending.set(id, { reject, handler });
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ id, type, payload }, transfer || []);
    });
  }

  async init(planes, width, height, bitDepth) {
    // Classic (non-module) worker - better WKWebView/iOS Safari compatibility. The dev
    // server serves the worker unbundled with its ES imports, so it needs a module worker.
    this.worker = import.meta.env.DEV
      ? new Worker(new URL('@/utils/rawImageWorker.js', import.meta.url), { type: 'module' })
      : new Worker(new URL('@/utils/rawImageWorker.js', import.meta.url));
    const onError = (e) => {
      const message = e?.message || e?.error?.message || 'Worker load/runtime error';
      console.error('[HistogramStore] worker error:', message, e);
      this.pending.forEach(({ reject, handler }) => {
        if (this.worker) this.worker.removeEventListener('message', handler);
        reject(new Error(message));
      });
      this.pending.clear();
    };
    this.worker.addEventListener('error', onError);
    this.worker.addEventListener('messageerror', onError);

    try {
      await this._send(
        'init',
        { planes, width, height, bitDepth },
        planes.map((p) => p.buffer)
      );
    } catch (error) {
      this.worker?.terminate();
      this.worker = null;
      throw error;
    }
  }

  async render(levels) {
    const result = await this._send('stretch', { levels });
    return result.blob;
  }

  dispose() {
    this.disposed = true;
    this.pending.forEach(({ reject, handler }) => {
      if (this.worker) this.worker.removeEventListener('message', handler);
      reject(new Error('Engine disposed'));
    });
    this.pending.clear();
    if (this.worker) {
      try {
        this.worker.postMessage({ id: -1, type: 'dispose' });
      } catch {
        // ignore
      }
      this.worker.terminate();
      this.worker = null;
    }
  }
}

// Fallback for WebViews without OffscreenCanvas (older iOS): same work on the main thread.
class MainEngine {
  constructor() {
    this.planes = null;
    this.disposed = false;
  }

  async init(planes, width, height, bitDepth) {
    Object.assign(this, { planes, width, height, bitDepth });
  }

  async render(levels) {
    if (this.disposed || !this.planes) throw new Error('Engine disposed');
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(this.width, this.height);
    const luts = levels.map((l) => buildLut(l, this.bitDepth));
    renderRgba(this.planes, luts, imageData.data);
    ctx.putImageData(imageData, 0, 0);
    try {
      return await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          'image/jpeg',
          0.92
        );
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  dispose() {
    this.disposed = true;
    this.planes = null;
  }
}

// Kept outside the reactive state: workers, controllers and pixel buffers must not be proxied.
const engines = new Map(); // imageUrl -> engine
const controllers = new Map(); // imageUrl -> AbortController
const renderQueue = new Map(); // imageUrl -> { busy, pending }

async function fetchRaw(source, maxDim, signal) {
  switch (source.kind) {
    case 'prepared':
      return apiService.getRawPreparedImage(maxDim, signal);
    case 'history':
      return apiService.getRawHistoryImage(source, maxDim, signal);
    case 'livestack':
      return apiService.getRawLivestackImage(source.target, source.filter, maxDim, signal);
    default:
      throw new Error(`Unknown raw image source ${source.kind}`);
  }
}

// Maps a failed request to what the panel shows. A missing route means the plugin predates
// this feature; the plugin's own errors carry a `code` in their JSON body.
function errorCode(error) {
  if (error?.rawImageCode) return error.rawImageCode;
  const status = error?.response?.status;
  let code = null;
  const data = error?.response?.data;
  if (data instanceof ArrayBuffer && data.byteLength > 0) {
    try {
      code = JSON.parse(new TextDecoder().decode(data))?.code ?? null;
    } catch {
      code = null;
    }
  }
  if (code) return code;
  if (status === 404 || status === 405) return 'unsupported';
  return 'error';
}

// Decodes the JPEG the view shows, downscaled through a canvas with high-quality smoothing
// (iOS WebKit ignores createImageBitmap's resizeQuality and resamples blockily).
async function decodeDisplayImage(imageUrl, maxDim) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Image load failed'));
    el.src = imageUrl;
  });
  const sourceWidth = img.naturalWidth;
  const sourceHeight = img.naturalHeight;
  const scale = Math.min(1, maxDim / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    return rawFromRgba(data, width, height, { sourceWidth, sourceHeight });
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

// Plugins up to 1.5.0.0 have no raw-image route; they get the histogram and stretch of the
// displayed JPEG instead of only a hint. Any other error, or a failed fallback, stays as is.
async function loadImageData(imageUrl, source, maxDim, signal) {
  try {
    return parseRawImage(await fetchRaw(source, maxDim, signal));
  } catch (error) {
    if (signal.aborted || errorCode(error) !== 'unsupported') throw error;
    try {
      return await decodeDisplayImage(imageUrl, maxDim);
    } catch (fallbackError) {
      console.warn('[HistogramStore] JPEG fallback failed', fallbackError);
      throw error;
    }
  }
}

// NINA already stretched and colour balanced its JPEG: shifting the channels would tint it,
// so a display image keeps its channels as they are.
function background(meta) {
  if (!meta.displayImage) return neutralizeBackground(meta.stats);
  const { stats } = meta;
  const average = (key) => stats.reduce((sum, s) => sum + s[key], 0) / stats.length;
  return {
    offsets: stats.map(() => 0),
    reference: {
      min: Math.min(...stats.map((s) => s.min)),
      max: Math.max(...stats.map((s) => s.max)),
      median: average('median'),
      mad: average('mad'),
    },
  };
}

// Linked levels are one set for the background-neutralised data (see neutralizeBackground).
// A display image is shown as delivered, which is the identity on its own pixels.
function initialLevels(meta) {
  if (meta.displayImage) return [linearLevels()];
  return [autoStretch(background(meta).reference, meta.bitDepth)];
}

export const useHistogramStore = defineStore('histogramStore', {
  state: () => ({
    // imageUrl -> entry; see _createEntry()
    entries: new Map(),
  }),

  actions: {
    _createEntry(source) {
      return {
        sourceKey: JSON.stringify(source),
        status: 'loading', // loading | ready | <error code>
        meta: null,
        stats: [],
        histograms: null, // markRaw'd Uint32Array per channel
        cums: null, // markRaw'd Float64Array per channel
        linked: true,
        // Per-channel shift (ADU) that aligns the backgrounds while linked; zeros for mono.
        offsets: [],
        // One entry when linked, one per channel when unlinked; normalised to the bit depth.
        levels: [],
        modified: false,
        rendering: false,
        stretchedUrl: null,
      };
    },

    /** Loads the raw data for an image once; repeated calls for the same source are free. */
    async requestRaw(imageUrl, source) {
      if (!imageUrl || !source) return;
      const existing = this.entries.get(imageUrl);
      if (existing && existing.sourceKey === JSON.stringify(source)) {
        if (existing.status === 'loading' || existing.status === 'ready') return;
      }
      if (existing) this.clearImageCache(imageUrl);

      this.entries.set(imageUrl, this._createEntry(source));
      // Read back through the store: the Map hands out the reactive proxy, and identity checks
      // below compare against what later get() calls return.
      const entry = this.entries.get(imageUrl);
      const controller = new AbortController();
      controllers.set(imageUrl, controller);

      const settingsStore = useSettingsStore();
      // The preview planes are 2 bytes per pixel and channel and stay in memory for the stretch,
      // so they are capped independently of the JPEG size setting (which can be "unlimited").
      const maxDim = Math.min(
        settingsStore.camera.maxDimension || MAX_PREVIEW_DIM,
        MAX_PREVIEW_DIM
      );

      try {
        const { meta, histograms, planes } = await loadImageData(
          imageUrl,
          source,
          maxDim,
          controller.signal
        );
        if (controller.signal.aborted) return;

        // Histograms stay here, the preview planes move into the engine.
        const ownHistograms = histograms.map((h) => h.slice());
        const ownPlanes = planes.map((p) => p.slice());
        let engine = useWorker ? new WorkerEngine() : new MainEngine();
        engines.set(imageUrl, engine);
        try {
          await engine.init(ownPlanes, meta.width, meta.height, meta.bitDepth);
        } catch (error) {
          if (engine.disposed) return;
          console.warn('[HistogramStore] Worker engine failed, using main thread', error);
          engine.dispose();
          engine = new MainEngine();
          engines.set(imageUrl, engine);
          await engine.init(
            planes.map((p) => p.slice()),
            meta.width,
            meta.height,
            meta.bitDepth
          );
        }
        if (controller.signal.aborted || this.entries.get(imageUrl) !== entry) return;

        entry.meta = meta;
        entry.stats = meta.stats;
        entry.histograms = markRaw(ownHistograms);
        entry.cums = markRaw(ownHistograms.map(cumulative));
        entry.offsets = background(meta).offsets;
        entry.levels = initialLevels(meta);
        entry.status = 'ready';
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'CanceledError') return;
        const code = errorCode(error);
        if (code === 'error') console.error('[HistogramStore] raw image request failed', error);
        if (this.entries.get(imageUrl) === entry) entry.status = code;
      } finally {
        if (controllers.get(imageUrl) === controller) controllers.delete(imageUrl);
      }
    },

    getEntry(imageUrl) {
      return imageUrl ? (this.entries.get(imageUrl) ?? null) : null;
    },

    /** The stretched rendering, or null while the view should show the original image. */
    displayUrl(imageUrl) {
      const entry = this.getEntry(imageUrl);
      return entry?.modified ? entry.stretchedUrl : null;
    },

    setLevels(imageUrl, levels) {
      const entry = this.getEntry(imageUrl);
      if (!entry || entry.status !== 'ready') return;
      entry.levels = levels;
      entry.modified = true;
      this._scheduleRender(imageUrl);
    },

    setLinked(imageUrl, linked) {
      const entry = this.getEntry(imageUrl);
      if (!entry || entry.status !== 'ready' || entry.meta.channels === 1) return;
      entry.linked = linked;
      this.autoStretch(imageUrl);
    },

    /** NINA's auto stretch on the raw data, linked or per channel. */
    autoStretch(imageUrl) {
      const entry = this.getEntry(imageUrl);
      if (!entry || entry.status !== 'ready') return;
      const { stats, bitDepth } = entry.meta;
      const levels =
        entry.linked || stats.length === 1
          ? [autoStretch(background(entry.meta).reference, bitDepth)]
          : stats.map((s) => autoStretch(s, bitDepth));
      this.setLevels(imageUrl, levels);
    },

    /** Linear contrast stretch over the occupied data range. */
    linearStretch(imageUrl) {
      const entry = this.getEntry(imageUrl);
      if (!entry || entry.status !== 'ready') return;
      const { stats, bitDepth } = entry.meta;
      const levels =
        entry.linked || stats.length === 1
          ? [dataRangeLevels(background(entry.meta).reference, bitDepth)]
          : stats.map((s) => dataRangeLevels(s, bitDepth));
      this.setLevels(imageUrl, levels);
    },

    /** Back to the image as the backend delivered it, with the levels that match it. */
    resetStretch(imageUrl) {
      const entry = this.getEntry(imageUrl);
      if (!entry) return;
      if (entry.stretchedUrl) URL.revokeObjectURL(entry.stretchedUrl);
      entry.stretchedUrl = null;
      entry.modified = false;
      if (entry.meta) {
        entry.linked = true;
        entry.levels = initialLevels(entry.meta);
      }
    },

    // Renders the latest levels. While a render is running, newer levels only replace the
    // pending ones, so a fast drag never queues more than one render behind the current one.
    async _scheduleRender(imageUrl) {
      let queue = renderQueue.get(imageUrl);
      if (!queue) {
        queue = { busy: false, pending: false };
        renderQueue.set(imageUrl, queue);
      }
      queue.pending = true;
      if (queue.busy) return;

      queue.busy = true;
      const entry = this.getEntry(imageUrl);
      if (entry) entry.rendering = true;
      try {
        while (queue.pending) {
          queue.pending = false;
          const current = this.getEntry(imageUrl);
          const engine = engines.get(imageUrl);
          if (!current || !engine || !current.modified) break;

          const { channels, bitDepth } = current.meta;
          // Plain objects: reactive proxies cannot be posted to the worker.
          const levels =
            current.levels.length === channels
              ? current.levels.map((l) => ({ ...l }))
              : shiftLevels({ ...current.levels[0] }, [...current.offsets], bitDepth);
          const blob = await engine.render(levels);

          const latest = this.getEntry(imageUrl);
          if (latest !== current || !latest.modified) break;
          if (latest.stretchedUrl) URL.revokeObjectURL(latest.stretchedUrl);
          latest.stretchedUrl = URL.createObjectURL(blob);
        }
      } catch (error) {
        if (error?.message !== 'Engine disposed') {
          console.error('[HistogramStore] Stretch failed', error);
        }
      } finally {
        queue.busy = false;
        const latest = this.getEntry(imageUrl);
        if (latest) latest.rendering = false;
        if (renderQueue.get(imageUrl) === queue && !queue.pending) renderQueue.delete(imageUrl);
      }
    },

    clearImageCache(imageUrl) {
      if (!imageUrl) return;
      controllers.get(imageUrl)?.abort();
      controllers.delete(imageUrl);
      engines.get(imageUrl)?.dispose();
      engines.delete(imageUrl);
      renderQueue.delete(imageUrl);
      const entry = this.entries.get(imageUrl);
      if (entry?.stretchedUrl) URL.revokeObjectURL(entry.stretchedUrl);
      this.entries.delete(imageUrl);
    },

    clearAllCache() {
      [...this.entries.keys()].forEach((url) => this.clearImageCache(url));
    },
  },
});
