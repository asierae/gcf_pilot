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

  onSubmit(): void {
    if (this.loginForm.valid) {
      const { username, password } = this.loginForm.value;
      if (this.authService.login(username, password)) {
        this.notificationService.success('Login successful');
        this.redirectUser();
      } else {
        this.notificationService.error('Invalid username or password');
      }
    } else {
      this.notificationService.warning('Please enter username and password');
    }
  }

  private redirectUser(): void {
    const user = this.authService.currentUserValue;
    if (user?.role === 'admin') {
      this.router.navigate(['/dashboard']);
    } else {
      this.router.navigate(['/stage2']);
    }
  }
}
