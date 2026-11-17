import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private notificationService: NotificationService
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    if (this.authService.isLoggedIn) {
      this.redirectUser();
    }
  }

  submitting = false;

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

  private redirectUser(): void {
    const user = this.authService.currentUserValue;
    if (user?.role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/my-forms']);
    }
  }
}
