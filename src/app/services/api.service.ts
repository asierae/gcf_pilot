import { Injectable } from "@angular/core";
import { API_BASE_URL, API_TOKEN_STORAGE_KEY } from "../config/api.config";
import {
  ApplicantRecord,
  LeadRecord,
  SubmissionStatus,
} from "../models/applicant.model";
import {
  AccreditationSubmissionDetail,
  AccreditationSubmissionSummary,
  DraftForm,
  OrganizationDraft,
  OrganizationFile,
  OrganizationFilesBySection,
  OrganizationForms,
  OrganizationRecord,
  AiRiskAnalysis,
  RiskSkill,
} from "../models/organization.model";
import { AdminStats } from "../models/admin-stats.model";
import { ApplicantDashboard } from "../models/applicant-dashboard.model";
import { EmailLogEntry } from "../models/email-log.model";

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
  archived?: boolean;
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

/** Result of a public profile enquiry: the lead plus account provisioning info. */
export interface ProfileAssessmentResponse {
  lead: LeadRecord;
  userCreated: boolean;
  username?: string;
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
    notes: Record<string, string>,
  ): Promise<void> {
    await this.request<unknown>(
      `/api/applicants/${encodeURIComponent(id)}/review-sent`,
      {
        method: "PATCH",
        body: JSON.stringify({ recipient, notes }),
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

  /** Timeline, progress and reputation index for one organization. */
  async getApplicantDashboard(id: string): Promise<ApplicantDashboard> {
    return this.request<ApplicantDashboard>(
      `/api/organizations/${encodeURIComponent(id)}/dashboard`,
      { method: "GET" },
      false,
    );
  }

  /** Signed Avera risk & reputation PDF for one organization. */
  async downloadRiskReport(id: string): Promise<Blob> {
    let response: Response;
    try {
      response = await fetch(
        `${API_BASE_URL}/api/organizations/${encodeURIComponent(id)}/risk-report.pdf`,
        { method: "GET" },
      );
    } catch {
      throw new Error(
        "Could not reach the server. Check your connection and try again.",
      );
    }

    if (!response.ok) {
      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiErrorPayload;
      throw new Error(
        payload.error || `Request failed (HTTP ${response.status}).`,
      );
    }

    return response.blob();
  }

  /** Applicant-facing update: only the organization's profile fields. */
  async updateOrganizationProfile(
    id: string,
    updates: Partial<
      Pick<
        OrganizationRecord,
        | 'legalAddress'
        | 'operationalAddress'
        | 'website'
        | 'country'
        | 'entityType'
        | 'contactName'
        | 'contactPhone'
      >
    >,
  ): Promise<OrganizationRecord> {
    const payload = await this.request<{ organization: OrganizationRecord }>(
      `/api/organizations/${encodeURIComponent(id)}/profile`,
      { method: 'PATCH', body: JSON.stringify(updates) },
      false,
    );
    return payload.organization;
  }

  // Admin: list all organizations with editable fields
  async getOrganizationsAdmin(): Promise<OrganizationRecord[]> {
    const payload = await this.request<{ organizations?: OrganizationRecord[] }>(
      `/api/admin/organizations`,
      { method: "GET" },
      true,
    );
    return payload.organizations ?? [];
  }

  // Admin: update editable fields for an organization
  async updateOrganizationAdmin(
    id: string,
    updates: Partial<
      Pick<
        OrganizationRecord,
        | 'name'
        | 'acronym'
        | 'riskScore'
        | 'riskNotes'
        | 'adminNotes'
        | 'accreditationStatus'
        | 'priorityLevel'
        | 'auditEnabled'
        | 'auditGovernance'
        | 'auditFinancial'
        | 'auditDelivery'
        | 'auditClimate'
        | 'auditTransparency'
        | 'auditBenchmark'
        | 'auditConfidence'
        | 'auditRiskBand'
        | 'auditFirm'
        | 'auditDate'
        | 'auditReportUrl'
        | 'auditNotes'
      >
    >,
  ): Promise<OrganizationRecord> {
    const payload = await this.request<{ organization: OrganizationRecord }>(
      `/api/admin/organizations/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify(updates) },
      true,
    );
    return payload.organization;
  }

  // Admin: global skills used by the AI risk analysis
  async getRiskSkills(): Promise<RiskSkill[]> {
    const payload = await this.request<{ skills?: RiskSkill[] }>(
      `/api/admin/risk-skills`,
      { method: 'GET' },
      true,
    );
    return payload.skills ?? [];
  }

  async createRiskSkill(input: {
    title: string;
    description: string;
  }): Promise<RiskSkill> {
    const payload = await this.request<{ skill: RiskSkill }>(
      `/api/admin/risk-skills`,
      { method: 'POST', body: JSON.stringify(input) },
      true,
    );
    return payload.skill;
  }

  async updateRiskSkill(
    id: string,
    input: { title: string; description: string },
  ): Promise<RiskSkill> {
    const payload = await this.request<{ skill: RiskSkill }>(
      `/api/admin/risk-skills/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
      true,
    );
    return payload.skill;
  }

  async deleteRiskSkill(id: string): Promise<void> {
    await this.request(
      `/api/admin/risk-skills/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      true,
    );
  }

  /** Synchronous Gemini analysis: writes riskScore + aiRiskSummary on the org. */
  async analyzeOrganizationRisk(id: string): Promise<{
    organization: OrganizationRecord;
    analysis: AiRiskAnalysis;
  }> {
    return this.request<{
      organization: OrganizationRecord;
      analysis: AiRiskAnalysis;
    }>(
      `/api/admin/organizations/${encodeURIComponent(id)}/analyze-risk`,
      { method: 'POST' },
      true,
    );
  }

  // Admin: list files for an organization
  async getOrganizationFiles(
    organizationId: string,
  ): Promise<OrganizationFilesBySection[]> {
    const payload = await this.request<{ sections: OrganizationFilesBySection[] }>(
      `/api/admin/organizations/${encodeURIComponent(organizationId)}/files`,
      { method: "GET" },
      true,
    );
    return payload.sections ?? [];
  }

  // Admin: delete organization and all its files
  async deleteOrganizationAdmin(
    organizationId: string,
    options: {
      deleteFiles?: boolean;
      deleteAccreditation?: boolean;
      deleteReadiness?: boolean;
    } = {},
  ): Promise<void> {
    await this.request(
      `/api/admin/organizations/${encodeURIComponent(organizationId)}`,
      {
        method: "DELETE",
        body: JSON.stringify(options),
      },
      true,
    );
  }

  // ── Admin broadcast emails ──────────────────────────────────────────────

  async sendAdminEmail(input: {
    subject: string;
    title: string;
    text: string;
    recipientIds: string[] | ["all"];
    senderAlias: "contact" | "noreply";
    createdBy?: string;
  }): Promise<{ sent: boolean; sentCount: number; failedCount: number }> {
    return this.request("/api/admin/emails", {
      method: "POST",
      body: JSON.stringify(input),
    }, true);
  }

  async getEmailLog(): Promise<EmailLogEntry[]> {
    const payload = await this.request<{ emails?: EmailLogEntry[] }>(
      "/api/admin/emails",
      { method: "GET" },
      true,
    );
    return payload.emails ?? [];
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

  async getStage2Draft(
    organizationId: string,
  ): Promise<OrganizationDraft | null> {
    const payload = await this.request<{ draft?: OrganizationDraft | null }>(
      `/api/drafts/stage2/${encodeURIComponent(organizationId)}`,
      { method: "GET" },
      false,
    );
    return payload.draft ?? null;
  }

  async saveStage2Draft(
    organizationId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const payload = await this.request<{ updatedAt: string }>(
      `/api/drafts/stage2/${encodeURIComponent(organizationId)}`,
      { method: "PUT", body: JSON.stringify({ data }) },
      false,
    );
    return payload.updatedAt;
  }

  async deleteStage2Draft(organizationId: string): Promise<void> {
    await this.request<void>(
      `/api/drafts/stage2/${encodeURIComponent(organizationId)}`,
      { method: "DELETE" },
      false,
    );
  }

  async listAccreditationSubmissions(): Promise<AccreditationSubmissionSummary[]> {
    const payload = await this.request<{
      submissions?: AccreditationSubmissionSummary[];
    }>('/api/accreditation/submissions', { method: 'GET' }, true);
    return payload.submissions ?? [];
  }

  async setArchived(
    kind: "lead" | "applicant" | "readiness" | "accreditation",
    ids: string[],
    archived: boolean,
  ): Promise<void> {
    await this.request<void>(
      "/api/admin/archive",
      {
        method: "PATCH",
        body: JSON.stringify({ kind, ids, archived }),
      },
      true,
    );
  }

  async setAccreditationSubmissionStatus(
    id: string,
    status: string,
  ): Promise<void> {
    await this.request<void>(
      `/api/accreditation/submissions/${encodeURIComponent(id)}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
      true,
    );
  }

  async deleteAccreditationSubmissions(ids: string[]): Promise<void> {
    await this.request<void>(
      "/api/accreditation/submissions",
      { method: "DELETE", body: JSON.stringify({ ids }) },
      true,
    );
  }

  async getAccreditationSubmission(
    id: string,
  ): Promise<AccreditationSubmissionDetail | null> {
    const payload = await this.request<{
      submission?: AccreditationSubmissionDetail;
    }>(`/api/accreditation/submissions/${encodeURIComponent(id)}`, {
      method: 'GET',
    }, true);
    return payload.submission ?? null;
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
  ): Promise<{ submittedAt: string; userCreated: boolean; username?: string }> {
    const payload = await this.request<{
      submission: { submittedAt: string };
      userCreated?: boolean;
      username?: string;
    }>(
      `/api/readiness/${encodeURIComponent(organizationId)}`,
      { method: "PUT", body: JSON.stringify({ data }) },
      false,
    );
    return {
      submittedAt: payload.submission.submittedAt,
      userCreated: payload.userCreated === true,
      username: payload.username,
    };
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

  /** Public "Check my profile" enquiry — creates a lead without a token. */
  async submitProfileAssessment(
    lead: Omit<LeadRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<ProfileAssessmentResponse> {
    return this.request<ProfileAssessmentResponse>(
      "/api/profile-assessment",
      {
        method: "POST",
        body: JSON.stringify({ lead }),
      },
      false,
    );
  }

  /** Aggregated system metrics for the admin overview page. */
  async getAdminStats(): Promise<AdminStats> {
    return this.request<AdminStats>("/api/admin/stats", { method: "GET" }, true);
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
