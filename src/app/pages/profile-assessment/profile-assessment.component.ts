import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CountrySelectComponent } from '../../shared/components/country-select/country-select.component';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';
import { LeadRecord } from '../../models/applicant.model';

export const PROFILE_REGIONS = [
  'Africa',
  'Asia-Pacific',
  'Central Asia',
  'Eastern Europe',
  'Western Europe',
  'Middle East & North Africa',
  'North America',
  'Latin America & Caribbean',
  'Global / Multiple regions',
  'Other',
];

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
  region: string;
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
    region: '',
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

const STEP_TITLES = [
  'Institutional profile',
  'Capital access objectives',
  'Readiness indicators',
  'Integrity & compliance',
  'Engagement preferences',
];

const STEP_DESCRIPTIONS = [
  'Geographic profile, areas of expertise and professional contact details.',
  'What you want to achieve, the indicative financing need and the timeline.',
  'What your institution already has in place. No documents are required yet.',
  'High-level declarations only — no sensitive records at this stage.',
  'What matters most, and how you would prefer Avera to follow up.',
];

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

@Component({
  selector: 'app-profile-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CountrySelectComponent],
  templateUrl: './profile-assessment.component.html',
  styleUrl: './profile-assessment.component.css',
})
export class ProfileAssessmentComponent implements OnDestroy {
  readonly steps = STEP_TITLES.map((title, index) => ({
    id: `step-${index}`,
    title,
  }));

  readonly descriptions = STEP_DESCRIPTIONS;
  readonly regions = PROFILE_REGIONS;
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
  ) {
    this.previousTitle = this.title.getTitle();
    this.syncDocumentTitle();
  }

  ngOnDestroy(): void {
    this.title.setTitle(this.previousTitle);
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
    return this.result?.suggestedRoute || suggestedProfileRoute(this.state);
  }

  get readinessLabel(): string {
    return profileReadinessLabel(this.readinessScore);
  }

  get specialtySummary(): string {
    return this.state.specialty
      .map((item) => (item === 'Other' ? this.state.specialtyOther : item))
      .filter(Boolean)
      .join(', ');
  }

  get financingSummary(): string {
    if (!this.state.financing) return 'Not specified';
    return this.state.financing === 'Other — specify amount'
      ? this.state.financingDetail || 'Not specified'
      : this.state.financing;
  }

  get documentsSummary(): string {
    return this.state.documents.join(', ') || 'Not specified';
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
      if (!state.region || !state.country.trim() || !state.organization.trim() || !state.entityType) {
        message = 'Please select your region and entity type, and enter your country and organisation name.';
      } else if (!EMAIL_PATTERN.test(state.contactEmail)) {
        message = 'Please enter a valid professional contact email.';
      } else if (state.specialty.includes('Other') && !state.specialtyOther.trim()) {
        message = 'Please specify your other specialty.';
      } else if (state.website && !/^https?:\/\//i.test(state.website.trim())) {
        message = 'Enter a website starting with https://, or leave it blank.';
      }
    } else if (this.currentStep === 1) {
      if (!state.objective) {
        message = 'Please select your primary objective.';
      } else if (
        state.financing === 'Other — specify amount' &&
        !state.financingDetail.trim()
      ) {
        message = 'Please specify your indicative financing need.';
      }
    } else if (this.currentStep === 2) {
      if (!state.operatingHistory) {
        message = 'Please select your institutional operating history.';
      }
    } else if (this.currentStep === 3) {
      if (!state.complianceIssues) {
        message = 'Please answer the compliance question.';
      }
    } else if (this.currentStep === 4) {
      if (!state.contactName.trim()) {
        message = 'Please enter your contact name.';
      } else if (!state.consent) {
        message = 'Consent is required to submit this enquiry.';
      }
    }

    this.errorMessage = message;
    return !message;
  }

  toggleSpecialty(value: string, checked: boolean): void {
    if (value === 'Other') return;
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
      region: this.state.region,
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
      this.notification.success('Your profile assessment has been received.');
      this.scrollToTop();
    } catch (error) {
      this.errorMessage =
        error instanceof Error && error.message
          ? error.message
          : 'The enquiry could not be submitted. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  private syncDocumentTitle(): void {
    this.title.setTitle('Profile assessment — Avera Capital Access');
  }
}
