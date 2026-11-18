import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, UserTokenInfo } from '../../../services/api.service';

/**
 * Handles both one-time account links:
 *  - /reset-password?token=…  (forgot password)
 *  - /accept-invite?token=…   (admin invitation)
 * The Worker validates the token and activates the account once the password
 * is stored.
 */
@Component({
  selector: 'app-password-token',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './password-token.component.html',
  styleUrl: './password-token.component.css',
})
export class PasswordTokenComponent implements OnInit {
  token = '';
  info: UserTokenInfo | null = null;
  loading = true;
  loadError = '';
  submitting = false;
  submitError = '';
  submitted = false;
  form: FormGroup;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly fb: FormBuilder,
    private readonly api: ApiService,
  ) {
    this.form = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: ['', [Validators.required]],
    });
  }

  get kind(): 'reset' | 'invite' {
    return this.info?.kind ?? 'reset';
  }

  get title(): string {
    return this.kind === 'invite' ? 'Activate your account' : 'Choose a new password';
  }

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.loadError = 'This link is missing its token. Open the link from your email again.';
      this.loading = false;
      return;
    }

    try {
      this.info = await this.api.getTokenInfo(this.token);
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : 'This link is not valid.';
    } finally {
      this.loading = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.submitting || this.submitted) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, confirm } = this.form.value;
    if (password !== confirm) {
      this.submitError = 'The two passwords do not match.';
      return;
    }

    this.submitting = true;
    this.submitError = '';

    try {
      if (this.kind === 'invite') {
        await this.api.acceptInvite(this.token, password);
      } else {
        await this.api.resetPassword(this.token, password);
      }
      this.submitted = true;
    } catch (error) {
      this.submitError =
        error instanceof Error
          ? error.message
          : 'Could not save your password. Please try again.';
    } finally {
      this.submitting = false;
    }
  }
}
