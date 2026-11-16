import { resolveApiUrl } from '../../config/api.config';
import { AttachmentResourceType, StoredAttachment } from '../../models/attachment.model';

const DOCUMENT_EXTENSION = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv)(\?|#|$)/i;

/** Fallback kind for links stored before the R2 migration (no type recorded). */
export function guessResourceTypeFromUrl(url: string): AttachmentResourceType {
  const decoded = decodeURIComponent(url);
  if (DOCUMENT_EXTENSION.test(url) || DOCUMENT_EXTENSION.test(decoded)) {
    return 'raw';
  }

  return 'image';
}

/**
 * Stored URLs are origin-relative (`/api/files/<key>`). When the SPA runs on a
 * different origin than the Worker, point them at the Worker. Absolute URLs
 * from older records are returned untouched.
 */
export function resolveAttachmentUrl(attachment: StoredAttachment | string): string {
  if (typeof attachment === 'string') {
    return resolveApiUrl(attachment);
  }

  return resolveApiUrl(attachment.url);
}

/**
 * Wraps an attachment stored as a plain URL string (or an object without a
 * publicId) into the current shape. Such files live outside R2 and cannot be
 * deleted through the API: `publicId` stays empty on purpose.
 */
export function attachmentFromLegacyUrl(url: string): StoredAttachment {
  return {
    url,
    publicId: '',
    resourceType: guessResourceTypeFromUrl(url),
    name: fileNameFromUrl(url),
  };
}

export function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    const segment = pathname.split('/').pop() || 'document';
    return decodeURIComponent(segment);
  } catch {
    return 'document';
  }
}
