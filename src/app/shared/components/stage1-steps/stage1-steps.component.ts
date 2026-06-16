import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormArray, FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { COUNTRIES } from '../../data/form-steps.config';
import { FileUploadComponent } from '../file-upload/file-upload.component';

@Component({
  selector: 'app-stage1-steps',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FileUploadComponent],
  templateUrl: './stage1-steps.component.html',
  styleUrl: '../../../pages/stage1/stage1.component.css'
})
export class Stage1StepsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) stepIndex!: number;

  countries = COUNTRIES;
  private fb = inject(FormBuilder);

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
