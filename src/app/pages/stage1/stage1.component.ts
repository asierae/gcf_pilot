import { Component, OnDestroy, OnInit } from '@angular/core';
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
import { OrganizationRecord } from '../../models/organization.model';
import { FileUploadComponent } from '../../shared/components/file-upload/file-upload.component';
import { CountrySelectComponent } from '../../shared/components/country-select/country-select.component';
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
  ],
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
  /** Functions that re-apply "required when visible" validators after a patch. */
  private conditionalSyncs: Array<() => void> = [];

  steps = [
    { id: 'access', title: 'Access Modality', icon: '🌐' },
    { id: 'general', title: 'General Information', icon: '📋' },
    { id: 'legal', title: 'Legal Status & Eligibility', icon: '⚖️' },
    { id: 'additional', title: 'Additional Information', icon: '📊' },
    { id: 'fasttrack', title: 'Fast-Track & Engagement', icon: '🚀' },
  ];

  /** One-line guidance rendered under the active step title. */
  stepDescriptions = [
    'Choose how your organization accesses GCF resources and share any nomination or NDA consultation details.',
    'Provide your legal contact details, entity type and the scope of your operations.',
    'Confirm your legal status, eligibility and the documents that evidence it.',
    'Tell us about governance, track record and the institutional capacity you can demonstrate.',
    'Describe fast-track options, partnerships and your engagement with the GCF so far.',
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
      // Step 0: Access Modality
      organizationType: ['', Validators.required],
      nominationLetterAttached: [''],
      nominationLetterFiles: [[]],
      ndaEngagementDescription: [''],
      consultationMethod: ['online'],
      consultationCountry: [''],
      consultationContactPerson: [''],
      consultationMode: [''],
      consultationDates: [''],
      ndaInstitution: [''],
      ndaContactPerson: [''],
      ndaContactInfo: [''],
      consultationSummary: [''],
      consultationSummaryFiles: [[]],
      noConsultation: [false],

      // Step 1: General Information
      applicantName: ['', Validators.required],
      applicantAcronym: ['', Validators.required],
      legalAddress: ['', Validators.required],
      registeredAddress: ['', Validators.required],
      operationalAddress: [''],
      website: ['', Validators.required],
      primarySalutation: [''],
      primaryContactName: ['', Validators.required],
      primaryContactTitle: [''],
      primaryContactEmail: ['', [Validators.required, Validators.email]],
      primaryContactPhone: ['', Validators.required],
      secondarySalutation: [''],
      secondaryContactName: [''],
      secondaryContactTitle: [''],
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
      countryOfOperation: ['', Validators.required],
      hqLocation: ['', Validators.required],
      incorporationCountry: [''],
      contactEvidenceFiles: [[]],

      // 1.2 Applicant type — wider group
      groupedOrganization: ['', Validators.required],
      groupDetails: [''],

      // Step 2: Legal Status & Eligibility
      hasLegalPersonality: ['', Validators.required],
      hasLegalCapacity: ['', Validators.required],
      legalSupportingDocumentsFiles: [[]],
      legalOpinionFiles: [[]],
      ownershipFiles: [[]],
      canReceiveFundsDirectly: ['', Validators.required],
      canHandleGCFCurrencies: ['', Validators.required],
      canMaintainInterestBearingAccount: ['', Validators.required],
      canUndertakeFullCycle: ['', Validators.required],
      fullCycleDescription: [''],
      hasFiduciaryCapacity: ['', Validators.required],
      hasESSCapacity: ['', Validators.required],
      hasGenderCapacity: ['', Validators.required],
      hasMonitoringCapacity: ['', Validators.required],
      hasInvestmentCriteria: ['', Validators.required],
      investmentCriteria: this.fb.group({
        impactPotential: [false],
        paradigmShift: [false],
        sustainableDevelopment: [false],
        needsOfRecipient: [false],
        countryOwnership: [false],
        efficiencyEffectiveness: [false],
      }),

      // Step 3: Additional Information
      businessMandate: ['', Validators.required],
      hasClimateFinanceExperience: ['', Validators.required],
      climateFinanceOverview: [''],
      trackRecordEvidenceFiles: [[]],
      hasTrackRecordInRegion: ['', Validators.required],
      trackRecordOverview: [''],
      financingInstruments: ['', Validators.required],
      instrumentExperience: [''],
      climatePriorities: ['', Validators.required],
      strategicAreas: this.fb.group({
        energyAccess: [false],
        lowEmissionTransport: [false],
        buildingsCitiesIndustries: [false],
        forestsLandUse: [false],
        healthFoodWater: [false],
        livelihoods: [false],
        ecosystems: [false],
        infrastructure: [false],
      }),
      crossCutting: this.fb.group({
        privateSector: [false],
        naturePositive: [false],
        justTransition: [false],
        climateResilient: [false],
        genderResponsive: [false],
        supportLdcsSids: [false],
        capacityBuilding: [false],
        other: [false],
      }),
      otherCrossCutting: [''],
      fiduciaryLevel: ['', Validators.required],
      projectManagementLevel: ['', Validators.required],
      essLevel: ['', Validators.required],
      hasGrievanceMechanism: ['', Validators.required],
      grievanceMechanismLevel: [''],
      genderLevel: ['', Validators.required],
      monitoringLevel: ['', Validators.required],
      canEnsureDownstreamCompliance: ['', Validators.required],
      canMonitorCompliance: ['', Validators.required],
      riskCategory: ['', Validators.required],
      highRiskExperience: [''],
      hasESMS: ['', Validators.required],
      esmsDescription: [''],

      // Step 4: Fast-Track & Engagement
      fastTrack: ['', Validators.required],
      fastTrackInstitutions: this.fb.group({
        gef: [false],
        af: [false],
        euDgIntpa: [false],
        afdb: [false],
      }),
      fastTrackCredentials: [''],
      fastTrackDocumentsFiles: [[]],
      afdbCurrent: [''],
      afdbOperations: this.fb.array([]),
      hasReceivedReadinessSupport: ['', Validators.required],
      hasServedAsExecutingEntity: ['', Validators.required],
      executingEntityDetails: [''],
      hasServedAsDeliveryPartner: ['', Validators.required],
      hasEngagedInPSAA: ['', Validators.required],
      preparedForPartnerships: ['', Validators.required],
    });
  }

  async ngOnInit(): Promise<void> {
    this.form.valueChanges.subscribe(() => this.scheduleDraftSave());
    this.watchConditionalRequirements();

    this.applicantId = this.resolveOrganizationId();
    syncOrganizationId(this.location, this.applicantId);

    await this.loadOrganizationAndDraft();
    this.syncConditionalValidators();

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

  /**
   * Mirrors the questionnaire's "required when this branch is shown" rules:
   * a field only becomes required while the answer that reveals it is active.
   */
  private watchConditionalRequirements(): void {
    const bind = (
      sourceNames: string | string[],
      targetNames: string[],
      isActive: (values: Record<string, unknown>) => boolean,
    ): void => {
      const names = Array.isArray(sourceNames) ? sourceNames : [sourceNames];
      const sources = names
        .map((name) => this.form.get(name))
        .filter((control): control is AbstractControl => control !== null);

      if (sources.length === 0) return;

      const sync = (): void => {
        const values = Object.fromEntries(
          names.map((name) => [name, this.form.get(name)?.value]),
        );
        const active = isActive(values);

        for (const targetName of targetNames) {
          const target = this.form.get(targetName);
          if (!target) continue;

          const hasRequirements = target.hasValidator(Validators.required);
          if (active && !hasRequirements) {
            target.addValidators(Validators.required);
          } else if (!active && hasRequirements) {
            target.removeValidators(Validators.required);
          }
          target.updateValueAndValidity({ emitEvent: false });
        }
      };

      for (const source of sources) {
        source.valueChanges.subscribe(sync);
      }

      this.conditionalSyncs.push(sync);
      sync();
    };

    const consultationTargets = [
      'consultationCountry',
      'consultationContactPerson',
      'consultationMode',
      'consultationDates',
      'ndaInstitution',
      'ndaContactPerson',
      'ndaContactInfo',
      'consultationSummary',
    ];

    bind('groupedOrganization', ['groupDetails'], (v) => v['groupedOrganization'] === 'yes');
    bind('canUndertakeFullCycle', ['fullCycleDescription'], (v) => v['canUndertakeFullCycle'] === 'yes');
    bind('hasClimateFinanceExperience', ['climateFinanceOverview'], (v) => v['hasClimateFinanceExperience'] === 'yes');
    bind('hasTrackRecordInRegion', ['trackRecordOverview'], (v) => v['hasTrackRecordInRegion'] === 'yes');
    bind('hasServedAsExecutingEntity', ['executingEntityDetails'], (v) => v['hasServedAsExecutingEntity'] === 'yes');
    bind(
      ['organizationType', 'consultationMethod'],
      consultationTargets,
      (v) =>
        (v['organizationType'] === 'self-nominating-direct' ||
          v['organizationType'] === 'self-nominating-international') &&
        v['consultationMethod'] === 'online',
    );
    bind(
      'fastTrackInstitutions',
      ['fastTrackCredentials'],
      (v) => {
        const institutions = (v['fastTrackInstitutions'] || {}) as Record<string, boolean>;
        return Boolean(institutions['gef'] || institutions['af'] || institutions['euDgIntpa']);
      },
    );
  }

  /** Re-applies conditional validators after values were patched without events. */
  private syncConditionalValidators(): void {
    for (const sync of this.conditionalSyncs) {
      sync();
    }
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