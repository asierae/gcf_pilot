export type SubmissionStatus = 'Pending' | 'Passed' | 'Failed';

export const SUBMISSION_STATUSES: SubmissionStatus[] = ['Pending', 'Passed', 'Failed'];

export interface StagePayload {
  submittedAt: string;
  data: Record<string, unknown>;
}

export interface ReviewSentLog {
  sentAt: string;
  recipient: string;
}

export interface ApplicantAdmin {
  status: SubmissionStatus;
  reviewNotes: Record<string, string>;
  lastReviewSent: ReviewSentLog | null;
}

/**
 * Applicant document stored in Firestore.
 * Add new top-level fields (e.g. stage3, documents, auditLog) as the app grows.
 */
export interface ApplicantRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage1: StagePayload | null;
  stage2: StagePayload | null;
  admin: ApplicantAdmin;
  /** Optional bucket for future structured data without schema migrations */
  extensions?: Record<string, unknown>;
}

export const DEFAULT_APPLICANT_ADMIN: ApplicantAdmin = {
  status: 'Pending',
  reviewNotes: {},
  lastReviewSent: null
};

export type LeadStatus = 'Pending' | 'Contacted' | 'Qualified' | 'Rejected';

export const LEAD_STATUS_OPTIONS: LeadStatus[] = ['Pending', 'Contacted', 'Qualified', 'Rejected'];

export interface LeadRecord {
  id?: string;
  region: string;
  country: string;
  organization: string;
  acronym: string;
  entityType: string;
  website: string;
  contactEmail: string;
  climateSpecialty: string;
  comments: string;
  status: LeadStatus;
  createdAt?: string;
  updatedAt?: string;
}
