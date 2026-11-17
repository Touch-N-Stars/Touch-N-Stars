// Full-scale ADU of the frames the flat routines measure.
//
// Prefer the bit depth the backend reports for the measured image (BitDepth in /flats/status):
// RAW frames from DSLR/mirrorless cameras keep their native 12/14-bit values, while the camera
// info's BitDepth is only the profile setting (16 by default) for those cameras. Fall back to the
// camera's bit depth, then to 16 bit.
export function flatMaxADU(imageBitDepth, cameraBitDepth) {
  const bits = validBitDepth(imageBitDepth) ?? validBitDepth(cameraBitDepth) ?? 16;
  return 2 ** bits - 1;
}

function validBitDepth(value) {
  const bits = Number(value);
  return Number.isInteger(bits) && bits >= 1 && bits <= 16 ? bits : null;
}
