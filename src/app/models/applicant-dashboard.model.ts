import type { SubmissionStatus } from './applicant.model';
import type { OrganizationRecord } from './organization.model';

export type TimelineStatus = 'complete' | 'current' | 'pending' | 'blocked';
export type RiskBand = 'low' | 'moderate' | 'elevated' | 'high';

export interface ApplicantTimelineStep {
  key: string;
  status: TimelineStatus;
  date: string | null;
}

export interface ApplicantRiskFactor {
  key: 'governance' | 'financial' | 'delivery' | 'climate' | 'transparency';
  value: number;
  weight: number;
}

export interface ApplicantAuditSummary {
  firm: string;
  date: string | null;
  reportUrl: string;
  notes: string;
  updatedAt: string | null;
}

/** AI-generated risk analysis, also published as the Avera audit scores. */
export interface ApplicantAiRiskAnalysis {
  score: number;
  summary: string;
  analyzedAt: string | null;
}

export interface ApplicantRisk {
  overall: number;
  benchmark: number;
  benchmarkSource: string;
  riskBand: RiskBand;
  confidence: number;
  factors: ApplicantRiskFactor[];
  /** 'computed' from submitted data, or 'avera-audit' when Avera published scores. */
  source: 'computed' | 'avera-audit';
  auditedFactors: string[];
  aiAnalysis: ApplicantAiRiskAnalysis | null;
  audit: ApplicantAuditSummary | null;
}

export interface ApplicantAction {
  key: string;
  route: string | null;
  tone: 'high' | 'medium' | 'low';
}

export interface ApplicantActivity {
  key: string;
  date: string;
  tone: 'neutral' | 'success' | 'warn';
}

export interface ApplicantBudgetRow {
  key: string;
  amount: number;
}

export interface ApplicantReadinessSnapshot {
  submittedAt: string | null;
  updatedAt: string | null;
  draftAt: string | null;
  requestedUSD: number;
  budgetTotalUSD: number;
  varianceUSD: number;
  durationMonths: number;
  objectives: number;
  documentsAttached: number;
  documentsRequired: number;
  staffCount: number;
  annualBudgetUSD: number;
  outcomes: number;
  budgetRows: ApplicantBudgetRow[];
}

export interface ApplicantAccreditationSnapshot {
  submittedAt: string | null;
  questionsAnswered: number;
  questionsTotal: number;
  sectionsComplete: number;
  sectionsTotal: number;
  stage1Complete: boolean;
  draftAt: string | null;
}

export interface ApplicantReviewNote {
  sectionId: string;
  sectionLabel: string;
  note: string;
}

export interface ApplicantReview {
  sentAt: string | null;
  notes: ApplicantReviewNote[];
}

export interface ApplicantDashboard {
  organization: OrganizationRecord | null;
  generatedAt: string;
  preScreeningStatus: SubmissionStatus;
  review?: ApplicantReview;
  timeline: {
    accreditation: ApplicantTimelineStep[];
    readiness: ApplicantTimelineStep[];
  };
  progress: {
    accreditation: number;
    readiness: number;
    overall: number;
  };
  risk: ApplicantRisk;
  readinessScore: number | null;
  readiness: ApplicantReadinessSnapshot | null;
  accreditation: ApplicantAccreditationSnapshot;
  actions: ApplicantAction[];
  activity: ApplicantActivity[];
  budget: {
    requestedUSD: number;
    totalUSD: number;
    varianceUSD: number;
    rows: ApplicantBudgetRow[];
  } | null;
}
