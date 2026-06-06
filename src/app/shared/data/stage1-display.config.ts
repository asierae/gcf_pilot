export interface DisplayField {
  key: string;
  label: string;
}

export interface DisplaySection {
  id: string;
  title: string;
  icon: string;
  fields: DisplayField[];
}

export const STAGE1_ALL_LABELS: Record<string, string> = {
  organizationType: 'Organization Type',
  nominationLetterAttached: 'Nomination Letter Attached',
  ndaEngagementDescription: 'NDA Engagement Description',
  consultationCountry: 'Consultation Country',
  consultationContactPerson: 'Consultation Contact Person',
  consultationMode: 'Mode of Consultation',
  consultationDates: 'Consultation Dates',
  ndaInstitution: 'NDA Institution',
  ndaContactPerson: 'NDA Contact Person',
  ndaContactInfo: 'NDA Contact Information',
  consultationSummary: 'Consultation Summary',
  applicantName: 'Applicant Name',
  applicantAcronym: 'Applicant Acronym',
  legalAddress: 'Legal Address',
  operationalAddress: 'Operational Address',
  website: 'Website',
  primaryContactName: 'Primary Contact',
  primaryContactEmail: 'Primary Contact Email',
  primaryContactPhone: 'Primary Contact Phone',
  secondaryContactName: 'Secondary Contact',
  secondaryContactEmail: 'Secondary Contact Email',
  secondaryContactPhone: 'Secondary Contact Phone',
  scopeOfOperations: 'Scope of Operations',
  scopeOfOperationsOther: 'Scope of Operations (Other)',
  typeOfEntity: 'Type of Entity',
  typeOfEntityOther: 'Type of Entity (Other)',
  headquartersCountry: 'Headquarters Country',
  incorporationCountry: 'Country of Legal Incorporation',
  hasLegalPersonality: 'Independent Legal Personality (2.1.1)',
  hasLegalCapacity: 'Legal Capacity with International Organizations (2.1.2)',
  canReceiveFundsDirectly: 'Receive Funds Directly (2.3.1)',
  canHandleGCFCurrencies: 'Handle GCF Currencies (2.3.2)',
  canMaintainInterestBearingAccount: 'Interest-Bearing Account (2.3.3)',
  canUndertakeFullCycle: 'Full Project Cycle (2.3.4)',
  fullCycleDescription: 'Full Cycle Approach Description',
  hasFiduciaryCapacity: 'Fiduciary Capacity (2.3.5)',
  hasESSCapacity: 'ESS Capacity (2.3.5)',
  hasGenderCapacity: 'Gender Capacity (2.3.5)',
  hasMonitoringCapacity: 'Monitoring Capacity (2.3.5)',
  businessMandate: 'Business Mandate (3.1.1)',
  hasClimateFinanceExperience: 'Climate Finance Experience (3.1.2)',
  climateFinanceOverview: 'Climate Finance Overview',
  hasTrackRecordInRegion: 'Track Record in Region',
  trackRecordOverview: 'Track Record Overview',
  fiduciaryLevel: 'Fiduciary Self-Assessment',
  projectManagementLevel: 'Project Management Self-Assessment',
  essLevel: 'ESS Self-Assessment',
  hasGrievanceMechanism: 'Grievance Mechanism',
  grievanceMechanismLevel: 'Grievance Mechanism Level',
  genderLevel: 'Gender Self-Assessment',
  monitoringLevel: 'Monitoring Self-Assessment',
  canEnsureDownstreamCompliance: 'Ensure Downstream Compliance (3.2.2a)',
  canMonitorCompliance: 'Monitor Compliance (3.2.2b)',
  accreditedByGEF: 'Accredited by GEF',
  accreditedByAF: 'Accredited by Adaptation Fund',
  accreditedByEUDGINTPA: 'Accredited by EU DG INTPA',
  fastTrackComplianceDetails: 'Fast-Track Compliance Details',
  hasReceivedReadinessSupport: 'GCF Readiness Support (3.4)',
  hasServedAsExecutingEntity: 'GCF Executing Entity (3.4)',
  executingEntityDetails: 'Executing Entity Details',
  hasServedAsDeliveryPartner: 'Delivery Partner (3.4)',
  hasEngagedInPSAA: 'PSAA Discussions (3.4)',
  preparedForPartnerships: 'Prepared for Partnerships (3.5)',
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
  organizationType: {
    government: 'Government or government-controlled direct access entity',
    'self-nominating-direct': 'Self-nominating direct access entity',
    'self-nominating-international': 'Self-nominating international access entity',
  },
  nominationLetterAttached: { yes: 'Yes, attached', later: 'Will submit later' },
  consultationMode: { email: 'Email', virtual: 'Virtual Meeting', 'in-person': 'In-person Meeting', other: 'Other' },
  scopeOfOperations: {
    international: 'International',
    regional: 'Regional',
    national: 'National',
    subnational: 'Subnational / Local',
    other: 'Other',
  },
  typeOfEntity: {
    'public-government': 'Public sector – Government',
    'public-controlled': 'Public sector – Government-controlled entity',
    private: 'Private sector',
    multilateral: 'Multilateral or international organization',
    'un-system': 'UN System Entity',
    'cso-ngo': 'CSO / NGO',
    academic: 'Academic / Research institution',
    other: 'Other',
  },
  fiduciaryLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
  projectManagementLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
  essLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
  grievanceMechanismLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
  genderLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
  monitoringLevel: { established: 'Established', developing: 'Developing', foundational: 'Foundational' },
};

const YES_NO_KEYS = new Set([
  'hasLegalPersonality', 'hasLegalCapacity', 'canReceiveFundsDirectly', 'canHandleGCFCurrencies',
  'canMaintainInterestBearingAccount', 'canUndertakeFullCycle', 'hasFiduciaryCapacity', 'hasESSCapacity',
  'hasGenderCapacity', 'hasMonitoringCapacity', 'hasClimateFinanceExperience', 'hasTrackRecordInRegion',
  'hasGrievanceMechanism', 'canEnsureDownstreamCompliance', 'canMonitorCompliance',
  'hasReceivedReadinessSupport', 'hasServedAsExecutingEntity', 'hasServedAsDeliveryPartner',
  'hasEngagedInPSAA', 'preparedForPartnerships',
]);

const BOOLEAN_KEYS = new Set(['accreditedByGEF', 'accreditedByAF', 'accreditedByEUDGINTPA']);

export const STAGE1_DISPLAY_SECTIONS: DisplaySection[] = [
  {
    id: 'access-modality',
    title: 'Access Modality',
    icon: '🌐',
    fields: [
      { key: 'organizationType', label: STAGE1_ALL_LABELS['organizationType'] },
      { key: 'nominationLetterAttached', label: STAGE1_ALL_LABELS['nominationLetterAttached'] },
      { key: 'ndaEngagementDescription', label: STAGE1_ALL_LABELS['ndaEngagementDescription'] },
      { key: 'consultationCountry', label: STAGE1_ALL_LABELS['consultationCountry'] },
      { key: 'consultationContactPerson', label: STAGE1_ALL_LABELS['consultationContactPerson'] },
      { key: 'consultationMode', label: STAGE1_ALL_LABELS['consultationMode'] },
      { key: 'consultationDates', label: STAGE1_ALL_LABELS['consultationDates'] },
      { key: 'ndaInstitution', label: STAGE1_ALL_LABELS['ndaInstitution'] },
      { key: 'ndaContactPerson', label: STAGE1_ALL_LABELS['ndaContactPerson'] },
      { key: 'ndaContactInfo', label: STAGE1_ALL_LABELS['ndaContactInfo'] },
      { key: 'consultationSummary', label: STAGE1_ALL_LABELS['consultationSummary'] },
    ],
  },
  {
    id: 'general-information',
    title: 'General Information',
    icon: '📋',
    fields: [
      { key: 'applicantName', label: STAGE1_ALL_LABELS['applicantName'] },
      { key: 'applicantAcronym', label: STAGE1_ALL_LABELS['applicantAcronym'] },
      { key: 'legalAddress', label: STAGE1_ALL_LABELS['legalAddress'] },
      { key: 'operationalAddress', label: STAGE1_ALL_LABELS['operationalAddress'] },
      { key: 'website', label: STAGE1_ALL_LABELS['website'] },
      { key: 'primaryContactName', label: STAGE1_ALL_LABELS['primaryContactName'] },
      { key: 'primaryContactEmail', label: STAGE1_ALL_LABELS['primaryContactEmail'] },
      { key: 'primaryContactPhone', label: STAGE1_ALL_LABELS['primaryContactPhone'] },
      { key: 'secondaryContactName', label: STAGE1_ALL_LABELS['secondaryContactName'] },
      { key: 'secondaryContactEmail', label: STAGE1_ALL_LABELS['secondaryContactEmail'] },
      { key: 'secondaryContactPhone', label: STAGE1_ALL_LABELS['secondaryContactPhone'] },
      { key: 'scopeOfOperations', label: STAGE1_ALL_LABELS['scopeOfOperations'] },
      { key: 'scopeOfOperationsOther', label: STAGE1_ALL_LABELS['scopeOfOperationsOther'] },
      { key: 'typeOfEntity', label: STAGE1_ALL_LABELS['typeOfEntity'] },
      { key: 'typeOfEntityOther', label: STAGE1_ALL_LABELS['typeOfEntityOther'] },
      { key: 'areaOfOperation', label: 'Area of Operation' },
      { key: 'headquartersCountry', label: STAGE1_ALL_LABELS['headquartersCountry'] },
      { key: 'incorporationCountry', label: STAGE1_ALL_LABELS['incorporationCountry'] },
    ],
  },
  {
    id: 'legal-status',
    title: 'Legal Status & Eligibility',
    icon: '⚖️',
    fields: [
      { key: 'hasLegalPersonality', label: STAGE1_ALL_LABELS['hasLegalPersonality'] },
      { key: 'hasLegalCapacity', label: STAGE1_ALL_LABELS['hasLegalCapacity'] },
      { key: 'canReceiveFundsDirectly', label: STAGE1_ALL_LABELS['canReceiveFundsDirectly'] },
      { key: 'canHandleGCFCurrencies', label: STAGE1_ALL_LABELS['canHandleGCFCurrencies'] },
      { key: 'canMaintainInterestBearingAccount', label: STAGE1_ALL_LABELS['canMaintainInterestBearingAccount'] },
      { key: 'canUndertakeFullCycle', label: STAGE1_ALL_LABELS['canUndertakeFullCycle'] },
      { key: 'fullCycleDescription', label: STAGE1_ALL_LABELS['fullCycleDescription'] },
      { key: 'hasFiduciaryCapacity', label: STAGE1_ALL_LABELS['hasFiduciaryCapacity'] },
      { key: 'hasESSCapacity', label: STAGE1_ALL_LABELS['hasESSCapacity'] },
      { key: 'hasGenderCapacity', label: STAGE1_ALL_LABELS['hasGenderCapacity'] },
      { key: 'hasMonitoringCapacity', label: STAGE1_ALL_LABELS['hasMonitoringCapacity'] },
    ],
  },
  {
    id: 'additional-information',
    title: 'Additional Information',
    icon: '📊',
    fields: [
      { key: 'businessMandate', label: STAGE1_ALL_LABELS['businessMandate'] },
      { key: 'hasClimateFinanceExperience', label: STAGE1_ALL_LABELS['hasClimateFinanceExperience'] },
      { key: 'climateFinanceOverview', label: STAGE1_ALL_LABELS['climateFinanceOverview'] },
      { key: 'hasTrackRecordInRegion', label: STAGE1_ALL_LABELS['hasTrackRecordInRegion'] },
      { key: 'trackRecordOverview', label: STAGE1_ALL_LABELS['trackRecordOverview'] },
      { key: 'fiduciaryLevel', label: STAGE1_ALL_LABELS['fiduciaryLevel'] },
      { key: 'projectManagementLevel', label: STAGE1_ALL_LABELS['projectManagementLevel'] },
      { key: 'essLevel', label: STAGE1_ALL_LABELS['essLevel'] },
      { key: 'hasGrievanceMechanism', label: STAGE1_ALL_LABELS['hasGrievanceMechanism'] },
      { key: 'grievanceMechanismLevel', label: STAGE1_ALL_LABELS['grievanceMechanismLevel'] },
      { key: 'genderLevel', label: STAGE1_ALL_LABELS['genderLevel'] },
      { key: 'monitoringLevel', label: STAGE1_ALL_LABELS['monitoringLevel'] },
      { key: 'canEnsureDownstreamCompliance', label: STAGE1_ALL_LABELS['canEnsureDownstreamCompliance'] },
      { key: 'canMonitorCompliance', label: STAGE1_ALL_LABELS['canMonitorCompliance'] },
    ],
  },
  {
    id: 'fast-track',
    title: 'Fast-Track & Engagement',
    icon: '🚀',
    fields: [
      { key: 'accreditedByGEF', label: STAGE1_ALL_LABELS['accreditedByGEF'] },
      { key: 'accreditedByAF', label: STAGE1_ALL_LABELS['accreditedByAF'] },
      { key: 'accreditedByEUDGINTPA', label: STAGE1_ALL_LABELS['accreditedByEUDGINTPA'] },
      { key: 'fastTrackComplianceDetails', label: STAGE1_ALL_LABELS['fastTrackComplianceDetails'] },
      { key: 'hasReceivedReadinessSupport', label: STAGE1_ALL_LABELS['hasReceivedReadinessSupport'] },
      { key: 'hasServedAsExecutingEntity', label: STAGE1_ALL_LABELS['hasServedAsExecutingEntity'] },
      { key: 'executingEntityDetails', label: STAGE1_ALL_LABELS['executingEntityDetails'] },
      { key: 'hasServedAsDeliveryPartner', label: STAGE1_ALL_LABELS['hasServedAsDeliveryPartner'] },
      { key: 'hasEngagedInPSAA', label: STAGE1_ALL_LABELS['hasEngagedInPSAA'] },
      { key: 'preparedForPartnerships', label: STAGE1_ALL_LABELS['preparedForPartnerships'] },
    ],
  },
];

export function formatStage1Value(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '';
  }

  if (key === 'areaOfOperation' && typeof value === 'object' && value !== null) {
    const areas = value as Record<string, boolean>;
    const labels: Record<string, string> = {
      developingCountries: 'Developing countries',
      leastDevelopedCountries: 'Least developed countries',
      smallIslandDevelopingStates: 'Small island developing states',
      developedCountries: 'Developed countries',
    };
    const selected = Object.entries(areas)
      .filter(([, v]) => v)
      .map(([k]) => labels[k] ?? k);
    return selected.length ? selected.join(', ') : '';
  }

  if (BOOLEAN_KEYS.has(key)) {
    return value ? 'Yes' : 'No';
  }

  if (YES_NO_KEYS.has(key) && typeof value === 'string') {
    return value === 'yes' ? 'Yes' : value === 'no' ? 'No' : String(value);
  }

  const map = VALUE_LABELS[key];
  if (map && typeof value === 'string' && map[value]) {
    return map[value];
  }

  return String(value);
}

export function hasDisplayValue(key: string, data: Record<string, unknown>): boolean {
  const value = data[key];
  if (key === 'areaOfOperation' && typeof value === 'object' && value !== null) {
    return Object.values(value as Record<string, boolean>).some(Boolean);
  }
  if (typeof value === 'boolean') {
    return value;
  }
  return value !== null && value !== undefined && value !== '';
}

export function getSubmissionSummary(data: Record<string, unknown>) {
  return {
    applicantName: (data['applicantName'] as string) || '—',
    acronym: (data['applicantAcronym'] as string) || '—',
    organizationType: formatStage1Value('organizationType', data['organizationType']) || '—',
    contactEmail: (data['primaryContactEmail'] as string) || '—',
    headquarters: (data['headquartersCountry'] as string) || '—',
    scope: formatStage1Value('scopeOfOperations', data['scopeOfOperations']) || '—',
  };
}
