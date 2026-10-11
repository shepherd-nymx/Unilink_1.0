export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

const BLOCKED_EXTENSIONS = [
  'php', 'phtml', 'php3', 'php4', 'php5', 'php7', 'phps',
  'jsp', 'jspf', 'jspx',
  'asp', 'aspx', 'ashx',
  'exe', 'sh', 'bat', 'cmd', 'cgi', 'pl', 'py', 'jar', 'dll', 'so',
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

export function validateUpload(opts: {
  blob: { size: number; type?: string };
  fileNameOrUri: string;
}): UploadValidationResult {
  const { blob, fileNameOrUri } = opts;

  if (!blob || typeof blob.size !== 'number' || blob.size <= 0) {
    return { ok: false, reason: 'The selected file appears to be empty.' };
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    return { ok: false, reason: 'File is too large. Maximum size is 5MB.' };
  }
  if (blob.type && !ALLOWED_IMAGE_TYPES.includes(blob.type.toLowerCase())) {
    return { ok: false, reason: 'Only JPG, PNG, or WebP images are allowed.' };
  }
  if (isExtensionBlocked(fileNameOrUri)) {
    return { ok: false, reason: 'This file type is not allowed.' };
  }
  const ext = getFileExtension(fileNameOrUri);
  if (ext !== '' && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return { ok: false, reason: 'Only JPG, PNG, or WebP images are allowed.' };
  }
  return { ok: true };
}
