import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm: FormGroup;
  recoveryForm: FormGroup;

  mode: 'login' | 'forgot' = 'login';
  submitting = false;
  recoverySubmitting = false;
  recoverySent = false;
  recoveryError = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    this.recoveryForm = this.fb.group({
      username: ['', Validators.required]
    });

    if (this.authService.isLoggedIn) {
      this.redirectUser();
    }
  }

  async onSubmit(): Promise<void> {
    if (!this.loginForm.valid) {
      this.notificationService.warning('Please enter username and password');
      return;
    }

    if (this.submitting) {
      return;
    }

    this.submitting = true;

    try {
      const { username, password } = this.loginForm.value;
      const result = await this.authService.login(username, password);

      if (result.ok) {
        this.notificationService.success('Login successful');
        this.redirectUser();
      } else {
        this.notificationService.error(
          result.message ?? 'Invalid username or password'
        );
      }
    } finally {
      this.submitting = false;
    }
  }

  showForgotPassword(): void {
    const username = this.loginForm.get('username')?.value;
    this.recoveryForm.patchValue({ username: username ?? '' });
    this.recoverySent = false;
    this.recoveryError = '';
    this.mode = 'forgot';
  }

  showLogin(): void {
    this.recoverySent = false;
    this.recoveryError = '';
    this.mode = 'login';
  }

  async onRequestReset(): Promise<void> {
    if (!this.recoveryForm.valid || this.recoverySubmitting) {
      return;
    }

    this.recoverySubmitting = true;
    this.recoverySent = false;
    this.recoveryError = '';

    try {
      await this.apiService.forgotPassword(this.recoveryForm.value.username);
      this.recoverySent = true;
    } catch (error) {
      this.recoveryError =
        error instanceof Error
          ? error.message
          : 'Could not send the reset email. Please try again.';
    } finally {
      this.recoverySubmitting = false;
    }
  }

  private redirectUser(): void {
    const user = this.authService.currentUserValue;
    if (user?.role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/my-forms']);
    }
  }
}
