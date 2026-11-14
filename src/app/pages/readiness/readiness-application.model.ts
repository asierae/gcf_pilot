export type PolicyStatus = 'none' | 'draft' | 'board_approved';
export type EntityType = 'public' | 'private' | 'ngo_cso' | 'regional';
export type AuditOpinion =
  | 'unqualified'
  | 'qualified'
  | 'adverse'
  | 'disclaimed'
  | 'no_audits';
export type BudgetCategory =
  | 'international_consultants'
  | 'national_consultants'
  | 'travel_per_diem'
  | 'workshops_training'
  | 'equipment_software'
  | 'external_audit'
  | 'project_management_costs';

export type ReadinessObjective =
  | 'obj1_coordination'
  | 'obj2_frameworks'
  | 'obj3_dae_capacity'
  | 'obj4_pipeline'
  | 'obj5_knowledge';

export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Q5' | 'Q6' | 'Q7' | 'Q8';
export type UnitType = 'days' | 'months' | 'trips' | 'workshops' | 'lump_sum';
export type ProcurementMethod =
  | 'competitive_bidding'
  | 'three_quotes'
  | 'direct_contracting'
  | 'not_applicable';
export type AccountingStandard =
  | 'IFRS'
  | 'IPSAS'
  | 'National_GAAP'
  | 'Cash_Basis';

export interface ReadinessApplication {
  metadata: {
    proposalTitle: string;
    country: string;
    organizationLegalName: string;
    entityType: EntityType;
    requestedAmountUSD: number;
    durationMonths: 12 | 18 | 24 | 36;
    readinessObjectives: ReadinessObjective[];
    ndaFocalPointName: string;
    ndaMinistry: string;
    ndaEmail: string;
    hasExternalDeliveryPartner: boolean;
    externalDeliveryPartnerName?: string;
  };

  institutionalProfile: {
    registrationNumber: string;
    incorporationDate: string;
    staffCount: number;
    annualOperatingBudgetUSD: number;
    largestPreviousGrantUSD: number;
    mandateSummary: string;
    gapMatrix: {
      financialManagementPolicy: PolicyStatus;
      internalExternalAudit: PolicyStatus;
      procurementPolicy: PolicyStatus;
      amlCftPolicy: PolicyStatus;
      whistleblowerPolicy: PolicyStatus;
      essManagementSystem: PolicyStatus;
      grievanceMechanism: PolicyStatus;
      genderPolicy: PolicyStatus;
    };
    identifiedGapsSummary: string;
  };

  narrative: {
    problemStatementAndBarriers: string;
    nationalAlignmentNdcNap: string;
    complementarityPastGrants: string;
    theoryOfChange: string;
    sustainabilityAndExitStrategy: string;
  };

  logframe: {
    outcomes: {
      id: string;
      code: string;
      description: string;
      indicator: string;
      baseline: string;
      target: string;
      meansOfVerification: string;
      outputs: {
        id: string;
        code: string;
        description: string;
        indicator: string;
        baseline: string;
        target: string;
        activities: {
          id: string;
          code: string;
          description: string;
          deliverable: string;
          quarters: Quarter[];
        }[];
      }[];
    }[];
  };

  budget: {
    lineItems: {
      id: string;
      activityId: string;
      category: BudgetCategory;
      description: string;
      unitType: UnitType;
      unitCostUSD: number;
      quantity: number;
      budgetNoteJustification: string;
      procurementMethod: ProcurementMethod;
      targetQuarter: Quarter;
    }[];
    disbursementTranches: {
      trancheNumber: number;
      milestoneDescription: string;
      amountUSD: number;
      estimatedMonth: number;
    }[];
  };

  fmca?: {
    regulatoryAuthority: string;
    totalAssetsUSD: number;
    hasOngoingLitigation: boolean;
    litigationDetails?: string;
    hasIndependentAuditCommittee: boolean;
    accountingStandard: AccountingStandard;
    accountingSoftwareName: string;
    canSegregateGcfFundsInSeparateAccount: boolean;
    hasDualSignatoryControls: boolean;
    past3YearsAuditOpinion: AuditOpinion;
    externalAuditorName: string;
    hasSanctionsScreeningProcess: boolean;
    pastGrantsTrackRecord: {
      id: string;
      donorName: string;
      amountUSD: number;
      year: number;
      status: 'completed' | 'ongoing';
    }[];
  };

  documents: {
    ndaNoObjectionLetterPdf: File | null;
    legalRegistrationStatutesPdf: File | null;
    organogramPdf: File | null;
    auditedFinancialStatements3YrsPdf?: File | null;
    financeAndProcurementManualsPdf?: File | null;
    bankAccountConfirmationPdf?: File | null;
  };
}

export type DocumentKey = keyof ReadinessApplication['documents'];

export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'];

export const POLICY_OPTIONS: { value: PolicyStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'draft', label: 'In draft' },
  { value: 'board_approved', label: 'Board approved' },
];

export const ENTITY_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'public', label: 'Public entity' },
  { value: 'private', label: 'Private entity' },
  { value: 'ngo_cso', label: 'NGO / civil society' },
  { value: 'regional', label: 'Regional organization' },
];

export const OBJECTIVE_OPTIONS: {
  value: ReadinessObjective;
  code: string;
  title: string;
  description: string;
  recommended?: boolean;
}[] = [
  {
    value: 'obj1_coordination',
    code: '01',
    title: 'NDA & climate finance coordination',
    description: 'Strengthen national coordination and climate finance governance.',
  },
  {
    value: 'obj2_frameworks',
    code: '02',
    title: 'Strategic frameworks',
    description: 'Country programmes, NAPs and other long-term planning instruments.',
  },
  {
    value: 'obj3_dae_capacity',
    code: '03',
    title: 'Direct Access Entity capacity',
    description:
      'Accreditation gap assessment and institutional strengthening for unaccredited entities.',
    recommended: true,
  },
  {
    value: 'obj4_pipeline',
    code: '04',
    title: 'Project pipeline & Concept Notes',
    description: 'Build a bankable pipeline and prepare early-stage concept notes.',
  },
  {
    value: 'obj5_knowledge',
    code: '05',
    title: 'Knowledge sharing & learning',
    description: 'Capture lessons, tools and peer-learning across institutions.',
  },
];

export const BUDGET_CATEGORY_OPTIONS: {
  value: BudgetCategory;
  label: string;
  short: string;
}[] = [
  { value: 'international_consultants', label: 'International consultants', short: 'Intl. consultants' },
  { value: 'national_consultants', label: 'National consultants', short: 'Natl. consultants' },
  { value: 'travel_per_diem', label: 'Travel & per diem', short: 'Travel' },
  { value: 'workshops_training', label: 'Workshops & training', short: 'Workshops' },
  { value: 'equipment_software', label: 'Equipment & software', short: 'Equipment' },
  { value: 'external_audit', label: 'External audit', short: 'Audit' },
  { value: 'project_management_costs', label: 'Project management costs', short: 'PMC' },
];

export const UNIT_TYPE_OPTIONS: { value: UnitType; label: string }[] = [
  { value: 'days', label: 'Days' },
  { value: 'months', label: 'Months' },
  { value: 'trips', label: 'Trips' },
  { value: 'workshops', label: 'Workshops' },
  { value: 'lump_sum', label: 'Lump sum' },
];

export const PROCUREMENT_OPTIONS: { value: ProcurementMethod; label: string }[] = [
  { value: 'competitive_bidding', label: 'Competitive bidding' },
  { value: 'three_quotes', label: 'Three quotes' },
  { value: 'direct_contracting', label: 'Direct contracting' },
  { value: 'not_applicable', label: 'Not applicable' },
];

export const ACCOUNTING_STANDARD_OPTIONS: { value: AccountingStandard; label: string }[] = [
  { value: 'IFRS', label: 'IFRS' },
  { value: 'IPSAS', label: 'IPSAS' },
  { value: 'National_GAAP', label: 'National GAAP' },
  { value: 'Cash_Basis', label: 'Cash basis' },
];

export const AUDIT_OPINION_OPTIONS: { value: AuditOpinion; label: string }[] = [
  { value: 'unqualified', label: 'Unqualified / clean' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'adverse', label: 'Adverse' },
  { value: 'disclaimed', label: 'Disclaimer of opinion' },
  { value: 'no_audits', label: 'No external audits' },
];

export const GAP_FIELDS: {
  key: keyof ReadinessApplication['institutionalProfile']['gapMatrix'];
  label: string;
  pillar: 'Fiduciary' | 'ESS' | 'Gender';
}[] = [
  { key: 'financialManagementPolicy', label: 'Financial management policy', pillar: 'Fiduciary' },
  { key: 'internalExternalAudit', label: 'Internal & external audit', pillar: 'Fiduciary' },
  { key: 'procurementPolicy', label: 'Procurement policy', pillar: 'Fiduciary' },
  { key: 'amlCftPolicy', label: 'AML / CFT policy', pillar: 'Fiduciary' },
  { key: 'whistleblowerPolicy', label: 'Whistleblower protection', pillar: 'Fiduciary' },
  { key: 'essManagementSystem', label: 'Environmental & social safeguards', pillar: 'ESS' },
  { key: 'grievanceMechanism', label: 'Grievance redress mechanism', pillar: 'ESS' },
  { key: 'genderPolicy', label: 'Gender policy', pillar: 'Gender' },
];

export function createEmptyApplication(): ReadinessApplication {
  return {
    metadata: {
      proposalTitle: '',
      country: '',
      organizationLegalName: '',
      entityType: 'public',
      requestedAmountUSD: 0,
      durationMonths: 24,
      readinessObjectives: [],
      ndaFocalPointName: '',
      ndaMinistry: '',
      ndaEmail: '',
      hasExternalDeliveryPartner: false,
      externalDeliveryPartnerName: '',
    },
    institutionalProfile: {
      registrationNumber: '',
      incorporationDate: '',
      staffCount: 0,
      annualOperatingBudgetUSD: 0,
      largestPreviousGrantUSD: 0,
      mandateSummary: '',
      gapMatrix: {
        financialManagementPolicy: 'none',
        internalExternalAudit: 'none',
        procurementPolicy: 'none',
        amlCftPolicy: 'none',
        whistleblowerPolicy: 'none',
        essManagementSystem: 'none',
        grievanceMechanism: 'none',
        genderPolicy: 'none',
      },
      identifiedGapsSummary: '',
    },
    narrative: {
      problemStatementAndBarriers: '',
      nationalAlignmentNdcNap: '',
      complementarityPastGrants: '',
      theoryOfChange: '',
      sustainabilityAndExitStrategy: '',
    },
    logframe: {
      outcomes: [
        {
          id: 'out_1',
          code: 'Outcome 1',
          description: '',
          indicator: '',
          baseline: '',
          target: '',
          meansOfVerification: '',
          outputs: [
            {
              id: 'out_1_out_1',
              code: 'Output 1.1',
              description: '',
              indicator: '',
              baseline: '',
              target: '',
              activities: [],
            },
          ],
        },
      ],
    },
    budget: {
      lineItems: [],
      disbursementTranches: [
        { trancheNumber: 1, milestoneDescription: '', amountUSD: 0, estimatedMonth: 1 },
      ],
    },
    fmca: createEmptyFmca(),
    documents: {
      ndaNoObjectionLetterPdf: null,
      legalRegistrationStatutesPdf: null,
      organogramPdf: null,
      auditedFinancialStatements3YrsPdf: null,
      financeAndProcurementManualsPdf: null,
      bankAccountConfirmationPdf: null,
    },
  };
}

export function createEmptyFmca(): NonNullable<ReadinessApplication['fmca']> {
  return {
    regulatoryAuthority: '',
    totalAssetsUSD: 0,
    hasOngoingLitigation: false,
    litigationDetails: '',
    hasIndependentAuditCommittee: false,
    accountingStandard: 'IFRS',
    accountingSoftwareName: '',
    canSegregateGcfFundsInSeparateAccount: false,
    hasDualSignatoryControls: false,
    past3YearsAuditOpinion: 'unqualified',
    externalAuditorName: '',
    hasSanctionsScreeningProcess: false,
    pastGrantsTrackRecord: [],
  };
}
