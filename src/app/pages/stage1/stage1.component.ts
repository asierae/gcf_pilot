import { Component, OnDestroy, OnInit } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  FormArray,
  AbstractControl,
} from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { OrganizationService } from '../../services/organization.service';
import { UserService } from '../../services/user.service';
import { OrganizationRecord } from '../../models/organization.model';
import {
  addStage1FormControls,
  watchStage1ConditionalRequirements,
} from '../../shared/forms/stage1-form.builder';
import { STAGE1_STEPS } from '../../shared/data/form-steps.config';
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { CountrySelectComponent } from '../../shared/components/country-select/country-select.component';
import { Stage1StepsComponent } from '../../shared/components/stage1-steps/stage1-steps.component';
import { PreScreeningTimelineComponent } from './pre-screening-timeline/pre-screening-timeline.component';
import {
  acronymAvailabilityValidator,
  isOrganizationId,
  newOrganizationId,
  ORG_QUERY_PARAM,
  syncOrganizationId,
} from '../../shared/utils/organization.util';
import {
  buildMissingFieldsMessage,
  collectInvalidFields,
  markAllControlsTouched
} from '../../shared/forms/form-validation.util';

@Component({
  selector: 'app-stage1',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FileUploadComponent,
    RouterLink,
    CountrySelectComponent,
    Stage1StepsComponent,
    PreScreeningTimelineComponent,
    TranslatePipe,
  ],
  templateUrl: './stage1.component.html',
  styleUrl: './stage1.component.css'
})
export class Stage1Component implements OnInit, OnDestroy {
  currentStep = 0;
  form: FormGroup;
  submitted = false;
  submitSuccess = false;

  /** The Timeline tab is only offered to signed-in users. */
  isLoggedIn = false;
  activeTab: 'form' | 'timeline' = 'form';

  /** True after blur if an active account already uses the entered email. */
  emailTaken = false;

  checkEmailTaken(): void {
    const email = this.form.get('primaryContactEmail')?.value ?? '';
    this.emailTaken = !!String(email).trim() && !!this.userService.findByEmail(String(email));
  }

  /**
   * Organization id. It is the R2 folder (`organizations/<id>/...`), the draft
   * key and the applicant id sent with the submission.
   */
  applicantId = newOrganizationId();
  organization: OrganizationRecord | null = null;
  /** True once the organization exists: name and acronym are read-only. */
  identityLocked = false;
  draftSaving = false;
  draftSavedAt: string | null = null;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private draftLoaded = false;
  private pendingSave = false;
  /** Functions that re-apply "required when visible" validators after a patch. */
  private conditionalSyncs: Array<() => void> = [];

  /** Same step/section numbering as the full form (0, 1, 2, 3.1, 3.2). */
  steps = STAGE1_STEPS;

  /** One-line guidance rendered under the active step title. */
  stepDescriptions = [
    'Choose how your organization accesses GCF resources and share any nomination or NDA consultation details.',
    'Provide your legal contact details, entity type and the scope of your operations.',
    'Confirm your legal status, eligibility and the documents that evidence it.',
    'Tell us about governance, track record, fast-track options, partnerships and your engagement with the GCF so far.',
  ];

  countries = [
    'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia',
    'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium',
    'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada',
    'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros',
    'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti',
    'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea',
    'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia',
    'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
    'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
    'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
    'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
    'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
    'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
    'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea',
    'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Panama', 'Papua New Guinea',
    'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia',
    'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Samoa', 'San Marino', 'Sao Tome and Principe',
    'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
    'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
    'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
    'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
    'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
    'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Venezuela', 'Vietnam',
    'Yemen', 'Zambia', 'Zimbabwe'
  ];

  constructor(
    private fb: FormBuilder,
    private storageService: StorageService,
    private notificationService: NotificationService,
    private authService: AuthService,
    private organizationService: OrganizationService,
    private userService: UserService,
    private route: ActivatedRoute,
    private location: Location,
  ) {
    this.form = this.fb.group(addStage1FormControls(this.fb));
  }

  async ngOnInit(): Promise<void> {
    this.isLoggedIn = this.authService.isLoggedIn;
    this.form.valueChanges.subscribe(() => this.scheduleDraftSave());
    this.conditionalSyncs = watchStage1ConditionalRequirements(this.form);

    this.applicantId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.applicantId);

    await this.loadOrganizationAndDraft();
    for (const sync of this.conditionalSyncs) sync();

    this.draftLoaded = true;
    if (this.pendingSave) {
      this.pendingSave = false;
      this.scheduleDraftSave();
    }
  }

  ngOnDestroy(): void {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      void this.saveDraft();
    }
  }

  /**
   * Signed-in applicants always work on their own organization. Anonymous
   * visitors keep the id in the URL (`?org=...`) so the link restores the
   * draft later.
   */
  private resolveOrganizationId(): string {
    const user = this.authService.currentUserValue;
    if (user?.organizationId) {
      return user.organizationId;
    }

    const fromUrl = this.route.snapshot.queryParamMap.get(ORG_QUERY_PARAM);
    return isOrganizationId(fromUrl) ? (fromUrl as string) : newOrganizationId();
  }

  private async loadOrganizationAndDraft(): Promise<void> {
    const user = this.authService.currentUserValue;
    const isAdmin = user?.role === 'admin';

    this.organization = await this.organizationService.load(this.applicantId);

    if (!this.organization && user?.organizationId === this.applicantId && user.organizationName) {
      try {
        this.organization = await this.organizationService.save(this.applicantId, {
          name: user.organizationName,
          acronym: user.organizationAcronym ?? '',
          contactEmail: user.email,
        });
      } catch (error) {
        this.notificationService.error(
          error instanceof Error
            ? error.message
            : 'Could not register your organization.',
        );
      }
    }

    this.identityLocked = Boolean(this.organization);

    if (this.organization) {
      this.applyServerValues(this.profileForForm(this.organization));
    }

    // Admins can open an organization's filled pre-screening from the
    // organization editor. The submitted payload is the base; an existing
    // draft (if any) is applied afterwards and wins.
    if (isAdmin) {
      try {
        const forms = await this.organizationService.forms(this.applicantId);
        if (forms.stage1?.data) {
          this.applyServerValues(forms.stage1.data);
          this.restoreAfdbOperations(forms.stage1.data);
        }
      } catch {
        // Viewing a submitted form is best-effort; the form stays usable.
      }
    }

    const draft = await this.organizationService.loadDraft('stage1', this.applicantId);
    if (draft?.data) {
      this.applyServerValues(draft.data);
      this.restoreAfdbOperations(draft.data);
      this.draftSavedAt = draft.updatedAt;
    }

    this.configureAcronymValidator();
  }

  /**
   * Restores server state without overwriting fields the visitor already
   * edited while the load was in flight.
   */
  private applyServerValues(values: Record<string, unknown>): void {
    const patch = Object.fromEntries(
      Object.entries(values).filter(([key]) => {
        const control = this.form.get(key);
        return control !== null && !control.dirty;
      }),
    );
    this.form.patchValue(patch, { emitEvent: false });
  }

  private configureAcronymValidator(): void {
    const control = this.form.get('applicantAcronym');
    if (!control) return;

    if (this.identityLocked) {
      control.clearAsyncValidators();
    } else {
      control.setAsyncValidators(
        acronymAvailabilityValidator(
          this.organizationService,
          () => this.applicantId,
        ),
      );
    }
    control.updateValueAndValidity({ emitEvent: false });
  }

  private profileForForm(org: OrganizationRecord): Record<string, string> {
    const pairs: Record<string, string> = {
      applicantName: org.name,
      applicantAcronym: org.acronym,
      legalAddress: org.legalAddress,
      operationalAddress: org.operationalAddress,
      website: org.website,
      countryOfOperation: org.country,
      typeOfEntity: org.entityType,
      primaryContactName: org.contactName,
      primaryContactEmail: org.contactEmail,
      primaryContactPhone: org.contactPhone,
    };

    return Object.fromEntries(
      Object.entries(pairs).filter(([, value]) => Boolean(value)),
    );
  }

  private restoreAfdbOperations(data: Record<string, unknown>): void {
    const rows = data['afdbOperations'];
    if (!Array.isArray(rows)) return;

    const array = this.form.get('afdbOperations') as FormArray;
    array.clear();
    for (const row of rows) {
      array.push(this.fb.group(row as Record<string, unknown>));
    }
  }

  private scheduleDraftSave(): void {
    if (!this.draftLoaded) {
      this.pendingSave = true;
      return;
    }
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
    }
    this.draftSaving = true;
    this.draftTimer = setTimeout(() => void this.saveDraft(), 800);
  }

  private async saveDraft(): Promise<void> {
    this.draftTimer = null;
    if (!this.draftLoaded) return;

    try {
      const updatedAt = await this.organizationService.saveDraft(
        'stage1',
        this.applicantId,
        this.form.getRawValue(),
      );
      this.draftSavedAt = updatedAt;
    } catch {
      // Drafts are best-effort; the form itself stays usable.
    } finally {
      this.draftSaving = false;
    }
  }

  get identityFieldsLocked(): boolean {
    return this.identityLocked;
  }

  get isGovernment(): boolean {
    return this.form.get('organizationType')?.value === 'government';
  }

  get isSelfNominatingDirect(): boolean {
    return this.form.get('organizationType')?.value === 'self-nominating-direct';
  }

  get isSelfNominatingInternational(): boolean {
    return this.form.get('organizationType')?.value === 'self-nominating-international';
  }

  get isSelfNominating(): boolean {
    return this.isSelfNominatingDirect || this.isSelfNominatingInternational;
  }

  get consultationMethod(): string {
    return this.form.get('consultationMethod')?.value || 'online';
  }

  get showConsultationOnline(): boolean {
    return this.consultationMethod === 'online';
  }

  get showConsultationUpload(): boolean {
    return this.consultationMethod === 'upload';
  }

  get showConsultationNone(): boolean {
    return this.consultationMethod === 'none';
  }

  get showFullCycleDescription(): boolean {
    return this.form.get('canUndertakeFullCycle')?.value === 'yes';
  }

  get showClimateFinanceOverview(): boolean {
    return this.form.get('hasClimateFinanceExperience')?.value === 'yes';
  }

  get showTrackRecordOverview(): boolean {
    return this.form.get('hasTrackRecordInRegion')?.value === 'yes';
  }

  get showGrievanceLevel(): boolean {
    return this.form.get('hasGrievanceMechanism')?.value === 'yes';
  }

  get showHighRiskExperience(): boolean {
    const risk = this.form.get('riskCategory')?.value;
    return risk === 'Category A / Intermediation 1 (I-1)' || risk === 'Category B / Intermediation 2 (I-2)';
  }

  get showEsmsDescription(): boolean {
    return this.form.get('hasESMS')?.value === 'yes';
  }

  get showFastTrackCredentials(): boolean {
    const institutions = this.form.get('fastTrackInstitutions')?.value || {};
    return institutions.gef || institutions.af || institutions.euDgIntpa;
  }

  get showAfdbOperations(): boolean {
    const institutions = this.form.get('fastTrackInstitutions')?.value || {};
    return institutions.afdb && this.form.get('afdbCurrent')?.value === 'yes';
  }

  get showOtherCrossCutting(): boolean {
    return this.form.get('crossCutting.other')?.value === true;
  }

  get afdbOperations(): FormArray {
    return this.form.get('afdbOperations') as FormArray;
  }

  /** Rows of the AfDB operations table, typed as form groups for [formGroup]. */
  get afdbRows(): FormGroup[] {
    return this.afdbOperations.controls as FormGroup[];
  }

  /** Live word count for a free-text control, used by the word-limit hints. */
  wordCount(controlName: string): number {
    const value = this.form.get(controlName)?.value;
    if (!value || typeof value !== 'string') return 0;
    return value.trim().split(/\s+/).filter(Boolean).length;
  }

  addAfdbOperation(): void {
    this.afdbOperations.push(this.fb.group({
      projectName: [''],
      projectId: [''],
      status: [''],
      idev: [''],
      budgetSupport: [''],
    }));
  }

  removeAfdbOperation(index: number): void {
    this.afdbOperations.removeAt(index);
  }

  goToStep(step: number): void {
    if (step >= 0 && step < this.steps.length) {
      this.currentStep = step;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  onSubmit(): void {
    this.submitted = true;
    markAllControlsTouched(this.form);

    if (this.form.valid) {
      void this.submitForm();
    } else {
      const missing = collectInvalidFields(this.form);
      if (missing.length > 0) {
        this.goToStep(missing[0].step);
      }
      const message = buildMissingFieldsMessage(missing);
      const duration = Math.min(12000, 5000 + missing.length * 500);
      this.notificationService.show(message, 'error', duration);
    }
  }

  getStepProgress(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  private async submitForm(): Promise<void> {
    if (this.draftTimer) {
      clearTimeout(this.draftTimer);
      this.draftTimer = null;
    }

    try {
      await this.storageService.saveStage1Submission(
        this.form.value,
        this.applicantId,
      );
      await this.organizationService.clearDraft('stage1', this.applicantId);
      this.submitSuccess = true;
      this.notificationService.success('Questionnaire submitted successfully!');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not save submission to the server.';

      if (message.toLowerCase().includes('acronym')) {
        this.form.get('applicantAcronym')?.setErrors({ acronymTaken: true });
        this.currentStep = 1;
      }

      this.notificationService.error(message);
    }
  }
}