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

export interface ApplicantRisk {
  overall: number;
  benchmark: number;
  benchmarkSource: string;
  riskBand: RiskBand;
  confidence: number;
  factors: ApplicantRiskFactor[];
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

export interface ApplicantDashboard {
  organization: OrganizationRecord | null;
  generatedAt: string;
  preScreeningStatus: SubmissionStatus;
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
