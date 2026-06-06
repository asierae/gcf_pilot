import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { COUNTRIES } from '../../data/form-steps.config';

@Component({
  selector: 'app-stage1-steps',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './stage1-steps.component.html',
  styleUrl: '../../../pages/stage1/stage1.component.css'
})
export class Stage1StepsComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) stepIndex!: number;

  countries = COUNTRIES;
}
