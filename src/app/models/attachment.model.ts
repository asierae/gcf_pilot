/** Resource kind reported by the upload API, used to pick an icon in the UI. */
export type AttachmentResourceType = 'image' | 'raw' | 'video';

export interface StoredAttachment {
  url: string;
  /** R2 object key (`organizations/<id>/<section>/<file>`). Empty for legacy links. */
  publicId: string;
  resourceType: AttachmentResourceType;
  name: string;
}

/** Top-level folder in the R2 bucket. */
export type UploadScope = 'organizations' | 'leads';

/** Where a file must be stored inside the bucket. */
export interface UploadTarget {
  scope: UploadScope;
  /** Applicant id, lead id or readiness application id. */
  entityId: string;
  /** Form section, e.g. `access`, `legal`, `s4`, `readiness`. */
  section: string;
}
