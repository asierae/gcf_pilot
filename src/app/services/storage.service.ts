import { Injectable } from '@angular/core';

export interface FormSubmission {
  id: string;
  date: string;
  data: Record<string, unknown>;
}

export type SubmissionStatus = 'Pending' | 'Passed' | 'Failed';

export const SUBMISSION_STATUSES: SubmissionStatus[] = ['Pending', 'Passed', 'Failed'];

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
  'hasServedAsDeliveryPartner', 'hasEngagedInPSAA', 'preparedForPartnerships'
];

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STAGE1_KEY = 'gcf_stage1_submissions';
  private readonly STAGE2_KEY = 'gcf_stage2_submissions';
  private readonly REVIEW_NOTES_KEY = 'gcf_submission_review_notes';
  private readonly REVIEW_SENT_KEY = 'gcf_submission_review_sent';
  private readonly STATUS_KEY = 'gcf_submission_status';

  saveStage1Submission(data: Record<string, unknown>): void {
    const submissions = this.getStage1Submissions();
    submissions.push({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      data
    });
    localStorage.setItem(this.STAGE1_KEY, JSON.stringify(submissions));
  }

  getStage1Submissions(): FormSubmission[] {
    const data = localStorage.getItem(this.STAGE1_KEY);
    return data ? JSON.parse(data) : [];
  }

  getLatestStage1Submission(): FormSubmission | null {
    const submissions = this.getStage1Submissions();
    return submissions.length ? submissions[submissions.length - 1] : null;
  }

  getStage1SubmissionById(id: string): FormSubmission | null {
    return this.getStage1Submissions().find((s) => s.id === id) ?? null;
  }

  getSubmissionStatus(submissionId: string): SubmissionStatus {
    const all = this.getAllSubmissionStatuses();
    return all[submissionId] ?? 'Pending';
  }

  setSubmissionStatus(submissionId: string, status: SubmissionStatus): void {
    const all = this.getAllSubmissionStatuses();
    all[submissionId] = status;
    localStorage.setItem(this.STATUS_KEY, JSON.stringify(all));
  }

  deleteStage1Submissions(ids: string[]): void {
    if (!ids.length) {
      return;
    }

    const idSet = new Set(ids);
    const submissions = this.getStage1Submissions().filter((s) => !idSet.has(s.id));
    localStorage.setItem(this.STAGE1_KEY, JSON.stringify(submissions));

    const notes = this.getAllReviewNotes();
    const sent = this.getAllReviewSentLog();
    const statuses = this.getAllSubmissionStatuses();

    for (const id of ids) {
      delete notes[id];
      delete sent[id];
      delete statuses[id];
    }

    localStorage.setItem(this.REVIEW_NOTES_KEY, JSON.stringify(notes));
    localStorage.setItem(this.REVIEW_SENT_KEY, JSON.stringify(sent));
    localStorage.setItem(this.STATUS_KEY, JSON.stringify(statuses));
  }

  saveStage2Submission(data: Record<string, unknown>): void {
    const submissions = this.getStage2Submissions();
    submissions.push({
      id: Date.now().toString(),
      date: new Date().toISOString(),
      data
    });
    localStorage.setItem(this.STAGE2_KEY, JSON.stringify(submissions));
  }

  getStage2Submissions(): FormSubmission[] {
    const data = localStorage.getItem(this.STAGE2_KEY);
    return data ? JSON.parse(data) : [];
  }

  getLatestStage2Submission(): FormSubmission | null {
    const submissions = this.getStage2Submissions();
    return submissions.length ? submissions[submissions.length - 1] : null;
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

  getSubmissionReviewNotes(submissionId: string): Record<string, string> {
    const all = this.getAllReviewNotes();
    return all[submissionId] ?? {};
  }

  saveSubmissionReviewNote(submissionId: string, sectionId: string, note: string): void {
    const all = this.getAllReviewNotes();
    if (!all[submissionId]) {
      all[submissionId] = {};
    }
    all[submissionId][sectionId] = note;
    localStorage.setItem(this.REVIEW_NOTES_KEY, JSON.stringify(all));
  }

  getLastReviewSentAt(submissionId: string): string | null {
    const all = this.getAllReviewSentLog();
    return all[submissionId]?.sentAt ?? null;
  }

  markReviewSent(submissionId: string, recipient: string): void {
    const all = this.getAllReviewSentLog();
    all[submissionId] = {
      sentAt: new Date().toISOString(),
      recipient
    };
    localStorage.setItem(this.REVIEW_SENT_KEY, JSON.stringify(all));
  }

  private getAllReviewNotes(): Record<string, Record<string, string>> {
    const data = localStorage.getItem(this.REVIEW_NOTES_KEY);
    return data ? JSON.parse(data) : {};
  }

  private getAllReviewSentLog(): Record<string, { sentAt: string; recipient: string }> {
    const data = localStorage.getItem(this.REVIEW_SENT_KEY);
    return data ? JSON.parse(data) : {};
  }

  private getAllSubmissionStatuses(): Record<string, SubmissionStatus> {
    const data = localStorage.getItem(this.STATUS_KEY);
    return data ? JSON.parse(data) : {};
  }
}
