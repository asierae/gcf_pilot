export type CloudinaryResourceType = 'image' | 'raw' | 'video';

export interface StoredAttachment {
  url: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
  name: string;
}
