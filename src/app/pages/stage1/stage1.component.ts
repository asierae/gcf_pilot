import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { OrganizationService } from '../../services/organization.service';
import { OrganizationRecord } from '../../models/organization.model';
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { StepIconComponent } from '../../shared/components/step-icon/step-icon.component';
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
  imports: [CommonModule, ReactiveFormsModule, FileUploadComponent, StepIconComponent],
  templateUrl: './stage1.component.html',
  styleUrl: './stage1.component.css'
})
export class Stage1Component implements OnInit, OnDestroy {
  currentStep = 0;
  form: FormGroup;
  submitted = false;
  submitSuccess = false;

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

  steps = [
    { id: 'access', title: 'Access Modality', icon: '🌐' },
    { id: 'general', title: 'General Information', icon: '📋' },
    { id: 'legal', title: 'Legal Status & Eligibility', icon: '⚖️' },
    { id: 'additional', title: 'Additional Information', icon: '📊' },
    { id: 'fasttrack', title: 'Fast-Track & Engagement', icon: '🚀' },
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
    private route: ActivatedRoute,
    private location: Location,
  ) {
    this.form = this.fb.group({
      organizationType: ['', Validators.required],
      nominationLetterAttached: [''],
      ndaEngagementDescription: [''],
      consultationCountry: [''],
      consultationContactPerson: [''],
      consultationMode: [''],
      consultationDates: [''],
      ndaInstitution: [''],
      ndaContactPerson: [''],
      ndaContactInfo: [''],
      consultationSummary: [''],
      applicantName: ['', Validators.required],
      applicantAcronym: ['', Validators.required],
      legalAddress: ['', Validators.required],
      operationalAddress: [''],
      website: ['', Validators.required],
      primaryContactName: ['', Validators.required],
      primaryContactEmail: ['', [Validators.required, Validators.email]],
      primaryContactPhone: ['', Validators.required],
      secondaryContactName: [''],
      secondaryContactEmail: ['', Validators.email],
      secondaryContactPhone: [''],
      scopeOfOperations: ['', Validators.required],
      scopeOfOperationsOther: [''],
      typeOfEntity: ['', Validators.required],
      typeOfEntityOther: [''],
      areaOfOperation: this.fb.group({
        developingCountries: [false],
        leastDevelopedCountries: [false],
        smallIslandDevelopingStates: [false],
        developedCountries: [false],
      }),
      headquartersCountry: ['', Validators.required],
      incorporationCountry: ['', Validators.required],
      hasLegalPersonality: ['', Validators.required],
      hasLegalCapacity: ['', Validators.required],
      canReceiveFundsDirectly: ['', Validators.required],
      canHandleGCFCurrencies: ['', Validators.required],
      canMaintainInterestBearingAccount: ['', Validators.required],
      canUndertakeFullCycle: ['', Validators.required],
      fullCycleDescription: [''],
      hasFiduciaryCapacity: ['', Validators.required],
      hasESSCapacity: ['', Validators.required],
      hasGenderCapacity: ['', Validators.required],
      hasMonitoringCapacity: ['', Validators.required],
      businessMandate: ['', Validators.required],
      hasClimateFinanceExperience: [''],
      climateFinanceOverview: [''],
      hasTrackRecordInRegion: [''],
      trackRecordOverview: [''],
      fiduciaryLevel: ['', Validators.required],
      projectManagementLevel: ['', Validators.required],
      essLevel: ['', Validators.required],
      hasGrievanceMechanism: ['', Validators.required],
      grievanceMechanismLevel: [''],
      genderLevel: ['', Validators.required],
      monitoringLevel: ['', Validators.required],
      canEnsureDownstreamCompliance: ['', Validators.required],
      canMonitorCompliance: ['', Validators.required],
      accreditedByGEF: [false],
      accreditedByAF: [false],
      accreditedByEUDGINTPA: [false],
      fastTrackComplianceDetails: [''],
      hasReceivedReadinessSupport: ['', Validators.required],
      hasServedAsExecutingEntity: ['', Validators.required],
      executingEntityDetails: [''],
      hasServedAsDeliveryPartner: ['', Validators.required],
      hasEngagedInPSAA: ['', Validators.required],
      preparedForPartnerships: ['', Validators.required],
      nominationLetterFiles: [[]],
      consultationSummaryFiles: [[]],
      legalSupportingDocumentsFiles: [[]],
      fastTrackAccreditationFiles: [[]],
    });
  }

  async ngOnInit(): Promise<void> {
    // Subscribe before the initial state arrives so edits made while the
    // organization/draft is still loading are not lost.
    this.form.valueChanges.subscribe(() => this.scheduleDraftSave());

    this.applicantId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.applicantId);

    await this.loadOrganizationAndDraft();

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

    this.organization = await this.organizationService.load(this.applicantId);

    if (!this.organization && user?.organizationId === this.applicantId && user.organizationName) {
      // First visit for a signed-in applicant: register the organization with
      // the details we already know.
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

    const draft = await this.organizationService.loadDraft('stage1', this.applicantId);
    if (draft?.data) {
      this.applyServerValues(draft.data);
      this.restoreTrackRecord(draft.data);
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

  private restoreTrackRecord(data: Record<string, unknown>): void {
    const rows = data['climateTrackRecord'];
    if (!Array.isArray(rows)) return;

    const array = this.form.get('climateTrackRecord') as unknown as {
      clear: () => void;
      push: (control: unknown) => void;
    };
    array.clear();
    for (const row of rows) {
      array.push(this.fb.group(row as Record<string, unknown>));
    }
  }

  private scheduleDraftSave(): void {
    // Queue edits made before the organization/draft finished loading.
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
