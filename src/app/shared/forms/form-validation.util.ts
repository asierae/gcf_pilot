import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

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
  hasInvestmentCriteria: 'Investment Criteria (2.2.1)',
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
  hasInvestmentCriteria: 2,
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
  fastTrack: 3,
  fastTrackCredentials: 3,
  hasReceivedReadinessSupport: 3,
  hasServedAsExecutingEntity: 3,
  executingEntityDetails: 3,
  hasServedAsDeliveryPartner: 3,
  hasEngagedInPSAA: 3,
  preparedForPartnerships: 3,
};

export interface InvalidLeaf {
  /** Dotted path, e.g. `climateTrackRecord.0.projectTitle`. */
  path: string;
  /** Leaf control name, without array indices. */
  key: string;
  /** 1-based row number when the control lives inside a FormArray. */
  row?: number;
  /** `required`, `email` or `invalid`. */
  error: string;
}

/**
 * Walks the whole form (including FormArrays) and returns one entry per invalid
 * leaf control. Valid groups are skipped, so this stays cheap on large forms.
 */
export function collectInvalidLeaves(
  control: AbstractControl,
  path: string[] = []
): InvalidLeaf[] {
  if (control.valid) {
    return [];
  }

  if (control instanceof FormArray || control instanceof FormGroup) {
    const entries = Object.entries(control.controls);
    return entries.flatMap(([key, child]) =>
      collectInvalidLeaves(child, [...path, key])
    );
  }

  const key = path[path.length - 1] ?? '';
  const parent = path.length > 1 ? Number(path[path.length - 2]) : NaN;
  const error = control.errors?.['email']
    ? 'email'
    : control.errors?.['required']
      ? 'required'
      : 'invalid';

  return [
    {
      path: path.join('.'),
      key,
      row: Number.isInteger(parent) ? parent + 1 : undefined,
      error
    }
  ];
}

export function markAllControlsTouched(form: FormGroup): void {
  Object.values(form.controls).forEach((control) => {
    control.markAsTouched();
    if (control instanceof FormGroup) {
      markAllControlsTouched(control);
    } else if (control instanceof FormArray) {
      control.controls.forEach((child) => {
        child.markAsTouched();
        if (child instanceof FormGroup) {
          markAllControlsTouched(child);
        }
      });
    }
  });
}
