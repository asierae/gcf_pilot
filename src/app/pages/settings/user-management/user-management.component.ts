import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, ApiUser } from '../../../services/api.service';
import { NotificationService } from '../../../services/notification.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';

type UserRole = ApiUser['role'];
type UserStatus = ApiUser['status'];

interface UserFormData {
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  organizationId: string;
  organizationName: string;
  organizationAcronym: string;
  invite: boolean;
}

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css',
})
export class UserManagementComponent implements OnInit, OnDestroy {
  users: ApiUser[] = [];
  userSearch = '';
  showForm = false;
  editingUser: ApiUser | null = null;
  form: UserFormData = this.emptyForm();

  loading = true;
  loadError = '';
  saving = false;
  invitingId: string | null = null;
  deletingId: string | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly notificationService: NotificationService,
    private readonly breadcrumbService: BreadcrumbService,
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.setContext('User Management');
    void this.loadUsers();
  }

  ngOnDestroy(): void {
    this.breadcrumbService.clearContext();
  }

  async loadUsers(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.users = await this.api.getUsers();
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : 'Could not load users.';
    } finally {
      this.loading = false;
    }
  }

  get filteredUsers(): ApiUser[] {
    const q = this.userSearch.trim().toLowerCase();
    if (!q) return this.users;
    return this.users.filter((u) =>
      [u.username, u.email, u.organizationName, u.organizationId, u.organizationAcronym]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }

  openCreateForm(): void {
    this.editingUser = null;
    this.form = this.emptyForm();
    this.showForm = true;
  }

  openEditForm(user: ApiUser): void {
    this.editingUser = user;
    this.form = {
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId ?? '',
      organizationName: user.organizationName ?? '',
      organizationAcronym: user.organizationAcronym ?? '',
      invite: false,
    };
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
    this.editingUser = null;
  }

  async saveForm(): Promise<void> {
    if (this.saving) return;

    if (!this.form.username.trim()) {
      this.notificationService.warning('Username is required.');
      return;
    }
    if (!this.form.email.trim()) {
      this.notificationService.warning('Email is required.');
      return;
    }

    this.saving = true;

    try {
      if (this.editingUser) {
        await this.api.updateUser(this.editingUser.id, {
          username: this.form.username.trim(),
          email: this.form.email.trim(),
          role: this.form.role,
          status: this.form.status,
          organizationId: this.form.organizationId.trim() || undefined,
          organizationName: this.form.organizationName.trim() || undefined,
          organizationAcronym: this.form.organizationAcronym.trim() || undefined,
        });
        this.notificationService.success(`User "${this.form.username}" updated.`);
      } else {
        const created = await this.api.createUser({
          username: this.form.username.trim(),
          email: this.form.email.trim(),
          role: this.form.role,
          status: this.form.status,
          organizationId: this.form.organizationId.trim() || undefined,
          organizationName: this.form.organizationName.trim() || undefined,
          organizationAcronym: this.form.organizationAcronym.trim() || undefined,
          invite: this.form.invite,
        });

        if (created.invited) {
          this.notificationService.success(
            `User "${this.form.username}" created and invited by email.`,
          );
        } else if (created.inviteError) {
          this.notificationService.warning(
            `User created, but the invitation was not sent: ${created.inviteError}`,
          );
        } else {
          this.notificationService.success(
            `User "${this.form.username}" created. Send an invitation to activate it.`,
          );
        }
      }

      await this.loadUsers();
      this.showForm = false;
      this.editingUser = null;
    } catch (error) {
      this.notificationService.error(
        error instanceof Error ? error.message : 'Could not save the user.',
      );
    } finally {
      this.saving = false;
    }
  }

  async sendInvitation(user: ApiUser): Promise<void> {
    if (this.invitingId) return;
    this.invitingId = user.id;

    try {
      await this.api.inviteUser(user.id);
      this.notificationService.success(
        `Invitation emailed to ${user.email}. The link expires in 7 days.`,
      );
      await this.loadUsers();
    } catch (error) {
      this.notificationService.error(
        error instanceof Error
          ? error.message
          : 'Could not send the invitation.',
      );
    } finally {
      this.invitingId = null;
    }
  }

  async deleteUser(user: ApiUser): Promise<void> {
    if (this.deletingId) return;
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;

    this.deletingId = user.id;
    try {
      await this.api.deleteUser(user.id);
      this.notificationService.success(`User "${user.username}" deleted.`);
      await this.loadUsers();
    } catch (error) {
      this.notificationService.error(
        error instanceof Error ? error.message : 'Could not delete the user.',
      );
    } finally {
      this.deletingId = null;
    }
  }

  getInitials(user: ApiUser): string {
    const name = user.organizationName ?? user.username;
    return name.slice(0, 2).toUpperCase();
  }

  getRoleClass(role: UserRole): string {
    return role === 'admin' ? 'badge-admin' : 'badge-applicant';
  }

  getStatusClass(status: UserStatus): string {
    return `badge-status-${status}`;
  }

  formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  private emptyForm(): UserFormData {
    return {
      username: '',
      email: '',
      role: 'applicant',
      status: 'pending',
      organizationId: '',
      organizationName: '',
      organizationAcronym: '',
      invite: true,
    };
  }
}
