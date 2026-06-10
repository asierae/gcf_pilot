import { Injectable } from '@angular/core';
import { ApplicantRecord, LeadRecord, SubmissionStatus } from '../models/applicant.model';
export type { ApplicantRecord, LeadRecord, SubmissionStatus } from '../models/applicant.model';
export { SUBMISSION_STATUSES } from '../models/applicant.model';
import { FirebaseService } from './firebase.service';

export interface FormSubmission {
  id: string;
  date: string;
  data: Record<string, unknown>;
}

const STAGE1_FIELD_KEYS = [
  'organizationType', 'nominationLetterAttached', 'ndaEngagementDescription',
  'consultationCountry', 'consultationContactPerson', 'consultationMode',
  'consultationDates', 'ndaInstitution', 'ndaContactPerson', 'ndaContactInfo',
  'consultationSummary', 'applicantName', 'applicantAcronym', 'legalAddress',
  'operationalAddress', 'website', 'primaryContactName', 'primaryContactEmail',
  'primaryContactPhone', 'secondaryContactName', 'secondaryContactEmail',
  'secondaryContactPhone', 'scopeOfOperations', 'scopeOfOperationsOther',
  'typeOfEntity', 'typeOfEntityOther', 'areaOfOperation', 'headquartersCountry',
  'incorporationCountry', 'hasLegalPersonality', 'hasLegalCapacity',
  'canReceiveFundsDirectly', 'canHandleGCFCurrencies', 'canMaintainInterestBearingAccount',
  'canUndertakeFullCycle', 'fullCycleDescription', 'hasFiduciaryCapacity',
  'hasESSCapacity', 'hasGenderCapacity', 'hasMonitoringCapacity', 'businessMandate',
  'hasClimateFinanceExperience', 'climateFinanceOverview', 'hasTrackRecordInRegion',
  'trackRecordOverview', 'fiduciaryLevel', 'projectManagementLevel', 'essLevel',
  'hasGrievanceMechanism', 'grievanceMechanismLevel', 'genderLevel', 'monitoringLevel',
  'canEnsureDownstreamCompliance', 'canMonitorCompliance', 'accreditedByGEF',
  'accreditedByAF', 'accreditedByEUDGINTPA', 'fastTrackComplianceDetails',
  'hasReceivedReadinessSupport', 'hasServedAsExecutingEntity', 'executingEntityDetails',
  'hasServedAsDeliveryPartner', 'hasEngagedInPSAA', 'preparedForPartnerships',
  'nominationLetterFiles', 'consultationSummaryFiles', 'legalSupportingDocumentsFiles',
  'fastTrackAccreditationFiles'
];

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  constructor(private firebaseService: FirebaseService) {}

  async saveStage1Submission(data: Record<string, unknown>): Promise<void> {
    await this.firebaseService.createApplicantStage1(data);
  }

  async getStage1Submissions(): Promise<FormSubmission[]> {
    const { submissions } = await this.loadDashboardData();
    return submissions;
  }

  async loadDashboardData(): Promise<{
    submissions: FormSubmission[];
    statusById: Record<string, SubmissionStatus>;
  }> {
    const applicants = await this.firebaseService.getAllApplicants();
    const submissions: FormSubmission[] = [];
    const statusById: Record<string, SubmissionStatus> = {};

    for (const applicant of applicants) {
      const submission = this.toStage1Submission(applicant);
      if (submission) {
        submissions.push(submission);
        statusById[applicant.id] = applicant.admin.status;
      }
    }

    return { submissions, statusById };
  }

  async getLatestStage1Submission(): Promise<FormSubmission | null> {
    const applicant = await this.firebaseService.getLatestApplicantWithStage1();
    return applicant ? this.toStage1Submission(applicant) : null;
  }

  async getStage1SubmissionById(id: string): Promise<FormSubmission | null> {
    const applicant = await this.firebaseService.getApplicantById(id);
    if (!applicant) {
      return null;
    }

    return this.toStage1Submission(applicant);
  }

  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus> {
    const applicant = await this.firebaseService.getApplicantById(submissionId);
    return applicant?.admin.status ?? 'Pending';
  }

  async setSubmissionStatus(submissionId: string, status: SubmissionStatus): Promise<void> {
    await this.firebaseService.updateApplicantStatus(submissionId, status);
  }

  async deleteStage1Submissions(ids: string[]): Promise<void> {
    await this.firebaseService.deleteApplicants(ids);
  }

  async saveStage2Submission(data: Record<string, unknown>): Promise<void> {
    const stage1Data = this.extractStage1Data(data);
    await this.firebaseService.createApplicantStage2(data, stage1Data);
  }

  async getStage2Submissions(): Promise<FormSubmission[]> {
    const applicants = await this.firebaseService.getAllApplicants();
    return applicants
      .map((applicant) => this.toStage2Submission(applicant))
      .filter((submission): submission is FormSubmission => submission !== null);
  }

  async getLatestStage2Submission(): Promise<FormSubmission | null> {
    const applicant = await this.firebaseService.getLatestApplicantWithStage2();
    return applicant ? this.toStage2Submission(applicant) : null;
  }

  extractStage1Data(data: Record<string, unknown>): Record<string, unknown> {
    const stage1Data: Record<string, unknown> = {};
    for (const key of STAGE1_FIELD_KEYS) {
      if (key in data) {
        stage1Data[key] = data[key];
      }
    }
    return stage1Data;
  }

  async getSubmissionReviewNotes(submissionId: string): Promise<Record<string, string>> {
    const applicant = await this.firebaseService.getApplicantById(submissionId);
    return applicant?.admin.reviewNotes ?? {};
  }

  async saveSubmissionReviewNote(submissionId: string, sectionId: string, note: string): Promise<void> {
    await this.firebaseService.updateApplicantReviewNote(submissionId, sectionId, note);
  }

  async getLastReviewSentAt(submissionId: string): Promise<string | null> {
    const applicant = await this.firebaseService.getApplicantById(submissionId);
    return applicant?.admin.lastReviewSent?.sentAt ?? null;
  }

  async markReviewSent(submissionId: string, recipient: string): Promise<void> {
    await this.firebaseService.markApplicantReviewSent(submissionId, recipient);
  }

  async getApplicantRecord(id: string): Promise<ApplicantRecord | null> {
    return this.firebaseService.getApplicantById(id);
  }

  async getLatestApplicantData(): Promise<Record<string, unknown>> {
    const stage2 = await this.getLatestStage2Submission();
    if (stage2?.data) {
      return stage2.data;
    }

    const stage1 = await this.getLatestStage1Submission();
    return stage1?.data ?? {};
  }

  async getLeads(): Promise<LeadRecord[]> {
    return this.firebaseService.getAllLeads();
  }

  async saveLeads(leads: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<LeadRecord[]> {
    return this.firebaseService.createLeads(leads);
  }

  async updateLead(id: string, lead: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await this.firebaseService.updateLead(id, lead);
  }

  async deleteLeads(ids: string[]): Promise<void> {
    await this.firebaseService.deleteLeads(ids);
  }

  private toStage1Submission(applicant: ApplicantRecord): FormSubmission | null {
    if (!applicant.stage1) {
      return null;
    }

    return {
      id: applicant.id,
      date: applicant.stage1.submittedAt,
      data: applicant.stage1.data
    };
  }

  private toStage2Submission(applicant: ApplicantRecord): FormSubmission | null {
    if (!applicant.stage2) {
      return null;
    }

    return {
      id: applicant.id,
      date: applicant.stage2.submittedAt,
      data: applicant.stage2.data
    };
  }
}
