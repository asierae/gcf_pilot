import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { OrganizationService } from '../../services/organization.service';
import { OrganizationRecord } from '../../models/organization.model';
import {
  isOrganizationId,
  newOrganizationId,
  ORG_QUERY_PARAM,
  syncOrganizationId,
} from '../../shared/utils/organization.util';
import { addStage1FormControls } from '../../shared/forms/stage1-form.builder';
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

  /** Application year selected in the topbar; key of the stage2 draft. */
  draftYear = new Date().getFullYear();
  draftYears: number[] = [];
  draftSaving = false;
  draftSavedAt: string | null = null;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private draftLoaded = false;
  private pendingSave = false;

  constructor(
    private fb: FormBuilder,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private authService: AuthService,
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
      // (not in the shared Stage 1 builder) so pre-accreditation is untouched.
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
    
    this.isAdmin = this.authService.currentUserValue?.role === 'admin';
    if (!this.isAdmin) {
      this.viewMode = 'grid';
    }

    this.applicantId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.applicantId);
    this.form.valueChanges.subscribe(() => this.scheduleDraftSave());

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
      const [organization, forms, yearList] = await Promise.all([
        this.organizationService.load(this.applicantId),
        this.organizationService.forms(this.applicantId),
        this.organizationService.stage2DraftYears(this.applicantId),
      ]);

      this.identityLocked = Boolean(organization);

      // Prefill from the organization's previous submissions, then overwrite
      // the identity fields with the canonical organization profile.
      const data = forms.stage2?.data ?? forms.stage1?.data ?? null;
      if (data) {
        this.applyDraftValues(data);
      }
      if (organization) {
        this.form.patchValue(this.profileForForm(organization));
      }

      // Offer the current year plus the previous three, and any year with a
      // saved draft (which may be older).
      const currentYear = new Date().getFullYear();
      const recentYears = Array.from({ length: 4 }, (_, i) => currentYear - i);
      this.draftYears = Array.from(
        new Set([...recentYears, ...yearList.map((draft) => draft.year)]),
      )
        .filter((year) => Number.isInteger(year) && year >= 2000 && year <= currentYear + 1)
        .sort((a, b) => b - a);
      await this.loadDraftForSelectedYear();
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
    const records = values['climateTrackRecord'];
    if (!Array.isArray(records)) return;
    const array = this.form.get('climateTrackRecord') as FormArray;
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

  private async loadDraftForSelectedYear(): Promise<void> {
    const draft = await this.organizationService.loadStage2Draft(
      this.applicantId,
      this.draftYear,
    );
    if (draft?.data) {
      this.applyDraftValues(draft.data);
      this.draftSavedAt = draft.updatedAt;
    } else {
      this.draftSavedAt = null;
    }
  }

  async onYearChange(year: number): Promise<void> {
    const parsed = Number(year);
    if (
      !Number.isInteger(parsed) ||
      parsed < 2000 ||
      parsed > new Date().getFullYear() + 1 ||
      parsed === this.draftYear
    ) {
      return;
    }
    year = parsed;
    // Flush the pending timer while the old year is still selected.
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
      await this.saveDraft();
    }
    this.draftYear = year;
    this.draftLoaded = false;
    this.draftSavedAt = null;
    try {
      await this.loadDraftForSelectedYear();
    } finally {
      this.draftLoaded = true;
      if (this.pendingSave) {
        this.pendingSave = false;
        this.scheduleDraftSave();
      }
    }
  }

  private scheduleDraftSave(): void {
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
    if (!this.draftLoaded) return;
    try {
      const updatedAt = await this.organizationService.saveStage2Draft(
        this.applicantId,
        this.draftYear,
        this.form.getRawValue(),
      );
      if (!this.draftYears.includes(this.draftYear)) {
        this.draftYears = [this.draftYear, ...this.draftYears].sort((a, b) => b - a);
      }
      this.draftSavedAt = updatedAt;
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
  }

  private profileForForm(org: OrganizationRecord): Record<string, string> {
    const pairs: Record<string, string> = {
      applicantName: org.name,
      applicantAcronym: org.acronym,
      legalAddress: org.legalAddress,
      operationalAddress: org.operationalAddress,
      website: org.website,
      headquartersCountry: org.country,
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
    if (this.isStage1Step) {
      return this.navGroups[0].steps[this.currentStep]?.title ?? '';
    }
    const step = this.currentScreeningStep;
    return step ? `Section ${step.sectionNumber}: ${step.title}` : '';
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
      await this.organizationService.clearStage2Draft(this.applicantId, this.draftYear);
      this.draftYears = this.draftYears.filter((year) => year !== this.draftYear);
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
