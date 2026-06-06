import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import {
  buildMissingFieldsMessage,
  collectInvalidFields,
  markAllControlsTouched
} from '../../shared/forms/form-validation.util';

@Component({
  selector: 'app-stage1',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stage1.component.html',
  styleUrl: './stage1.component.css'
})
export class Stage1Component {
  currentStep = 0;
  form: FormGroup;
  submitted = false;
  submitSuccess = false;

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
    private notificationService: NotificationService
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
    });
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
      this.storageService.saveStage1Submission(this.form.value);
      this.submitSuccess = true;
      this.notificationService.success('Questionnaire submitted successfully!');
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
}
