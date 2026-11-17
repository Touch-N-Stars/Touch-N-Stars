/**
 * Parser for the binary container served by the plugin's /api/raw-image/* routes
 * (RawImageEncoder.WriteContainer in the plugin):
 *
 *   uint32 headerLength | UTF-8 JSON header | zero padding to 4 bytes
 *   | uint32[65536] histogram per channel | uint16[width*height] plane per channel
 *
 * All values are little-endian, which is what typed arrays use on every platform the app
 * runs on, so the blocks are viewed in place instead of being copied.
 */

export const RAW_IMAGE_FORMAT_VERSION = 1;
export const HISTOGRAM_BINS = 65536;

export function parseRawImage(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) {
    throw new Error('Raw image payload is empty');
  }

  const headerLength = new DataView(buffer).getUint32(0, true);
  if (4 + headerLength > buffer.byteLength) {
    throw new Error('Raw image header is truncated');
  }
  const meta = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  if (meta.version !== RAW_IMAGE_FORMAT_VERSION) {
    throw new Error(`Unsupported raw image format version ${meta.version}`);
  }

  let offset = 4 + headerLength;
  offset += (4 - (offset % 4)) % 4;

  const pixels = meta.width * meta.height;
  const expected = offset + meta.channels * (HISTOGRAM_BINS * 4 + pixels * 2);
  if (expected > buffer.byteLength) {
    throw new Error('Raw image payload is truncated');
  }

  const histograms = [];
  for (let c = 0; c < meta.channels; c++) {
    histograms.push(new Uint32Array(buffer, offset, HISTOGRAM_BINS));
    offset += HISTOGRAM_BINS * 4;
  }

  const planes = [];
  for (let c = 0; c < meta.channels; c++) {
    planes.push(new Uint16Array(buffer, offset, pixels));
    offset += pixels * 2;
  }

  return { meta, histograms, planes };
}
