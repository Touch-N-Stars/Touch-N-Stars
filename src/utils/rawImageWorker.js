// Stretch worker: holds the 16-bit preview planes of one image and renders them through
// per-channel lookup tables into a JPEG. Built as a classic worker (Vite bundles the import)
// for WKWebView compatibility.
import { buildLut, renderRgba } from '@/utils/rawImage/stretch';

let planes = null;
let width = 0;
let height = 0;
let bitDepth = 16;
let canvas = null;
let ctx = null;

const dispose = () => {
  planes = null;
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
  canvas = null;
  ctx = null;
};

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'init') {
      ({ planes, width, height, bitDepth } = payload);
      canvas = new OffscreenCanvas(width, height);
      ctx = canvas.getContext('2d');
      self.postMessage({ id, ok: true, result: null });
      return;
    }

    if (type === 'stretch') {
      if (!planes || !ctx) throw new Error('Worker not initialized');
      const luts = payload.levels.map((levels) => buildLut(levels, bitDepth));
      const imageData = ctx.createImageData(width, height);
      renderRgba(planes, luts, imageData.data);
      ctx.putImageData(imageData, 0, 0);
      const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      self.postMessage({ id, ok: true, result: { blob } });
      return;
    }

    if (type === 'dispose') {
      dispose();
      self.postMessage({ id, ok: true });
      self.close();
      return;
    }

    throw new Error(`Unknown message type: ${type}`);
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message || String(error) });
  }
};
