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
  statusSavingId: string | null = null;
  bulkBusy = false;
  selectedIds = new Set<string>();

  readonly statusOptions: { value: UserStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'suspended', label: 'Blocked' },
  ];

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
      const ids = new Set(this.users.map((user) => user.id));
      this.selectedIds = new Set(
        Array.from(this.selectedIds).filter((id) => ids.has(id)),
      );
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

  /* ── Selection & status ─────────────────────────────────── */

  get allVisibleSelected(): boolean {
    const rows = this.filteredUsers;
    return rows.length > 0 && rows.every((user) => this.selectedIds.has(user.id));
  }

  get someVisibleSelected(): boolean {
    return (
      this.selectedIds.size > 0 &&
      this.filteredUsers.some((user) => this.selectedIds.has(user.id)) &&
      !this.allVisibleSelected
    );
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  isSelected(user: ApiUser): boolean {
    return this.selectedIds.has(user.id);
  }

  toggleSelect(user: ApiUser, checked: boolean): void {
    if (checked) this.selectedIds.add(user.id);
    else this.selectedIds.delete(user.id);
  }

  toggleSelectAll(checked: boolean): void {
    if (checked) {
      for (const user of this.filteredUsers) this.selectedIds.add(user.id);
    } else {
      for (const user of this.filteredUsers) this.selectedIds.delete(user.id);
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  statusLabel(status: UserStatus): string {
    if (status === 'active') return 'Active';
    if (status === 'pending') return 'Pending';
    return 'Blocked';
  }

  async changeStatus(user: ApiUser, status: string): Promise<void> {
    const next = status as UserStatus;
    if (next === user.status || this.statusSavingId) {
      return;
    }

    this.statusSavingId = user.id;
    try {
      const updated = await this.api.updateUser(user.id, { status: next });
      user.status = updated?.status ?? next;
      if (this.editingUser?.id === user.id) this.form.status = user.status;
      this.notificationService.success(
        `${user.username} is now ${this.statusLabel(user.status).toLowerCase()}.`,
      );
    } catch (error) {
      this.notificationService.error(
        error instanceof Error
          ? error.message
          : 'Could not change the user status.',
      );
      await this.loadUsers();
    } finally {
      this.statusSavingId = null;
    }
  }

  async bulkSetStatus(status: UserStatus): Promise<void> {
    if (this.bulkBusy || this.selectedIds.size === 0) return;
    const ids = Array.from(this.selectedIds);
    const targets = this.users.filter((user) => ids.includes(user.id));
    const changed = targets.filter((user) => user.status !== status);
    if (!changed.length) {
      this.notificationService.info(
        `Selected users are already ${this.statusLabel(status).toLowerCase()}.`,
      );
      return;
    }

    this.bulkBusy = true;
    try {
      await Promise.all(
        changed.map((user) => this.api.updateUser(user.id, { status })),
      );
      for (const user of changed) user.status = status;
      if (this.editingUser && changed.some((user) => user.id === this.editingUser?.id)) {
        this.form.status = status;
      }
      this.notificationService.success(
        `${changed.length} user${changed.length === 1 ? '' : 's'} set to ${this.statusLabel(status).toLowerCase()}.`,
      );
      this.selectedIds.clear();
    } catch (error) {
      this.notificationService.error(
        error instanceof Error
          ? error.message
          : 'Could not update the selected users.',
      );
      await this.loadUsers();
    } finally {
      this.bulkBusy = false;
    }
  }

  async bulkDelete(): Promise<void> {
    if (this.bulkBusy || this.selectedIds.size === 0) return;
    const ids = Array.from(this.selectedIds);
    const targets = this.users.filter((user) => ids.includes(user.id));
    if (
      !confirm(
        `Delete ${targets.length} user${targets.length === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return;
    }

    this.bulkBusy = true;
    try {
      await Promise.all(targets.map((user) => this.api.deleteUser(user.id)));
      this.users = this.users.filter((user) => !ids.includes(user.id));
      if (this.editingUser && ids.includes(this.editingUser.id)) {
        this.showForm = false;
        this.editingUser = null;
      }
      this.notificationService.success(
        `${targets.length} user${targets.length === 1 ? '' : 's'} deleted.`,
      );
      this.selectedIds.clear();
    } catch (error) {
      this.notificationService.error(
        error instanceof Error
          ? error.message
          : 'Could not delete the selected users.',
      );
      await this.loadUsers();
    } finally {
      this.bulkBusy = false;
    }
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

  /** Invitations only make sense for accounts that have not set a password yet. */
  canInvite(user: ApiUser): boolean {
    return !user.hasPassword && user.status === 'pending';
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
