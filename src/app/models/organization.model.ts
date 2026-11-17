/**
 * An organization is the entity that fills the forms. Its id is also the R2
 * folder (`organizations/<id>/...`) and the id of the pre-screening applicant
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
  /** Last draft save per form, null when there is no draft. */
  drafts: Record<'stage1' | 'readiness', string | null>;
}

export interface OrganizationDraft {
  data: Record<string, unknown>;
  updatedAt: string;
}

export type DraftForm = 'stage1' | 'readiness';
