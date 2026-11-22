import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { EmailService } from '../../services/email.service';
import { OrganizationService } from '../../services/organization.service';
import { OrganizationRecord } from '../../models/organization.model';
import {
  isOrganizationId,
  newOrganizationId,
  ORG_QUERY_PARAM,
  syncOrganizationId,
} from '../../shared/utils/organization.util';
import {
  addStage1FormControls,
  watchStage1ConditionalRequirements,
} from '../../shared/forms/stage1-form.builder';
import { STAGE2_ENTRY_STEP } from '../../shared/data/form-steps.config';
import {
  STAGE2_SCREENING_STEPS,
  Stage2ScreeningStep,
  TOTAL_WIZARD_STEPS,
  WizardNavGroup,
  buildWizardNav
} from '../../shared/data/stage2-form.config';
import { Stage1StepsComponent } from '../../shared/components/stage1-steps/stage1-steps.component';
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { StepIconComponent } from '../../shared/components/step-icon/step-icon.component';

const SUBMISSION_QUERY_PARAM = 'submission';

/**
 * Review-note key for each pre-screening step. They match the section ids used
 * by the pre-screening submission detail, so notes are shared between both
 * admin views.
 */
const STAGE1_REVIEW_KEYS = [
  'access-modality',
  'general-information',
  'legal-status',
  'additional-information',
];

@Component({
  selector: 'app-stage2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Stage1StepsComponent, FileUploadComponent, StepIconComponent, RouterLink, TranslatePipe],
  templateUrl: './stage2.component.html',
  styleUrl: './stage2.component.css'
})
export class Stage2Component implements OnInit, OnDestroy {
  readonly totalSteps = TOTAL_WIZARD_STEPS;
  readonly stage2EntryStep = STAGE2_ENTRY_STEP;
  readonly screeningSteps = STAGE2_SCREENING_STEPS;
  navGroups: WizardNavGroup[] = buildWizardNav();

  currentStep = STAGE2_ENTRY_STEP;
  form!: FormGroup;
  submitted = false;
  submitSuccess = false;

  /** Organization id (also the R2 folder for uploads). */
  applicantId = newOrganizationId();
  identityLocked = false;

  isAdmin = false;
  viewMode: 'grid' | 'form' = 'form';

  /** Set when the admin opens a specific submission from the submissions table. */
  private submissionId: string | null = null;
  viewingSubmission = false;
  draftSaving = false;
  draftSavedAt: string | null = null;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private draftLoaded = false;
  private pendingSave = false;

  /** Admin-only review notes, one entry per section (saved on the applicant). */
  sectionNotes: Record<string, string> = {};
  reviewSaving = false;
  reviewSavedAt: string | null = null;
  lastReviewSentAt: string | null = null;
  sendingReview = false;
  private reviewTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingReview: { key: string; note: string } | null = null;

  constructor(
    private fb: FormBuilder,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private emailService: EmailService,
    private organizationService: OrganizationService,
    private translate: TranslateService,
    private route: ActivatedRoute,
    private location: Location,
  ) {}

  ngOnInit(): void {
    const group: Record<string, unknown> = {
      ...addStage1FormControls(this.fb),
      maxRiskCategory: ['', Validators.required],
      // Application-only questions from the GCF guidance. They are added here
      // (not in the shared Stage 1 builder) so pre-screening is untouched.
      governmentLegalStatus: [''],
      hasBeneficialOwnershipDocumentation: ['', Validators.required],
      beneficialOwnershipDetails: [''],
      intendedESSRiskCategory: ['', Validators.required],
      intendedFinancialInstruments: ['', Validators.required],
      resultAreas: this.fb.group({
        healthFoodWater: [false],
        livelihoods: [false],
        infrastructure: [false],
        ecosystems: [false],
        energy: [false],
        transport: [false],
        buildingsCities: [false],
        forestsLandUse: [false],
      }),
      accreditedByAfDB: [false],
      fastTrackFullCompliance: [''],
      afDBAgreementSigned: [''],
      afDBAgreementDetails: [''],
    };

    for (const step of STAGE2_SCREENING_STEPS) {
      for (const q of step.questions) {
        group[`${q.key}_answer`] = ['', Validators.required];
        group[`${q.key}_narrative`] = ['', Validators.required];
        group[`${q.key}_files`] = [[]];
      }
      if (step.sectionStatusKey) {
        group[step.sectionStatusKey] = ['pending', Validators.required];
      }
      if (step.sectionCommentsKey) {
        group[step.sectionCommentsKey] = [''];
      }
    }

    this.form = this.fb.group(group);
    watchStage1ConditionalRequirements(this.form);

    this.isAdmin = this.authService.currentUserValue?.role === 'admin';
    if (!this.isAdmin) {
      this.viewMode = 'grid';
    }

    this.applicantId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.applicantId);
    this.submissionId = this.route.snapshot.queryParamMap.get(SUBMISSION_QUERY_PARAM);
    this.viewingSubmission = Boolean(this.submissionId);
    this.form.valueChanges.subscribe(() => this.scheduleDraftSave());

    if (this.isAdmin) {
      void this.loadReviewNotes();
    }

    void this.loadSavedData();
  }

  private resolveOrganizationId(): string {
    const user = this.authService.currentUserValue;
    if (user?.organizationId) {
      return user.organizationId;
    }
    const fromUrl = this.route.snapshot.queryParamMap.get(ORG_QUERY_PARAM);
    return isOrganizationId(fromUrl) ? (fromUrl as string) : newOrganizationId();
  }

  private async loadSavedData(): Promise<void> {
    try {
      const [organization, forms] = await Promise.all([
        this.organizationService.load(this.applicantId),
        this.organizationService.forms(this.applicantId),
      ]);

      this.identityLocked = Boolean(organization);

      if (this.submissionId) {
        // The admin is reviewing one submission: show its full payload and
        // never let the working draft overwrite it.
        const submission =
          await this.organizationService.getAccreditationSubmission(
            this.submissionId,
          );
        if (submission?.data) {
          this.applyDraftValues(submission.data);
        }
        this.draftSavedAt = null;
      } else {
        // Prefill from the organization's previous submissions, then overwrite
        // the identity fields with the canonical organization profile.
        const data = forms.stage2?.data ?? forms.stage1?.data ?? null;
        if (data) {
          this.applyDraftValues(data);
        }
        if (organization) {
          this.form.patchValue(this.profileForForm(organization));
        }

        const draft = await this.organizationService.loadStage2Draft(
          this.applicantId,
        );
        if (draft?.data) {
          this.applyDraftValues(draft.data);
          this.draftSavedAt = draft.updatedAt;
        } else {
          this.draftSavedAt = null;
        }
      }
    } catch {
      this.notificationService.error('Could not load saved data from the server.');
    } finally {
      this.draftLoaded = true;
      if (this.pendingSave) {
        this.pendingSave = false;
        this.scheduleDraftSave();
      }
    }
  }

  private applyDraftValues(values: Record<string, unknown>): void {
    this.form.patchValue(values as never);
    this.restoreArray('climateTrackRecord', values);
    this.restoreArray('afdbOperations', values);
  }

  /** Rebuilds a FormArray from a saved payload before its rows are rendered. */
  private restoreArray(name: 'climateTrackRecord' | 'afdbOperations', values: Record<string, unknown>): void {
    const records = values[name];
    if (!Array.isArray(records)) return;
    const array = this.form.get(name) as FormArray;
    array.clear();
    for (const record of records) {
      if (!record || typeof record !== 'object') continue;
      const fields = Object.fromEntries(
        Object.keys(record as Record<string, unknown>).map((key) => [key, ['']]),
      );
      const group = this.fb.group(fields);
      group.patchValue(record as never);
      array.push(group);
    }
  }

  /** Loads the admin review notes stored on the applicant record. */
  private async loadReviewNotes(): Promise<void> {
    try {
      const record = await this.storageService.getApplicantRecord(this.applicantId);
      this.sectionNotes = { ...(record?.admin.reviewNotes ?? {}) };
      this.lastReviewSentAt = record?.admin.lastReviewSent?.sentAt ?? null;
    } catch {
      // Review notes are admin metadata; a missing applicant is not an error.
    }
  }

  private scheduleDraftSave(): void {
    if (this.viewingSubmission) return;
    if (!this.draftLoaded) {
      this.pendingSave = true;
      return;
    }
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftSaving = true;
    this.draftTimer = setTimeout(() => void this.saveDraft(), 800);
  }

  private async saveDraft(): Promise<void> {
    this.draftTimer = null;
    if (!this.draftLoaded || this.viewingSubmission) return;
    try {
      this.draftSavedAt = await this.organizationService.saveStage2Draft(
        this.applicantId,
        this.form.getRawValue(),
      );
    } catch {
      // Drafts are best-effort; the form itself stays usable.
    } finally {
      this.draftSaving = false;
    }
  }

  ngOnDestroy(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      void this.saveDraft();
    }
    if (this.reviewTimer) {
      clearTimeout(this.reviewTimer);
      this.reviewTimer = null;
      const pending = this.pendingReview;
      this.pendingReview = null;
      if (pending) void this.persistReviewNote(pending.key, pending.note);
    }
  }

  private profileForForm(org: OrganizationRecord): Record<string, string> {
    const pairs: Record<string, string> = {
      applicantName: org.name,
      applicantAcronym: org.acronym,
      legalAddress: org.legalAddress,
      operationalAddress: org.operationalAddress,
      website: org.website,
      headquartersCountry: org.country,
      countryOfOperation: org.country,
      hqLocation: org.country,
      typeOfEntity: org.entityType,
      primaryContactName: org.contactName,
      primaryContactEmail: org.contactEmail,
      primaryContactPhone: org.contactPhone,
    };

    return Object.fromEntries(
      Object.entries(pairs).filter(([, value]) => Boolean(value)),
    );
  }

  get isStage1Step(): boolean {
    return this.currentStep < STAGE2_ENTRY_STEP;
  }

  get currentScreeningStep(): Stage2ScreeningStep | null {
    if (this.isStage1Step) {
      return null;
    }
    return STAGE2_SCREENING_STEPS[this.currentStep - STAGE2_ENTRY_STEP];
  }

  get stepProgress(): number {
    return ((this.currentStep + 1) / this.totalSteps) * 100;
  }

  get currentStepLabel(): string {
    const item = this.navGroups.flatMap((group) => group.steps)
      .find((step) => step.index === this.currentStep);
    if (!item) return '';
    return item.number === '0' ? item.title : `Section ${item.number}: ${item.title}`;
  }

  // ── Admin review notes ───────────────────────────────────────────────────

  /** Review-note key for a wizard step (pre-screening ids or `s4` … `s13`). */
  private reviewKeyForStep(step: number): string {
    if (step < STAGE2_ENTRY_STEP) {
      return STAGE1_REVIEW_KEYS[step] ?? `stage1-${step}`;
    }
    return (
      STAGE2_SCREENING_STEPS[step - STAGE2_ENTRY_STEP]?.id ?? `section-${step}`
    );
  }

  get currentReviewKey(): string {
    return this.reviewKeyForStep(this.currentStep);
  }

  get currentReviewNote(): string {
    return this.sectionNotes[this.currentReviewKey] ?? '';
  }

  get reviewNotesCount(): number {
    return Object.values(this.sectionNotes).filter((note) => note.trim())
      .length;
  }

  hasAnyReviewNotes(): boolean {
    return this.reviewNotesCount > 0;
  }

  onReviewNoteInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    const key = this.currentReviewKey;
    this.sectionNotes = { ...this.sectionNotes, [key]: value };
    this.pendingReview = { key, note: value };
    if (this.reviewTimer) clearTimeout(this.reviewTimer);
    this.reviewSaving = true;
    this.reviewTimer = setTimeout(() => void this.flushReviewNote(), 700);
  }

  private async flushReviewNote(): Promise<void> {
    this.reviewTimer = null;
    const pending = this.pendingReview;
    this.pendingReview = null;
    if (!pending) {
      this.reviewSaving = false;
      return;
    }
    await this.persistReviewNote(pending.key, pending.note);
  }

  private async persistReviewNote(key: string, note: string): Promise<void> {
    try {
      await this.storageService.saveSubmissionReviewNote(
        this.applicantId,
        key,
        note,
      );
      this.reviewSavedAt = new Date().toISOString();
    } catch {
      this.notificationService.error('Could not save the review note.');
    } finally {
      this.reviewSaving = false;
    }
  }

  /** Non-empty notes in questionnaire order, ready to store or email. */
  private reviewNotesPayload(): Record<string, string> {
    const notes: Record<string, string> = {};
    for (const group of this.navGroups) {
      for (const step of group.steps) {
        const key = this.reviewKeyForStep(step.index);
        const note = (this.sectionNotes[key] ?? '').trim();
        if (note) notes[key] = note;
      }
    }
    return notes;
  }

  private reviewLabelForKey(key: string): string {
    const item = this.navGroups
      .flatMap((group) => group.steps)
      .find((step) => this.reviewKeyForStep(step.index) === key);
    if (!item) return key;
    return item.number === '0'
      ? item.title
      : `Section ${item.number}: ${item.title}`;
  }

  async sendReviewNotes(): Promise<void> {
    if (this.sendingReview) return;

    const recipient = String(
      this.form.get('primaryContactEmail')?.value ?? '',
    ).trim();
    if (!recipient) {
      this.notificationService.error(
        this.translate.instant('STAGE2.REVIEW_NO_RECIPIENT'),
      );
      return;
    }

    const notes = this.reviewNotesPayload();
    if (!Object.keys(notes).length) {
      this.notificationService.warning(
        this.translate.instant('STAGE2.REVIEW_NO_NOTES'),
      );
      return;
    }

    const applicantName =
      String(this.form.get('applicantName')?.value ?? '').trim() || 'Applicant';
    const contactName =
      String(this.form.get('primaryContactName')?.value ?? '').trim() ||
      applicantName;
    const subject = `GCF Accreditation Review Notes — ${applicantName}`;
    const body = this.buildReviewEmailBody(contactName, notes);

    this.sendingReview = true;
    try {
      const mode = await this.emailService.sendReviewEmail({
        to: recipient,
        subject,
        body,
      });
      await this.storageService.markReviewSent(
        this.applicantId,
        recipient,
        notes,
      );
      this.lastReviewSentAt = new Date().toISOString();

      if (mode === 'automatic') {
        this.notificationService.success(
          this.translate.instant('STAGE2.REVIEW_SENT', { email: recipient }),
        );
      } else {
        this.notificationService.info(
          this.translate.instant('STAGE2.REVIEW_MANUAL', {
            email: this.emailService.senderEmail,
          }),
        );
      }
    } catch {
      this.notificationService.error(
        this.translate.instant('STAGE2.REVIEW_SEND_ERROR'),
      );
    } finally {
      this.sendingReview = false;
    }
  }

  private buildReviewEmailBody(
    contactName: string,
    notes: Record<string, string>,
  ): string {
    const lines = [
      `Dear ${contactName},`,
      '',
      'Please find below our review notes regarding your accreditation application:',
      '',
    ];
    for (const [key, note] of Object.entries(notes)) {
      lines.push(`--- ${this.reviewLabelForKey(key)} ---`);
      lines.push(note);
      lines.push('');
    }
    lines.push('---');
    lines.push(`Applicant: ${this.form.get('applicantName')?.value || 'N/A'}`);
    lines.push(`Reference ID: ${this.applicantId}`);
    lines.push('');
    lines.push('Kind regards,');
    lines.push('GCF Accreditation Team');
    lines.push(this.emailService.senderEmail);
    return lines.join('\n');
  }

  goToStep(step: number): void {
    if (step >= 0 && step < this.totalSteps) {
      this.currentStep = step;
      if (!this.isAdmin) {
        this.viewMode = 'form';
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  backToGrid(): void {
    this.viewMode = 'grid';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  onSubmit(): void {
    this.submitted = true;
    if (this.form.valid) {
      void this.submitForm();
    } else {
      this.notificationService.error(this.translate.instant('STAGE2.ERROR'));
    }
  }

  private async submitForm(): Promise<void> {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }
    try {
      await this.storageService.saveStage2Submission(
        this.form.value,
        this.applicantId,
      );
      await this.organizationService.clearStage2Draft(this.applicantId);
      this.draftSavedAt = null;
      this.submitSuccess = true;
      this.notificationService.success(this.translate.instant('STAGE2.SAVED'));
    } catch (error) {
      this.notificationService.error(
        error instanceof Error
          ? error.message
          : 'Could not save application to the server.',
      );
    }
  }
}
