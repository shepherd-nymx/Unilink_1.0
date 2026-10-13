export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
  'image/bmp', 'image/x-ms-bmp', 'image/heic', 'image/heif',
  'image/avif', 'image/tiff',
];

const ALLOWED_IMAGE_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'avif', 'tif', 'tiff',
];

const BLOCKED_EXTENSIONS = [
  'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps',
  'jsp', 'jspf', 'jspx',
  'asp', 'aspx', 'ashx',
  'exe', 'sh', 'bat', 'cmd', 'cgi', 'pl', 'py', 'jar', 'dll', 'so',
  'svg', 'svgz', 'html', 'htm', 'js', 'mjs', 'pdf', 'doc', 'docx',
  'zip', 'rar', '7z', 'gz', 'tar', 'apk', 'msi', 'dmg', 'iso',
];

export type UploadValidationResult = { ok: true } | { ok: false; reason: string };

export function getFileExtension(nameOrUri: string): string {
  const clean = nameOrUri.split('?')[0].split('#')[0];
  const lastSegment = clean.split('/').pop() || '';
  const dot = lastSegment.lastIndexOf('.');
  if (dot === -1 || dot === lastSegment.length - 1) return '';
  return lastSegment.slice(dot + 1).toLowerCase();
}

export function isExtensionBlocked(nameOrUri: string): boolean {
  const ext = getFileExtension(nameOrUri);
  return ext !== '' && BLOCKED_EXTENSIONS.includes(ext);
}

function bytesStartWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function heifBrand(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return null;
  return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
}

export function sniffImageKind(bytes: Uint8Array): string | null {
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'png';
  if (bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) && bytesStartWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'webp';
  if (bytesStartWith(bytes, [0x42, 0x4d])) return 'bmp';
  if (bytesStartWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || bytesStartWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff';
  const brand = heifBrand(bytes);
  if (brand && ['avif', 'avis', 'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) {
    return brand === 'avif' || brand === 'avis' ? 'avif' : 'heif';
  }
  return null;
}

export async function validateUpload(opts: {
  blob: { size: number; type?: string; slice?: unknown };
  fileNameOrUri: string;
}): Promise<UploadValidationResult> {
  const { blob, fileNameOrUri } = opts;

  if (!blob || typeof blob.size !== 'number' || blob.size <= 0) {
    return { ok: false, reason: 'The selected file appears to be empty.' };
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'File is too large. Maximum size is 5MB.' };
  }
  if (blob.type && !ALLOWED_IMAGE_TYPES.includes(blob.type.toLowerCase())) {
    return { ok: false, reason: 'This file type is not allowed. Images only (JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF).' };
  }
  if (isExtensionBlocked(fileNameOrUri)) {
    return { ok: false, reason: 'This file type is not allowed. Images only (JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF).' };
  }
  const ext = getFileExtension(fileNameOrUri);
  if (ext !== '' && !ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    return { ok: false, reason: 'This file type is not allowed. Images only (JPG, PNG, WebP, GIF, BMP, HEIC, AVIF, TIFF).' };
  }

  // Verify the file's actual content is a real image, not a renamed executable
  const anyBlob = blob as { slice?: (a: number, b: number) => { arrayBuffer: () => Promise<ArrayBuffer> } };
  if (typeof anyBlob.slice === 'function') {
    try {
      const head = await anyBlob.slice(0, 32).arrayBuffer();
      const kind = sniffImageKind(new Uint8Array(head));
      if (!kind) {
        return { ok: false, reason: 'This file is not a valid image.' };
      }
    } catch {}
  }
  return { ok: true };
}
