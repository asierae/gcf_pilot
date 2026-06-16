import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppUser, UserRole, UserService, UserStatus } from '../../../services/user.service';
import { NotificationService } from '../../../services/notification.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';

interface UserFormData {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  organizationName: string;
  linkedSubmissionIds: string;
  sendActivation: boolean;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent implements OnInit {
  users: AppUser[] = [];
  userSearch = '';
  showForm = false;
  editingUser: AppUser | null = null;
  form: UserFormData = this.emptyForm();

  constructor(
    private userService: UserService,
    private notificationService: NotificationService,
    private breadcrumbService: BreadcrumbService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext('User Management');
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clearContext();
  }

  loadUsers(): void {
    this.users = this.userService.getUsers();
  }

  get filteredUsers(): AppUser[] {
    const q = this.userSearch.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organizationName ?? '').toLowerCase().includes(q),
    );
  }

  openCreateForm(): void {
    this.editingUser = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  openEditForm(user: AppUser): void {
    this.editingUser = user;
    this.form = {
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      organizationName: user.organizationName ?? '',
      linkedSubmissionIds: user.linkedSubmissionIds.join(', '),
      sendActivation: false,
    };
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingUser = null;
  }

  saveForm(): void {
    if (!this.form.username.trim()) {
      this.notificationService.warning('Username is required.');
      return;
    }
    if (!this.form.email.trim()) {
      this.notificationService.warning('Email is required.');
      return;
    }

    const linkedIds = this.form.linkedSubmissionIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (this.editingUser) {
      const updates: Partial<Omit<AppUser, 'id' | 'createdAt'>> = {
        username: this.form.username.trim(),
        email: this.form.email.trim(),
        role: this.form.role,
        status: this.form.status,
        organizationName: this.form.organizationName.trim() || undefined,
        linkedSubmissionIds: linkedIds,
      };
      if (this.form.password.trim()) {
        updates.password = this.form.password.trim();
      }
      this.userService.updateUser(this.editingUser.id, updates);
      this.notificationService.success(`User "${this.form.username}" updated.`);
    } else {
      const newUser = this.userService.createUser({
        username: this.form.username.trim(),
        email: this.form.email.trim(),
        password: this.form.password.trim(),
        role: this.form.role,
        status: this.form.role === 'applicant' ? 'pending' : this.form.status,
        organizationName: this.form.organizationName.trim() || undefined,
        linkedSubmissionIds: linkedIds,
      });
      if (this.form.sendActivation || this.form.role === 'applicant') {
        this.userService.sendActivationEmail(newUser);
      } else {
        this.notificationService.success(`User "${newUser.username}" created.`);
      }
    }

    this.loadUsers();
    this.showForm = false;
    this.editingUser = null;
  }

  deleteUser(user: AppUser): void {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    this.userService.deleteUser(user.id);
    this.loadUsers();
    this.notificationService.success(`User "${user.username}" deleted.`);
  }

  getInitials(user: AppUser): string {
    const name = user.organizationName ?? user.username;
    return name.slice(0, 2).toUpperCase();
  }

  getRoleClass(role: UserRole): string {
    return role === 'admin' ? 'badge-admin' : 'badge-applicant';
  }

  getStatusClass(status: UserStatus): string {
    return `badge-status-${status}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private emptyForm(): UserFormData {
    return {
      username: '',
      email: '',
      password: '',
      role: 'applicant',
      status: 'active',
      organizationName: '',
      linkedSubmissionIds: '',
      sendActivation: true,
    };
  }
}
