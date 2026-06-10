import { CloudinaryResourceType, StoredAttachment } from '../../models/attachment.model';

const DOCUMENT_EXTENSION = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|txt|csv)(\?|#|$)/i;

export function parseCloudinaryUrl(url: string): {
  publicId: string;
  resourceType: CloudinaryResourceType;
} | null {
  if (!url.includes('res.cloudinary.com')) {
    return null;
  }

  const match = url.match(
    /res\.cloudinary\.com\/[^/]+\/(image|raw|video)\/upload(?:\/[^/]+)*\/v\d+\/(.+?)(?:\?|#|$)/
  );

  if (!match) {
    return null;
  }

  return {
    resourceType: match[1] as CloudinaryResourceType,
    publicId: decodeURIComponent(match[2])
  };
}

export function guessResourceTypeFromUrl(url: string): CloudinaryResourceType {
  const parsed = parseCloudinaryUrl(url);
  if (parsed) {
    return parsed.resourceType;
  }

  const decoded = decodeURIComponent(url);
  if (DOCUMENT_EXTENSION.test(url) || DOCUMENT_EXTENSION.test(decoded)) {
    return 'raw';
  }

  return 'image';
}

/** Use the stored URL as-is — do not add transformations that can cause 401 */
export function resolveCloudinaryFileUrl(attachment: StoredAttachment | string): string {
  if (typeof attachment === 'string') {
    return attachment;
  }

  return attachment.url;
}

export function attachmentFromLegacyUrl(url: string): StoredAttachment {
  const parsed = parseCloudinaryUrl(url);
  const name = fileNameFromUrl(url);

  return {
    url,
    publicId: parsed?.publicId ?? '',
    resourceType: parsed?.resourceType ?? guessResourceTypeFromUrl(url),
    name
  };
}

export function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split('/').pop() || 'document';
    return decodeURIComponent(segment);
  } catch {
    return 'document';
  }
}
