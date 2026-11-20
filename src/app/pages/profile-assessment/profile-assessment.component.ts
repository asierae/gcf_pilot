import { Component, DestroyRef, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountrySelectComponent } from '../../shared/components/country-select/country-select.component';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { LanguageSwitcherComponent } from '../../shared/components/language-switcher/language-switcher.component';
import { LeadRecord } from '../../models/applicant.model';

export const PROFILE_ENTITY_TYPES = [
  'Bank / Financial institution',
  'Development finance institution',
  'Government / Public institution',
  'Private company / Investor',
  'NGO / Non-profit',
  'Project developer',
  'Other',
];

export const PROFILE_SPECIALTIES = [
  'Climate finance / Green investment',
  'Renewable energy / Energy transition',
  'Climate adaptation / Resilience',
  'Agriculture / Food systems',
  'Water / Sanitation',
  'Nature / Forestry / Biodiversity',
  'Infrastructure / Transport',
  'Financial services / Banking',
  'Project development / Investment advisory',
  'Institutional governance / Capacity building',
  'Other',
];

export const PROFILE_DOCUMENTS = [
  'Audited financial statements',
  'Governance and internal control policies',
  'Environmental and social risk management framework',
  'Anti-money laundering / anti-corruption policies',
  'Climate project or financing track record',
];

export const PROFILE_OBJECTIVES = [
  'GCF accreditation and institutional readiness',
  'Project financing / investment',
  'Project development / proposal support',
  'Institutional due diligence / risk intelligence',
  'Strategic partnerships / capital mobilisation',
  'Not sure — need guidance',
];

export const PROFILE_PROJECT_OBJECTIVES = [
  'Project financing / investment',
  'Project development / proposal support',
];

export const PROFILE_ACCREDITATION_OBJECTIVE =
  'GCF accreditation and institutional readiness';

export const PROFILE_FINANCING = [
  'Not determined',
  'Below USD 1 million',
  'USD 1–10 million',
  'USD 10–50 million',
  'USD 50–100 million',
  'USD 100–250 million',
  'USD 250–500 million',
  'USD 500 million–1 billion',
  'Above USD 1 billion',
  'Other — specify amount',
  'Not seeking financing',
];

export const PROFILE_TIMELINES = [
  'Immediately',
  'Within 3–6 months',
  'Within 6–12 months',
  'Long-term planning',
];

export const PROFILE_HISTORY = ['Less than 1 year', '1–2 years', '3+ years'];

export const PROFILE_PROJECT_STAGES = [
  'Early concept',
  'Feasibility study available',
  'Investment proposal prepared',
  'Seeking financing / financial close',
];

export const PROFILE_PROJECT_SECTORS = [
  'Energy',
  'Agriculture / Food systems',
  'Water',
  'Transport',
  'Forestry / Nature',
  'Urban / Infrastructure',
  'Cross-sector / Other',
];

export const PROFILE_ACCESS_TYPES = [
  'Direct access entity',
  'International access entity',
  'Not yet determined',
];

export const PROFILE_ISSUES = [
  'No known material issues',
  'Yes — requires confidential discussion',
  'Unsure / Requires review',
];

export const PROFILE_ENGAGEMENT = [
  'Receive a proposal for a paid diagnostic',
  'Request an introductory discussion',
  'Exploring options only',
];

/** Everything the form collects, ready to be stored as a lead. */
export interface ProfileFormState {
  country: string;
  organization: string;
  acronym: string;
  entityType: string;
  website: string;
  contactEmail: string;
  specialty: string[];
  specialtyOther: string;
  objective: string;
  financing: string;
  financingDetail: string;
  timeline: string;
  operatingHistory: string;
  documents: string[];
  projectStage: string;
  projectCountry: string;
  projectSector: string;
  accessType: string;
  complianceIssues: string;
  challenge: string;
  engagement: string;
  contactName: string;
  contactRole: string;
  consent: boolean;
}

export function emptyProfileForm(): ProfileFormState {
  return {
    country: '',
    organization: '',
    acronym: '',
    entityType: '',
    website: '',
    contactEmail: '',
    specialty: [],
    specialtyOther: '',
    objective: '',
    financing: '',
    financingDetail: '',
    timeline: '',
    operatingHistory: '',
    documents: [],
    projectStage: '',
    projectCountry: '',
    projectSector: '',
    accessType: '',
    complianceIssues: '',
    challenge: '',
    engagement: '',
    contactName: '',
    contactRole: '',
    consent: false,
  };
}

export function isProfileProject(objective: string): boolean {
  return PROFILE_PROJECT_OBJECTIVES.includes(objective);
}

export function isProfileAccreditation(objective: string): boolean {
  return objective === PROFILE_ACCREDITATION_OBJECTIVE;
}

/** Indicative score kept in sync with the server-side screening. */
export function profileScore(state: ProfileFormState): number {
  let score = 0;

  if (state.operatingHistory === '3+ years') score += 20;
  else if (state.operatingHistory === '1–2 years') score += 10;

  const weights: Record<string, number> = {
    'Audited financial statements': 15,
    'Governance and internal control policies': 15,
    'Environmental and social risk management framework': 15,
    'Anti-money laundering / anti-corruption policies': 15,
    'Climate project or financing track record': 10,
  };
  for (const document of state.documents) {
    score += weights[document] ?? 0;
  }

  if (isProfileProject(state.objective)) {
    if (state.projectStage === 'Feasibility study available') score += 5;
    else if (
      state.projectStage === 'Investment proposal prepared' ||
      state.projectStage === 'Seeking financing / financial close'
    ) {
      score += 10;
    }
  } else if (isProfileAccreditation(state.objective)) {
    if (state.accessType && state.accessType !== 'Not yet determined') score += 10;
  } else {
    score += 10;
  }

  return Math.min(100, score);
}

export function profileReadinessLabel(score: number): string {
  if (score >= 75) return 'Several readiness indicators present';
  if (score >= 45) return 'Further readiness review advisable';
  return 'Foundational readiness review advisable';
}

export function suggestedProfileRoute(state: ProfileFormState): string {
  if (state.complianceIssues && state.complianceIssues !== 'No known material issues') {
    return 'Confidential compliance clarification';
  }
  if (isProfileAccreditation(state.objective)) {
    return 'Institutional Accreditation Readiness Diagnostic';
  }
  if (isProfileProject(state.objective)) {
    return 'Project Investment Readiness Review';
  }
  if (state.objective === 'Institutional due diligence / risk intelligence') {
    return 'Institutional Integrity & Risk Intelligence Review';
  }
  if (state.objective === 'Strategic partnerships / capital mobilisation') {
    return 'Capital Mobilisation & Partnership Strategy';
  }
  return 'Strategic Advisory Scoping';
}

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

/** Canonical English route names returned by the API, mapped to i18n keys. */
const PROFILE_ROUTE_KEYS: Record<string, string> = {
  "Confidential compliance clarification": "PROFILE.ROUTES.COMPLIANCE",
  "Institutional Accreditation Readiness Diagnostic":
    "PROFILE.ROUTES.ACCREDITATION",
  "Project Investment Readiness Review": "PROFILE.ROUTES.PROJECT",
  "Institutional Integrity & Risk Intelligence Review":
    "PROFILE.ROUTES.DUE_DILIGENCE",
  "Capital Mobilisation & Partnership Strategy": "PROFILE.ROUTES.PARTNERSHIP",
  "Strategic Advisory Scoping": "PROFILE.ROUTES.SCOPING",
};

type ProfileOptionGroup =
  | "ENTITY"
  | "SPECIALTY"
  | "DOCUMENT"
  | "OBJECTIVE"
  | "FINANCING"
  | "TIMELINE"
  | "HISTORY"
  | "PROJECT_STAGE"
  | "PROJECT_SECTOR"
  | "ACCESS"
  | "ISSUE"
  | "ENGAGEMENT";

@Component({
  selector: 'app-profile-assessment',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CountrySelectComponent,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  templateUrl: './profile-assessment.component.html',
  styleUrl: './profile-assessment.component.css',
})
export class ProfileAssessmentComponent implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  readonly steps = [0, 1, 2, 3, 4].map((index) => ({
    id: `step-${index}`,
    index,
  }));

  readonly entityTypes = PROFILE_ENTITY_TYPES;
  readonly specialties = PROFILE_SPECIALTIES;
  readonly documents = PROFILE_DOCUMENTS;
  readonly objectives = PROFILE_OBJECTIVES;
  readonly financingOptions = PROFILE_FINANCING;
  readonly timelines = PROFILE_TIMELINES;
  readonly historyOptions = PROFILE_HISTORY;
  readonly projectStages = PROFILE_PROJECT_STAGES;
  readonly projectSectors = PROFILE_PROJECT_SECTORS;
  readonly accessTypes = PROFILE_ACCESS_TYPES;
  readonly issueOptions = PROFILE_ISSUES;
  readonly engagementOptions = PROFILE_ENGAGEMENT;

  private readonly optionGroups: Record<ProfileOptionGroup, string[]> = {
    ENTITY: PROFILE_ENTITY_TYPES,
    SPECIALTY: PROFILE_SPECIALTIES,
    DOCUMENT: PROFILE_DOCUMENTS,
    OBJECTIVE: PROFILE_OBJECTIVES,
    FINANCING: PROFILE_FINANCING,
    TIMELINE: PROFILE_TIMELINES,
    HISTORY: PROFILE_HISTORY,
    PROJECT_STAGE: PROFILE_PROJECT_STAGES,
    PROJECT_SECTOR: PROFILE_PROJECT_SECTORS,
    ACCESS: PROFILE_ACCESS_TYPES,
    ISSUE: PROFILE_ISSUES,
    ENGAGEMENT: PROFILE_ENGAGEMENT,
  };

  state: ProfileFormState = emptyProfileForm();
  currentStep = 0;
  submitting = false;
  submitted = false;
  errorMessage = '';
  /** Set by the API so the summary matches what was stored. */
  result: LeadRecord | null = null;
  accountCreated = false;
  accountUsername = '';

  private previousTitle = 'Avera Capital Access';

  constructor(
    private readonly title: Title,
    private readonly api: ApiService,
    private readonly notification: NotificationService,
    private readonly translate: TranslateService,
  ) {
    this.previousTitle = this.title.getTitle();
    this.syncDocumentTitle();
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDocumentTitle());
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.previousTitle);
  }

  stepTitle(index: number): string {
    return this.translate.instant(`PROFILE.STEPS.${index}.TITLE`);
  }

  stepDescription(index: number): string {
    return this.translate.instant(`PROFILE.STEPS.${index}.DESCRIPTION`);
  }

  /** Translates a canonical English option while keeping it as the stored value. */
  optionLabel(group: ProfileOptionGroup, value: string): string {
    if (!value) return value;
    const list = this.optionGroups[group];
    const index = list.indexOf(value);
    if (index < 0) return value;
    const key = `PROFILE.OPTIONS.${group}.${index}`;
    const label = this.translate.instant(key);
    return label === key ? value : label;
  }

  get stepProgress(): number {
    return ((this.currentStep + 1) / this.steps.length) * 100;
  }

  get isProjectObjective(): boolean {
    return isProfileProject(this.state.objective);
  }

  get isAccreditationObjective(): boolean {
    return isProfileAccreditation(this.state.objective);
  }

  get readinessScore(): number {
    if (this.result?.readinessScore != null) return this.result.readinessScore;
    return profileScore(this.state);
  }

  get suggestedRoute(): string {
    const raw = this.result?.suggestedRoute || suggestedProfileRoute(this.state);
    const key = PROFILE_ROUTE_KEYS[raw];
    return key ? this.translate.instant(key) : raw;
  }

  get readinessLabel(): string {
    const score = this.readinessScore;
    const key =
      score >= 75
        ? "PROFILE.READINESS.HIGH"
        : score >= 45
          ? "PROFILE.READINESS.MEDIUM"
          : "PROFILE.READINESS.LOW";
    return this.translate.instant(key);
  }

  get specialtySummary(): string {
    return this.state.specialty
      .map((item) =>
        item === "Other"
          ? this.state.specialtyOther
          : this.optionLabel("SPECIALTY", item),
      )
      .filter(Boolean)
      .join(", ");
  }

  get financingSummary(): string {
    if (!this.state.financing) return this.translate.instant("PROFILE.NOT_SPECIFIED");
    return this.state.financing === "Other — specify amount"
      ? this.state.financingDetail ||
          this.translate.instant("PROFILE.NOT_SPECIFIED")
      : this.optionLabel("FINANCING", this.state.financing);
  }

  get documentsSummary(): string {
    return (
      this.state.documents
        .map((item) => this.optionLabel("DOCUMENT", item))
        .join(", ") || this.translate.instant("PROFILE.NOT_SPECIFIED")
    );
  }

  goToStep(index: number): void {
    if (index < 0 || index >= this.steps.length) return;
    this.currentStep = index;
    this.errorMessage = '';
    this.scrollToTop();
  }

  nextStep(): void {
    if (!this.validateStep()) return;
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep += 1;
      this.scrollToTop();
    } else {
      void this.submit();
    }
  }

  previousStep(): void {
    if (this.currentStep > 0) {
      this.currentStep -= 1;
      this.scrollToTop();
    }
  }

  restart(): void {
    this.state = emptyProfileForm();
    this.currentStep = 0;
    this.submitted = false;
    this.result = null;
    this.accountCreated = false;
    this.accountUsername = '';
    this.errorMessage = '';
    this.scrollToTop();
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private validateStep(): boolean {
    const state = this.state;
    let message = '';

    if (this.currentStep === 0) {
      if (!state.country.trim() || !state.organization.trim() || !state.entityType) {
        message = this.translate.instant('PROFILE.VALIDATION.STEP1');
      } else if (!EMAIL_PATTERN.test(state.contactEmail)) {
        message = this.translate.instant('PROFILE.VALIDATION.EMAIL');
      } else if (state.specialty.includes('Other') && !state.specialtyOther.trim()) {
        message = this.translate.instant('PROFILE.VALIDATION.SPECIALTY');
      } else if (state.website && !/^https?:\/\//i.test(state.website.trim())) {
        message = this.translate.instant('PROFILE.VALIDATION.WEBSITE');
      }
    } else if (this.currentStep === 1) {
      if (!state.objective) {
        message = this.translate.instant('PROFILE.VALIDATION.OBJECTIVE');
      } else if (
        state.financing === 'Other — specify amount' &&
        !state.financingDetail.trim()
      ) {
        message = this.translate.instant('PROFILE.VALIDATION.FINANCING');
      }
    } else if (this.currentStep === 2) {
      if (!state.operatingHistory) {
        message = this.translate.instant('PROFILE.VALIDATION.HISTORY');
      }
    } else if (this.currentStep === 3) {
      if (!state.complianceIssues) {
        message = this.translate.instant('PROFILE.VALIDATION.COMPLIANCE');
      }
    } else if (this.currentStep === 4) {
      if (!state.contactName.trim()) {
        message = this.translate.instant('PROFILE.VALIDATION.NAME');
      } else if (!state.consent) {
        message = this.translate.instant('PROFILE.VALIDATION.CONSENT');
      }
    }

    this.errorMessage = message;
    return !message;
  }

  toggleSpecialty(value: string, checked: boolean): void {
    const set = new Set(this.state.specialty);
    if (checked) set.add(value);
    else set.delete(value);
    this.state.specialty = Array.from(set);
  }

  toggleDocument(value: string, checked: boolean): void {
    const set = new Set(this.state.documents);
    if (checked) set.add(value);
    else set.delete(value);
    this.state.documents = Array.from(set);
  }

  private async submit(): Promise<void> {
    this.submitting = true;
    this.errorMessage = '';

    const payload: Omit<LeadRecord, 'id' | 'createdAt' | 'updatedAt'> = {
      country: this.state.country.trim(),
      organization: this.state.organization.trim(),
      acronym: this.state.acronym.trim(),
      entityType: this.state.entityType,
      website: this.state.website.trim(),
      contactEmail: this.state.contactEmail.trim(),
      climateSpecialty: this.specialtySummary,
      comments: this.state.challenge.trim(),
      status: 'Pending',
      contactName: this.state.contactName.trim(),
      contactRole: this.state.contactRole.trim(),
      objective: this.state.objective,
      financing: this.financingSummary,
      timeline: this.state.timeline,
      operatingHistory: this.state.operatingHistory,
      availableDocuments: this.state.documents,
      projectStage: this.state.projectStage,
      projectCountry: this.state.projectCountry.trim(),
      projectSector: this.state.projectSector,
      accessType: this.state.accessType,
      complianceIssues: this.state.complianceIssues,
      challenge: this.state.challenge.trim(),
      engagement: this.state.engagement,
      consent: this.state.consent,
      source: 'profile',
    };

    try {
      const response = await this.api.submitProfileAssessment(payload);
      this.result = response.lead;
      this.accountCreated = response.userCreated;
      this.accountUsername = response.username ?? '';
      this.submitted = true;
      this.notification.success(
        this.translate.instant('PROFILE.NOTIFY.RECEIVED'),
      );
      this.scrollToTop();
    } catch (error) {
      this.errorMessage =
        error instanceof Error && error.message
          ? error.message
          : this.translate.instant('PROFILE.NOTIFY.FAILED');
    } finally {
      this.submitting = false;
    }
  }

  private syncDocumentTitle(): void {
    const translated = this.translate.instant('PROFILE.META_TITLE');
    this.title.setTitle(
      translated && translated !== 'PROFILE.META_TITLE'
        ? translated
        : 'Profile assessment — Avera Capital Access',
    );
  }
}
