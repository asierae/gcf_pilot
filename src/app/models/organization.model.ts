import type { SubmissionStatus } from './applicant.model';

/**
 * An organization is the entity that fills the forms. Its id is also the R2
 * folder (`organizations/<id>/...`) and the id of the pre-accreditation applicant
 * record, so files, drafts and submissions all share one identifier.
 */
export interface OrganizationRecord {
  id: string;
  name: string;
  acronym: string;
  legalAddress: string;
  operationalAddress: string;
  website: string;
  country: string;
  entityType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  // Admin-editable fields
  riskScore: number | null;
  riskNotes: string;
  adminNotes: string;
  accreditationStatus: string;
  priorityLevel: string;
  // Avera risk & reputation audit
  auditEnabled: boolean;
  auditGovernance: number | null;
  auditFinancial: number | null;
  auditDelivery: number | null;
  auditClimate: number | null;
  auditTransparency: number | null;
  auditBenchmark: number | null;
  auditConfidence: number | null;
  auditRiskBand: 'low' | 'moderate' | 'elevated' | 'high' | null;
  auditFirm: string;
  auditDate: string | null;
  auditReportUrl: string;
  auditNotes: string;
  auditUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FormSubmissionSummary {
  submittedAt: string;
  data: Record<string, unknown>;
}

export interface OrganizationForms {
  organization: OrganizationRecord | null;
  stage1: FormSubmissionSummary | null;
  stage2: FormSubmissionSummary | null;
  readiness: FormSubmissionSummary | null;
  /** Admin decision on the pre-accreditation form; gates access to Accreditation. */
  preScreeningStatus: SubmissionStatus;
  /** Last draft save per form, null when there is no draft. */
  drafts: Record<'stage1' | 'readiness', string | null>;
}

export interface OrganizationDraft {
  data: Record<string, unknown>;
  updatedAt: string;
}

export interface OrganizationFile {
  url: string;
  publicId: string;
  name: string;
  resourceType: 'image' | 'raw' | 'video';
  size: number;
  uploadedAt: string;
}

export type OrganizationFileGroup =
  | "readiness"
  | "prescreening"
  | "accreditation"
  | "other";

export interface OrganizationFilesBySection {
  section: string;
  label: string;
  group: OrganizationFileGroup;
  order: number;
  files: OrganizationFile[];
}

export type DraftForm = 'stage1' | 'readiness';
