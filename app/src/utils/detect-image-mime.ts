/**
 * 通过文件头 magic bytes 嗅探图片 MIME 类型
 *
 * 用于在远程响应 Content-Type 缺失或为 `application/octet-stream` 等通用类型时，
 * 从 buffer 内容回退识别真实 MIME，保证生成的 data URI 是合法的 image/* 类型。
 */

/** 支持嗅探的图片 MIME 类型 */
export type SniffedImageMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/gif'
  | 'image/webp'
  | 'image/bmp'
  | 'image/avif'
  | 'image/tiff';

/**
 * 通过 magic bytes 推断图片 MIME 类型
 * @returns 识别到的 MIME，未知则返回 null
 */
export function sniffImageMime(buffer: Buffer): SniffedImageMime | null {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) return 'image/png';

  // GIF: "GIF87a" / "GIF89a"
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return 'image/gif';

  // WebP: "RIFF....WEBP"
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return 'image/webp';

  // BMP: "BM"
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) return 'image/bmp';

  // AVIF / HEIC: "....ftypavif" / "....ftypheic" 等，第 4-11 字节为 "ftyp????"
  if (buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    const brand = buffer.slice(8, 12).toString('ascii');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }

  // TIFF: "II*\0" (little-endian) 或 "MM\0*" (big-endian)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) return 'image/tiff';

  return null;
}

/**
 * 解析图片 MIME，优先使用传入的 contentType，
 * 当其缺失或为通用类型（octet-stream / binary）时，回退到 magic bytes 嗅探。
 *
 * @param buffer 图片二进制
 * @param contentType 远程响应的 Content-Type（可空）
 * @param fallback 嗅探也失败时的兜底 MIME，默认 `image/jpeg`
 */
export function resolveImageMime(
  buffer: Buffer,
  contentType?: string | null,
  fallback: SniffedImageMime = 'image/jpeg',
): string {
  const ct = (contentType || '').toLowerCase().trim();
  const isGeneric = !ct || ct === 'application/octet-stream' || ct === 'binary/octet-stream';
  if (!isGeneric && ct.startsWith('image/')) return ct;
  return sniffImageMime(buffer) ?? fallback;
}
