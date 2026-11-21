import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormGroup, FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { COUNTRIES } from '../../data/form-steps.config';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { CountrySelectComponent } from '../country-select/country-select.component';
import { UserService } from '../../../services/user.service';

/**
 * The five pre-screening steps. Used by both /stage1 and the full Stage 2 form,
 * so the pre-screening questions can never drift apart again.
 */
@Component({
  selector: 'app-stage1-steps',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadComponent, CountrySelectComponent, TranslatePipe],
  templateUrl: './stage1-steps.component.html',
  styleUrl: '../../../pages/stage1/stage1.component.css'
})
export class Stage1StepsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) stepIndex!: number;
  /** Applicant/organization id used as the R2 folder name for uploads. */
  @Input() entityId = '';
  /** True once the organization exists: name and acronym are read-only. */
  @Input() identityLocked = false;
  /** Stage 2 shows the full application; Stage 1 pre-screening hides extra questions. */
  @Input() applicationMode = false;

  countries = COUNTRIES;
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  /** True after blur if an active account already uses the entered email. */
  emailTaken = false;

  checkEmailTaken(): void {
    const email = this.form.get('primaryContactEmail')?.value ?? '';
    this.emailTaken = !!String(email).trim() && !!this.userService.findByEmail(String(email));
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

  get afdbRows(): FormGroup[] {
    return this.afdbOperations.controls as FormGroup[];
  }

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

  get climateTrackRecord(): FormArray {
    return this.form.get('climateTrackRecord') as FormArray;
  }

  get trackRecordRows(): FormGroup[] {
    return this.climateTrackRecord.controls as FormGroup[];
  }

  addTrackRecord() {
    const fields = {
      title: [''],
      applicantRole: [''],
      sourceOfFunding: [''],
      location: [''],
      climateContribution: [''],
      theme: [''],
      size: [''],
      financingAmountManaged: [''],
      financialInstruments: [''],
      startAndEndDates: [''],
      status: [''],
      durationYears: [''],
      esgRiskCategory: [''],
      esgPerformanceStandards: [''],
      outcomesResultsAreas: [''],
      projectWebpage: [''],
    };
    this.climateTrackRecord.push(this.fb.group(fields));
  }

  removeTrackRecord(index: number) {
    this.climateTrackRecord.removeAt(index);
  }
}
