import { Injectable } from "@angular/core";
import {
  CloudinaryResourceType,
  StoredAttachment,
} from "../models/attachment.model";
import {
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_UPLOAD_FOLDER,
  CLOUDINARY_UPLOAD_PRESET,
} from "../config/cloudinary.config";

export interface UploadedFile extends StoredAttachment {}

@Injectable({
  providedIn: "root",
})
export class CloudinaryService {
  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", CLOUDINARY_UPLOAD_FOLDER);

    let response: Response;
    try {
      response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        { method: "POST", body: formData }
      );
    } catch {
      throw new Error(
        "Failed to connect to Cloudinary API. Check your internet connection.",
      );
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(
        payload.error?.message || `Upload failed (HTTP ${response.status})`,
      );
    }

    const payload = await response.json();
    return {
      url: payload.secure_url,
      publicId: payload.public_id,
      resourceType: payload.resource_type as CloudinaryResourceType,
      name: file.name,
    };
  }

  async deleteFile(
    publicId: string,
    resourceType: CloudinaryResourceType,
  ): Promise<void> {
    if (!publicId) return;

    let response: Response;
    try {
      response = await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId, resourceType }),
      });
    } catch {
      throw new Error(
        "Upload server is not reachable. Make sure the server is running (npm run start:all).",
      );
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const detail = [payload.error, payload.details]
        .filter(Boolean)
        .join(" — ");
      throw new Error(detail || `Delete failed (HTTP ${response.status})`);
    }
  }
}
