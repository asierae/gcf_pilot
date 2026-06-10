import { Injectable } from '@angular/core';
import { CloudinaryResourceType, StoredAttachment } from '../models/attachment.model';

export interface UploadedFile extends StoredAttachment {}

@Injectable({
  providedIn: 'root'
})
export class CloudinaryService {
  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Could not upload file to Cloudinary.');
    }

    const payload = await response.json();
    return {
      url: payload.url,
      publicId: payload.publicId,
      resourceType: payload.resourceType,
      name: file.name
    };
  }

  async deleteFile(publicId: string, resourceType: CloudinaryResourceType): Promise<void> {
    if (!publicId) {
      return;
    }

    const response = await fetch('/api/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, resourceType })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Delete failed' }));
      throw new Error(error.error || 'Could not delete file from Cloudinary.');
    }
  }
}
