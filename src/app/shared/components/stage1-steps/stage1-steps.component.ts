import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { FormGroup, FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { COUNTRIES } from '../../data/form-steps.config';
import { FileUploadComponent } from '../file-upload/file-upload.component';
import { CountrySelectComponent } from '../country-select/country-select.component';
import { UserService } from '../../../services/user.service';

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

  countries = COUNTRIES;
  private fb = inject(FormBuilder);
  private userService = inject(UserService);

  /** True after blur if an active account already uses the entered email. */
  emailTaken = false;

  checkEmailTaken(): void {
    const email = this.form.get('primaryContactEmail')?.value ?? '';
    this.emailTaken = !!String(email).trim() && !!this.userService.findByEmail(String(email));
  }

  get climateTrackRecord() {
    return this.form.get('climateTrackRecord') as FormArray;
  }

  addTrackRecord() {
    this.climateTrackRecord.push(
      this.fb.group({
        title: [''],
        location: [''],
        theme: [''],
        size: [''],
        status: ['']
      })
    );
  }

  removeTrackRecord(index: number) {
    this.climateTrackRecord.removeAt(index);
  }
}
