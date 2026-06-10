import { StoredAttachment } from '../models/attachment.model';
import { attachmentFromLegacyUrl } from '../shared/utils/cloudinary-url.util';

export const MAX_FILES_PER_ATTACHMENT = 3;

export const STAGE1_ATTACHMENT_FIELDS: Record<string, string> = {
  nominationLetterFiles: 'NDA nomination letter',
  consultationSummaryFiles: 'Consultation summary & supporting documentation',
  legalSupportingDocumentsFiles: 'Legal supporting documents',
  fastTrackAccreditationFiles: 'Fast-track accreditation reference'
};

export function getAttachmentLabel(key: string, data?: Record<string, unknown>): string {
  if (STAGE1_ATTACHMENT_FIELDS[key]) {
    return STAGE1_ATTACHMENT_FIELDS[key];
  }

  if (key.endsWith('_files')) {
    const questionKey = key.replace(/_files$/, '');
    const narrativeKey = `${questionKey}_narrative`;
    const answerKey = `${questionKey}_answer`;

    if (data?.[narrativeKey] && typeof data[narrativeKey] === 'string') {
      const snippet = (data[narrativeKey] as string).trim().slice(0, 80);
      return snippet ? `Evidence — ${snippet}${snippet.length >= 80 ? '…' : ''}` : `Evidence — ${questionKey}`;
    }

    if (data?.[answerKey]) {
      return `Evidence — ${questionKey} (${String(data[answerKey])})`;
    }

    return `Evidence — ${questionKey}`;
  }

  return key;
}

export function isAttachmentFieldKey(key: string): boolean {
  return key.endsWith('Files') || key.endsWith('_files');
}

export function normalizeAttachments(value: unknown): StoredAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: StoredAttachment[] = [];

  for (const item of value) {
    if (typeof item === 'string' && item.trim()) {
      result.push(attachmentFromLegacyUrl(item.trim()));
      continue;
    }

    if (item && typeof item === 'object') {
      const record = item as Partial<StoredAttachment>;
      const url = typeof record.url === 'string' ? record.url.trim() : '';
      if (!url) {
        continue;
      }

      const legacy = attachmentFromLegacyUrl(url);
      result.push({
        url,
        publicId: typeof record.publicId === 'string' && record.publicId ? record.publicId : legacy.publicId,
        resourceType: record.resourceType ?? legacy.resourceType,
        name: typeof record.name === 'string' && record.name ? record.name : legacy.name
      });
    }
  }

  return result;
}

export function normalizeAttachmentUrls(value: unknown): string[] {
  return normalizeAttachments(value).map((item) => item.url);
}

export function collectAttachmentFields(
  data: Record<string, unknown>
): { key: string; label: string; attachments: StoredAttachment[] }[] {
  const results: { key: string; label: string; attachments: StoredAttachment[] }[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (!isAttachmentFieldKey(key)) {
      continue;
    }

    const attachments = normalizeAttachments(value);
    if (attachments.length) {
      results.push({ key, label: getAttachmentLabel(key, data), attachments });
    }
  }

  return results.sort((a, b) => a.label.localeCompare(b.label));
}
