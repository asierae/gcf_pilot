import { FormGroup } from '@angular/forms';

export const STAGE1_FIELD_LABELS: Record<string, string> = {
  organizationType: 'Organization Type',
  consultationCountry: 'NDA Consultation Country',
  consultationContactPerson: 'NDA Consultation Contact',
  consultationMode: 'NDA Consultation Mode',
  consultationDates: 'NDA Consultation Date',
  ndaInstitution: 'NDA Institution',
  ndaContactPerson: 'NDA Contact Person',
  ndaContactInfo: 'NDA Contact Information',
  consultationSummary: 'NDA Consultation Summary',
  applicantName: 'Applicant Name',
  applicantAcronym: 'Applicant Acronym',
  legalAddress: 'Legal Address',
  website: 'Website',
  primaryContactName: 'Primary Contact Name',
  primaryContactEmail: 'Primary Contact Email',
  primaryContactPhone: 'Primary Contact Phone',
  scopeOfOperations: 'Scope of Operations',
  typeOfEntity: 'Type of Entity',
  countryOfOperation: 'Country of Operation',
  hqLocation: 'Headquarters Location',
  registeredAddress: 'Registered Office Address',
  primaryContactTitle: 'Primary Contact Title',
  groupedOrganization: 'Group Structure',
  groupDetails: 'Group Details (1.2)',
  headquartersCountry: 'Headquarters Country',
  incorporationCountry: 'Country of Legal Incorporation',
  hasLegalPersonality: 'Legal Personality (2.1.1)',
  hasLegalCapacity: 'Legal Capacity (2.1.2)',
  canReceiveFundsDirectly: 'Receive Funds Directly (2.3.1)',
  canHandleGCFCurrencies: 'GCF Currencies (2.3.2)',
  canMaintainInterestBearingAccount: 'Interest-Bearing Account (2.3.3)',
  canUndertakeFullCycle: 'Full Project Cycle (2.3.4)',
  hasFiduciaryCapacity: 'Fiduciary Capacity (2.3.5)',
  hasESSCapacity: 'ESS Capacity (2.3.5)',
  hasGenderCapacity: 'Gender Capacity (2.3.5)',
  hasMonitoringCapacity: 'Monitoring Capacity (2.3.5)',
  businessMandate: 'Business Mandate (3.1.1)',
  hasClimateFinanceExperience: 'Climate Finance Experience (3.1.2)',
  climateFinanceOverview: 'Climate Finance Track Record (3.1.2)',
  hasTrackRecordInRegion: 'Track Record in Region (3.1.3)',
  trackRecordOverview: 'Regional Track Record (3.1.3)',
  financingInstruments: 'Financing Instruments (3.1.4)',
  climatePriorities: 'Climate Priorities (3.1.5)',
  fiduciaryLevel: 'Fiduciary Self-Assessment',
  projectManagementLevel: 'Project/Programme Management Self-Assessment',
  essLevel: 'ESS Self-Assessment',
  hasGrievanceMechanism: 'Grievance Mechanism',
  genderLevel: 'Gender Self-Assessment',
  monitoringLevel: 'Monitoring Self-Assessment',
  canEnsureDownstreamCompliance: 'Downstream Compliance (3.2.2a)',
  canMonitorCompliance: 'Monitor Compliance (3.2.2b)',
  riskCategory: 'E&S Risk Category (3.2.3)',
  hasESMS: 'Environmental & Social Management System (3.2.3)',
  fastTrack: 'Fast-Track Eligibility (3.3)',
  fastTrackCredentials: 'Fast-Track Compliance Details (3.3)',
  hasReceivedReadinessSupport: 'GCF Readiness Support (3.4)',
  hasServedAsExecutingEntity: 'Executing Entity (3.4)',
  executingEntityDetails: 'Executing Entity Projects (3.4)',
  hasServedAsDeliveryPartner: 'Delivery Partner (3.4)',
  hasEngagedInPSAA: 'PSAA Discussions (3.4)',
  preparedForPartnerships: 'Partnerships (3.5)',
};

export const STAGE1_FIELD_STEPS: Record<string, number> = {
  organizationType: 0,
  consultationCountry: 0,
  consultationContactPerson: 0,
  consultationMode: 0,
  consultationDates: 0,
  ndaInstitution: 0,
  ndaContactPerson: 0,
  ndaContactInfo: 0,
  consultationSummary: 0,
  applicantName: 1,
  applicantAcronym: 1,
  legalAddress: 1,
  website: 1,
  primaryContactName: 1,
  primaryContactEmail: 1,
  primaryContactPhone: 1,
  scopeOfOperations: 1,
  typeOfEntity: 1,
  countryOfOperation: 1,
  hqLocation: 1,
  registeredAddress: 1,
  primaryContactTitle: 1,
  groupedOrganization: 1,
  groupDetails: 1,
  headquartersCountry: 1,
  incorporationCountry: 1,
  hasLegalPersonality: 2,
  hasLegalCapacity: 2,
  canReceiveFundsDirectly: 2,
  canHandleGCFCurrencies: 2,
  canMaintainInterestBearingAccount: 2,
  canUndertakeFullCycle: 2,
  fullCycleDescription: 2,
  hasFiduciaryCapacity: 2,
  hasESSCapacity: 2,
  hasGenderCapacity: 2,
  hasMonitoringCapacity: 2,
  businessMandate: 3,
  hasClimateFinanceExperience: 3,
  climateFinanceOverview: 3,
  hasTrackRecordInRegion: 3,
  trackRecordOverview: 3,
  financingInstruments: 3,
  climatePriorities: 3,
  fiduciaryLevel: 3,
  projectManagementLevel: 3,
  essLevel: 3,
  hasGrievanceMechanism: 3,
  genderLevel: 3,
  monitoringLevel: 3,
  canEnsureDownstreamCompliance: 3,
  canMonitorCompliance: 3,
  riskCategory: 3,
  hasESMS: 3,
  fastTrack: 4,
  fastTrackCredentials: 4,
  hasReceivedReadinessSupport: 4,
  hasServedAsExecutingEntity: 4,
  executingEntityDetails: 4,
  hasServedAsDeliveryPartner: 4,
  hasEngagedInPSAA: 4,
  preparedForPartnerships: 4,
};

export interface InvalidFieldInfo {
  key: string;
  label: string;
  step: number;
  error: string;
}

export function collectInvalidFields(
  form: FormGroup,
  labels: Record<string, string> = STAGE1_FIELD_LABELS,
  steps: Record<string, number> = STAGE1_FIELD_STEPS
): InvalidFieldInfo[] {
  const invalid: InvalidFieldInfo[] = [];

  for (const key of Object.keys(form.controls)) {
    const control = form.get(key);
    if (!control || !control.invalid) {
      continue;
    }

    if (control instanceof FormGroup) {
      continue;
    }

    let error = 'Required';
    if (control.errors?.['email']) {
      error = 'Invalid email';
    } else if (control.errors?.['required']) {
      error = 'Required';
    }

    invalid.push({
      key,
      label: labels[key] ?? key,
      step: steps[key] ?? 0,
      error
    });
  }

  return invalid.sort((a, b) => a.step - b.step || a.label.localeCompare(b.label));
}

export function buildMissingFieldsMessage(fields: InvalidFieldInfo[], maxListed = 6): string {
  if (fields.length === 0) {
    return 'Please fill in all required fields before submitting.';
  }

  const listed = fields.slice(0, maxListed).map((f) => {
    const suffix = f.error === 'Required' ? '' : ` (${f.error})`;
    return `${f.label}${suffix}`;
  });

  const remaining = fields.length - listed.length;
  const listText = listed.join(', ');

  if (remaining > 0) {
    return `You still need to complete ${fields.length} required fields: ${listText} and ${remaining} more.`;
  }

  return `You still need to complete: ${listText}.`;
}

export function markAllControlsTouched(form: FormGroup): void {
  Object.values(form.controls).forEach((control) => {
    control.markAsTouched();
    if (control instanceof FormGroup) {
      markAllControlsTouched(control);
    }
  });
}
