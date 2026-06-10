import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { StorageService } from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
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

@Component({
  selector: 'app-stage2',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Stage1StepsComponent, FileUploadComponent],
  templateUrl: './stage2.component.html',
  styleUrl: './stage2.component.css'
})
export class Stage2Component implements OnInit {
  readonly totalSteps = TOTAL_WIZARD_STEPS;
  readonly stage2EntryStep = STAGE2_ENTRY_STEP;
  readonly screeningSteps = STAGE2_SCREENING_STEPS;
  navGroups: WizardNavGroup[] = buildWizardNav();

  currentStep = STAGE2_ENTRY_STEP;
  form!: FormGroup;
  submitted = false;
  submitSuccess = false;

  constructor(
    private fb: FormBuilder,
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    const group: Record<string, unknown> = {
      ...addStage1FormControls(this.fb),
      maxRiskCategory: ['', Validators.required],
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
    void this.loadSavedData();
  }

  private async loadSavedData(): Promise<void> {
    try {
      const stage2Data = (await this.storageService.getLatestStage2Submission())?.data;
      const stage1Data = (await this.storageService.getLatestStage1Submission())?.data;

      if (stage2Data) {
        this.form.patchValue(stage2Data);
      } else if (stage1Data) {
        this.form.patchValue(stage1Data);
      }
    } catch {
      this.notificationService.error('Could not load saved data from Firebase.');
    }
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
    if (this.form.valid) {
      void this.submitForm();
    } else {
      this.notificationService.error('Please fill in all required fields before submitting.');
    }
  }

  private async submitForm(): Promise<void> {
    try {
      await this.storageService.saveStage2Submission(this.form.value);
      this.submitSuccess = true;
      this.notificationService.success('Application submitted successfully!');
    } catch {
      this.notificationService.error('Could not save application to Firebase.');
    }
  }
}
