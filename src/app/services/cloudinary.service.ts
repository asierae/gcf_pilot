import { Injectable } from "@angular/core";
import {
  CloudinaryResourceType,
  StoredAttachment,
} from "../models/attachment.model";

export interface UploadedFile extends StoredAttachment {}

@Injectable({
  providedIn: "root",
})
export class CloudinaryService {
  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file, file.name);

    let response: Response;
    try {
      response = await fetch("/api/upload", { method: "POST", body: formData });
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
      if (response.status === 503) {
        throw new Error(
          "Cloudinary is not configured on the server. Check CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env",
        );
      }
      throw new Error(detail || `Upload failed (HTTP ${response.status})`);
    }

    const payload = await response.json();
    return {
      url: payload.url,
      publicId: payload.publicId,
      resourceType: payload.resourceType,
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
