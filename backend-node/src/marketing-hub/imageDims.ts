/** Lightweight PNG/JPEG/WebP dimension readers — no sharp dependency. */

export type ImageDims = { width: number; height: number; format: "png" | "jpeg" | "webp" | "gif" | "unknown" };

export function readImageDimensions(buf: Buffer): ImageDims {
  if (buf.length < 24) return { width: 0, height: 0, format: "unknown" };

  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return {
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
      format: "png",
    };
  }

  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return {
      width: buf.readUInt16LE(6),
      height: buf.readUInt16LE(8),
      format: "gif",
    };
  }

  // WebP (RIFF....WEBP)
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    // VP8X
    if (buf.toString("ascii", 12, 16) === "VP8X" && buf.length >= 30) {
      const width = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
      const height = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
      return { width, height, format: "webp" };
    }
    // VP8 (lossy)
    if (buf.toString("ascii", 12, 16) === "VP8 " && buf.length >= 30) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height, format: "webp" };
    }
  }

  // JPEG — scan for SOF0/SOF2
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
          format: "jpeg",
        };
      }
      if (marker === 0xd9 || marker === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
  }

  return { width: 0, height: 0, format: "unknown" };
}

export const ALLOWED_ASSET_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

export const MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25MB high-res cap (Batch 01 originals ~2MB)
export const MIN_LONG_EDGE = 1024; // Batch 01 portrait 1024×1536 qualifies
