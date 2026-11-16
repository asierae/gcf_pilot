import { Injectable } from "@angular/core";
import { API_BASE_URL, API_TOKEN_STORAGE_KEY } from "../config/api.config";
import {
  ApplicantRecord,
  LeadRecord,
  SubmissionStatus,
} from "../models/applicant.model";

interface ApiErrorPayload {
  error?: string;
}

export interface LatestSubmission {
  id: string;
  date: string;
  data: Record<string, unknown>;
}

/**
 * HTTP client for the Cloudflare Worker API (D1 + R2).
 *
 * Public calls (stage submissions, uploads) need no token. Admin calls send
 * `Authorization: Bearer <API_TOKEN>`, obtained by POST /api/login.
 */
@Injectable({
  providedIn: "root",
})
export class ApiService {
  get token(): string | null {
    return sessionStorage.getItem(API_TOKEN_STORAGE_KEY);
  }

  setToken(token: string): void {
    sessionStorage.setItem(API_TOKEN_STORAGE_KEY, token);
  }

  clearToken(): void {
    sessionStorage.removeItem(API_TOKEN_STORAGE_KEY);
  }

  /** Exchange admin credentials for the API token. */
  async login(username: string, password: string): Promise<string> {
    const payload = await this.request<{ token?: string }>(
      "/api/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
      false,
    );

    if (!payload.token) {
      throw new Error("The server did not return an API token.");
    }

    return payload.token;
  }

  // ── Applicants ──────────────────────────────────────────────────────────

  async getAllApplicants(): Promise<ApplicantRecord[]> {
    const payload = await this.request<{ applicants?: ApplicantRecord[] }>(
      "/api/applicants",
      { method: "GET" },
      true,
    );
    return payload.applicants ?? [];
  }

  async getApplicantById(id: string): Promise<ApplicantRecord | null> {
    const payload = await this.request<{ applicant?: ApplicantRecord | null }>(
      `/api/applicants/${encodeURIComponent(id)}`,
      { method: "GET" },
      true,
    );
    return payload.applicant ?? null;
  }

  async createApplicantStage1(
    data: Record<string, unknown>,
  ): Promise<ApplicantRecord> {
    const payload = await this.request<{ applicant: ApplicantRecord }>(
      "/api/applicants/stage1",
      {
        method: "POST",
        body: JSON.stringify({ data }),
      },
      false,
    );
    return payload.applicant;
  }

  async createApplicantStage2(
    data: Record<string, unknown>,
    stage1Data: Record<string, unknown>,
  ): Promise<ApplicantRecord> {
    const payload = await this.request<{ applicant: ApplicantRecord }>(
      "/api/applicants/stage2",
      {
        method: "POST",
        body: JSON.stringify({ data, stage1Data }),
      },
      false,
    );
    return payload.applicant;
  }

  async deleteApplicants(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }
    await this.request<void>(
      "/api/applicants",
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      },
      true,
    );
  }

  async updateApplicantStatus(
    id: string,
    status: SubmissionStatus,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/applicants/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
      true,
    );
  }

  async updateApplicantStage1Data(
    id: string,
    data: Record<string, unknown>,
    now: string,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/applicants/${encodeURIComponent(id)}/stage1`,
      {
        method: "PATCH",
        body: JSON.stringify({ data, updatedAt: now }),
      },
      true,
    );
  }

  async updateApplicantReviewNote(
    id: string,
    sectionId: string,
    note: string,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/applicants/${encodeURIComponent(id)}/review-notes`,
      {
        method: "PATCH",
        body: JSON.stringify({ sectionId, note }),
      },
      true,
    );
  }

  async markApplicantReviewSent(
    id: string,
    recipient: string,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/applicants/${encodeURIComponent(id)}/review-sent`,
      {
        method: "PATCH",
        body: JSON.stringify({ recipient }),
      },
      true,
    );
  }

  /** Public: latest submitted stage payload, used to prefill the wizard. */
  async getLatestSubmission(stage: 1 | 2): Promise<LatestSubmission | null> {
    const payload = await this.request<{
      submission?: LatestSubmission | null;
    }>(`/api/applicants/latest?stage=${stage}`, { method: "GET" }, false);
    return payload.submission ?? null;
  }

  // ── Leads ───────────────────────────────────────────────────────────────

  async getAllLeads(): Promise<LeadRecord[]> {
    const payload = await this.request<{ leads?: LeadRecord[] }>(
      "/api/leads",
      { method: "GET" },
      true,
    );
    return payload.leads ?? [];
  }

  async createLeads(
    leads: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">[],
  ): Promise<LeadRecord[]> {
    if (!leads.length) {
      return [];
    }
    const payload = await this.request<{ leads?: LeadRecord[] }>(
      "/api/leads",
      {
        method: "POST",
        body: JSON.stringify({ leads }),
      },
      true,
    );
    return payload.leads ?? [];
  }

  async updateLead(
    id: string,
    lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/leads/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ lead }),
      },
      true,
    );
  }

  async deleteLeads(ids: string[]): Promise<void> {
    if (!ids.length) {
      return;
    }
    await this.request<void>(
      "/api/leads",
      {
        method: "DELETE",
        body: JSON.stringify({ ids }),
      },
      true,
    );
  }

  // ── Transport ───────────────────────────────────────────────────────────

  private async request<T>(
    path: string,
    init: RequestInit,
    admin: boolean,
  ): Promise<T> {
    const headers = new Headers(init.headers);

    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    if (admin) {
      const token = this.token;
      if (!token) {
        throw new Error("Your session has expired. Please sign in again.");
      }
      headers.set("Authorization", `Bearer ${token}`);
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    } catch {
      throw new Error(
        "Could not reach the server. Check your connection and try again.",
      );
    }

    if (response.status === 401) {
      this.clearToken();
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiErrorPayload;
      throw new Error(
        payload.error || `Request failed (HTTP ${response.status}).`,
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}
