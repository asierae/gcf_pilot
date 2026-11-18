import { Injectable } from "@angular/core";
import { API_BASE_URL, API_TOKEN_STORAGE_KEY } from "../config/api.config";
import {
  ApplicantRecord,
  LeadRecord,
  SubmissionStatus,
} from "../models/applicant.model";
import {
  DraftForm,
  OrganizationDraft,
  OrganizationForms,
  OrganizationRecord,
} from "../models/organization.model";

interface ApiErrorPayload {
  error?: string;
}

export interface LatestSubmission {
  id: string;
  date: string;
  data: Record<string, unknown>;
}

export interface ReadinessSubmissionSummary {
  organizationId: string;
  submittedAt: string;
  updatedAt: string;
  organization: {
    name: string;
    acronym: string;
    country: string;
  };
  proposalTitle: string;
  requestedAmountUSD: number | null;
  ndaEmail: string;
}

export interface ApiUser {
  id: string;
  username: string;
  email: string;
  role: "admin" | "applicant";
  status: "active" | "pending" | "suspended";
  organizationId?: string;
  organizationName?: string;
  organizationAcronym?: string;
  hasPassword?: boolean;
  createdAt?: string;
}

export interface LoginResponse {
  token?: string;
  user: ApiUser;
}

export interface UserTokenInfo {
  kind: "reset" | "invite";
  username: string;
  email: string;
  organizationName?: string;
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

  /** Exchange portal credentials for the session user (and admin API token). */
  async login(username: string, password: string): Promise<LoginResponse> {
    const payload = await this.request<LoginResponse>(
      "/api/login",
      {
        method: "POST",
        body: JSON.stringify({ username, password }),
      },
      false,
    );

    return payload;
  }

  // ── Account recovery & invitations ─────────────────────────────────────

  async forgotPassword(username: string): Promise<void> {
    await this.request<{ sent?: boolean }>(
      "/api/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ username }) },
      false,
    );
  }

  async getTokenInfo(token: string): Promise<UserTokenInfo> {
    const payload = await this.request<{ token: UserTokenInfo }>(
      `/api/auth/token/${encodeURIComponent(token)}`,
      { method: "GET" },
      false,
    );
    return payload.token;
  }

  async resetPassword(token: string, password: string): Promise<void> {
    await this.request<{ ok?: boolean }>(
      "/api/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, password }) },
      false,
    );
  }

  async acceptInvite(token: string, password: string): Promise<void> {
    await this.request<{ ok?: boolean }>(
      "/api/auth/accept-invite",
      { method: "POST", body: JSON.stringify({ token, password }) },
      false,
    );
  }

  // ── Users ───────────────────────────────────────────────────────────────

  async getUsers(): Promise<ApiUser[]> {
    const payload = await this.request<{ users?: ApiUser[] }>(
      "/api/users",
      { method: "GET" },
      true,
    );
    return payload.users ?? [];
  }

  async createUser(input: {
    username: string;
    email: string;
    role: ApiUser["role"];
    status?: ApiUser["status"];
    organizationId?: string;
    organizationName?: string;
    organizationAcronym?: string;
    invite?: boolean;
  }): Promise<{ user: ApiUser | null; invited: boolean; inviteError?: string }> {
    return this.request(
      "/api/users",
      { method: "POST", body: JSON.stringify(input) },
      true,
    );
  }

  async updateUser(
    id: string,
    input: Partial<
      Pick<
        ApiUser,
        | "username"
        | "email"
        | "role"
        | "status"
        | "organizationId"
        | "organizationName"
        | "organizationAcronym"
      >
    >,
  ): Promise<ApiUser | null> {
    const payload = await this.request<{ user: ApiUser | null }>(
      `/api/users/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(input) },
      true,
    );
    return payload.user;
  }

  async deleteUser(id: string): Promise<void> {
    await this.request<void>(
      `/api/users/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      true,
    );
  }

  async inviteUser(id: string): Promise<void> {
    await this.request<{ sent: boolean }>(
      `/api/users/${encodeURIComponent(id)}/invite`,
      { method: "POST" },
      true,
    );
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
    id?: string,
  ): Promise<ApplicantRecord> {
    const payload = await this.request<{ applicant: ApplicantRecord }>(
      "/api/applicants/stage1",
      {
        method: "POST",
        body: JSON.stringify(id ? { data, id } : { data }),
      },
      false,
    );
    return payload.applicant;
  }

  async createApplicantStage2(
    data: Record<string, unknown>,
    stage1Data: Record<string, unknown>,
    id?: string,
  ): Promise<ApplicantRecord> {
    const payload = await this.request<{ applicant: ApplicantRecord }>(
      "/api/applicants/stage2",
      {
        method: "POST",
        body: JSON.stringify(id ? { data, stage1Data, id } : { data, stage1Data }),
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

  // ── Organizations ───────────────────────────────────────────────────────

  async getOrganization(id: string): Promise<OrganizationRecord | null> {
    const payload = await this.request<{
      organization?: OrganizationRecord | null;
    }>(
      `/api/organizations/${encodeURIComponent(id)}`,
      { method: "GET" },
      false,
    );
    return payload.organization ?? null;
  }

  async saveOrganization(
    id: string,
    organization: Partial<OrganizationRecord>,
  ): Promise<OrganizationRecord> {
    const payload = await this.request<{ organization: OrganizationRecord }>(
      `/api/organizations/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(organization) },
      false,
    );
    return payload.organization;
  }

  async isAcronymAvailable(
    acronym: string,
    excludeId: string,
  ): Promise<boolean> {
    const query = new URLSearchParams({ acronym, exclude: excludeId });
    const payload = await this.request<{ available?: boolean }>(
      `/api/organizations/acronym-available?${query.toString()}`,
      { method: "GET" },
      false,
    );
    return payload.available === true;
  }

  async getOrganizationForms(id: string): Promise<OrganizationForms> {
    return this.request<OrganizationForms>(
      `/api/organizations/${encodeURIComponent(id)}/forms`,
      { method: "GET" },
      false,
    );
  }

  // ── Drafts ──────────────────────────────────────────────────────────────

  async getDraft(
    form: DraftForm,
    organizationId: string,
  ): Promise<OrganizationDraft | null> {
    const payload = await this.request<{ draft?: OrganizationDraft | null }>(
      `/api/drafts/${form}/${encodeURIComponent(organizationId)}`,
      { method: "GET" },
      false,
    );
    return payload.draft ?? null;
  }

  async saveDraft(
    form: DraftForm,
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const payload = await this.request<{ updatedAt: string }>(
      `/api/drafts/${form}/${encodeURIComponent(organizationId)}`,
      { method: "PUT", body: JSON.stringify({ data }) },
      false,
    );
    return payload.updatedAt;
  }

  async deleteDraft(form: DraftForm, organizationId: string): Promise<void> {
    await this.request<void>(
      `/api/drafts/${form}/${encodeURIComponent(organizationId)}`,
      { method: "DELETE" },
      false,
    );
  }

  // ── Readiness ───────────────────────────────────────────────────────────

  async getReadinessSubmissions(): Promise<ReadinessSubmissionSummary[]> {
    const payload = await this.request<{
      submissions?: ReadinessSubmissionSummary[];
    }>("/api/readiness", { method: "GET" }, true);
    return payload.submissions ?? [];
  }

  async updateReadinessAdmin(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<{ submittedAt: string; updatedAt: string }> {
    const payload = await this.request<{
      submission: { submittedAt: string; updatedAt: string };
    }>(
      `/api/readiness/${encodeURIComponent(organizationId)}`,
      { method: "PATCH", body: JSON.stringify({ data }) },
      true,
    );
    return {
      submittedAt: payload.submission.submittedAt,
      updatedAt: payload.submission.updatedAt,
    };
  }

  async submitReadiness(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<{ submittedAt: string }> {
    const payload = await this.request<{
      submission: { submittedAt: string };
    }>(
      `/api/readiness/${encodeURIComponent(organizationId)}`,
      { method: "PUT", body: JSON.stringify({ data }) },
      false,
    );
    return { submittedAt: payload.submission.submittedAt };
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
