import { Injectable } from "@angular/core";
import { API_BASE_URL } from "../config/api.config";
import {
  CloudinaryResourceType,
  StoredAttachment,
} from "../models/attachment.model";

export interface UploadedFile extends StoredAttachment {}

interface UploadErrorPayload {
  error?: string;
}

/**
 * Uploads applicant documents to the Worker's R2 bucket.
 * Files are served back through `/api/files/<key>` on the same origin.
 */
@Injectable({
  providedIn: "root",
})
export class AttachmentService {
  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append("file", file);

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "POST",
        body: formData,
      });
    } catch {
      throw new Error(
        "Could not reach the upload service. Check your connection and try again.",
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as UploadErrorPayload;
      throw new Error(payload.error || `Upload failed (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as Partial<UploadedFile>;

    if (!payload.url || !payload.publicId) {
      throw new Error("The upload service returned an unexpected response.");
    }

    return {
      url: payload.url,
      publicId: payload.publicId,
      resourceType: (payload.resourceType ?? "raw") as CloudinaryResourceType,
      name: payload.name ?? file.name,
    };
  }

  async deleteFile(
    publicId: string,
    // Kept for signature compatibility; R2 keys are type-agnostic.
    _resourceType?: CloudinaryResourceType,
  ): Promise<void> {
    if (!publicId) {
      return;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicId }),
      });
    } catch {
      throw new Error(
        "Could not reach the upload service. Check your connection and try again.",
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as UploadErrorPayload;
      throw new Error(payload.error || `Delete failed (HTTP ${response.status}).`);
    }
  }
}
