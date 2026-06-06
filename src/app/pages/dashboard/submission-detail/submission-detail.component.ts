import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormSubmission,
  StorageService,
  SUBMISSION_STATUSES,
  SubmissionStatus
} from '../../../services/storage.service';
import { NotificationService } from '../../../services/notification.service';
import { EmailService } from '../../../services/email.service';
import {
  DisplaySection,
  STAGE1_DISPLAY_SECTIONS,
  formatStage1Value,
  hasDisplayValue
} from '../../../shared/data/stage1-display.config';

@Component({
  selector: 'app-submission-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './submission-detail.component.html',
  styleUrl: './submission-detail.component.css'
})
export class SubmissionDetailComponent implements OnInit {
  submission: FormSubmission | null = null;
  sections = STAGE1_DISPLAY_SECTIONS;
  sectionNotes: Record<string, string> = {};
  lastSentAt: string | null = null;
  status: SubmissionStatus = 'Pending';
  readonly statusOptions = SUBMISSION_STATUSES;

  constructor(
    private route: ActivatedRoute,
    private storageService: StorageService,
    private notificationService: NotificationService,
    public emailService: EmailService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.submission = this.storageService.getStage1SubmissionById(id);
      if (this.submission) {
        this.sectionNotes = { ...this.storageService.getSubmissionReviewNotes(id) };
        this.lastSentAt = this.storageService.getLastReviewSentAt(id);
        this.status = this.storageService.getSubmissionStatus(id);
      }
    }
  }

  getStatusClass(): string {
    return `status-select status-${this.status.toLowerCase()}`;
  }

  onStatusChange(event: Event): void {
    if (!this.submission) {
      return;
    }

    const value = (event.target as HTMLSelectElement).value as SubmissionStatus;
    this.storageService.setSubmissionStatus(this.submission.id, value);
    this.status = value;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  getValue(key: string): string {
    if (!this.submission) {
      return '';
    }
    return formatStage1Value(key, this.submission.data[key]);
  }

  hasValue(key: string): boolean {
    if (!this.submission) {
      return false;
    }
    return hasDisplayValue(key, this.submission.data);
  }

  sectionHasValues(sectionIndex: number): boolean {
    const section = this.sections[sectionIndex];
    return section.fields.some((f: { key: string }) => this.hasValue(f.key));
  }

  getNote(sectionId: string): string {
    return this.sectionNotes[sectionId] ?? '';
  }

  onNoteInput(sectionId: string, event: Event): void {
    if (!this.submission) {
      return;
    }
    const value = (event.target as HTMLTextAreaElement).value;
    this.sectionNotes[sectionId] = value;
    this.storageService.saveSubmissionReviewNote(this.submission.id, sectionId, value);
  }

  hasAnyNotes(): boolean {
    return this.sections.some((s) => (this.sectionNotes[s.id] ?? '').trim().length > 0);
  }

  sending = false;

  async sendToApplicant(): Promise<void> {
    if (!this.submission || this.sending) {
      return;
    }

    const recipient = (this.submission.data['primaryContactEmail'] as string)?.trim();
    if (!recipient) {
      this.notificationService.error('No applicant email found in this submission.');
      return;
    }

    if (!this.hasAnyNotes()) {
      this.notificationService.warning('Add at least one review note before sending to the applicant.');
      return;
    }

    const applicantName = (this.submission.data['applicantName'] as string) || 'Applicant';
    const contactName = (this.submission.data['primaryContactName'] as string) || applicantName;
    const subject = `GCF Stage 1 Review Notes — ${applicantName}`;
    const body = this.buildEmailBody(contactName);

    this.sending = true;
    try {
      const mode = await this.emailService.sendReviewEmail({ to: recipient, subject, body });

      this.storageService.markReviewSent(this.submission.id, recipient);
      this.lastSentAt = new Date().toISOString();

      if (mode === 'automatic') {
        this.notificationService.success(
          `Review notes sent from ${this.emailService.senderEmail} to ${recipient}.`
        );
      } else {
        this.notificationService.info(
          `Gmail opened for ${this.emailService.senderEmail}. Sign in with that account and click Send.`
        );
      }
    } finally {
      this.sending = false;
    }
  }

  private buildEmailBody(contactName: string): string {
    if (!this.submission) {
      return '';
    }

    const lines = [
      `Dear ${contactName},`,
      '',
      'Please find below our review notes regarding your Stage 1 pre-screening submission:',
      '',
    ];

    for (const section of this.visibleSectionsWithNotes()) {
      lines.push(`--- ${section.title} ---`);
      lines.push((this.sectionNotes[section.id] ?? '').trim() || '(No notes for this section)');
      lines.push('');
    }

    lines.push('---');
    lines.push(`Applicant: ${this.submission.data['applicantName'] || 'N/A'}`);
    lines.push(`Submission date: ${this.formatDate(this.submission.date)}`);
    lines.push(`Reference ID: ${this.submission.id}`);
    lines.push('');
    lines.push('Kind regards,');
    lines.push('GCF Accreditation Team');
    lines.push(this.emailService.senderEmail);

    return lines.join('\n');
  }

  private visibleSectionsWithNotes(): DisplaySection[] {
    return this.sections.filter((s) => this.sectionHasValues(this.sections.indexOf(s)));
  }

  isLongText(key: string): boolean {
    return [
      'ndaEngagementDescription', 'consultationSummary', 'businessMandate',
      'climateFinanceOverview', 'trackRecordOverview', 'fullCycleDescription',
      'fastTrackComplianceDetails', 'executingEntityDetails'
    ].includes(key);
  }

  isBadgeField(key: string): boolean {
    return key.startsWith('has') || key.startsWith('can') || key.startsWith('accredited');
  }

  isYesValue(key: string): boolean {
    const val = this.submission?.data[key];
    if (typeof val === 'boolean') {
      return val;
    }
    return val === 'yes';
  }
}
