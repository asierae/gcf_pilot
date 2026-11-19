import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, ApiUser } from '../../../services/api.service';
import { EmailLogEntry } from '../../../models/email-log.model';
import { NotificationService } from '../../../services/notification.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { AuthService } from '../../../services/auth.service';
import { TranslateService, TranslatePipe } from '@ngx-translate/core';

type SenderAlias = 'contact' | 'noreply';

@Component({
  selector: 'app-send-email',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './send-email.component.html',
  styleUrl: './send-email.component.css',
})
export class SendEmailComponent implements OnInit, OnDestroy {
  users: ApiUser[] = [];
  log: EmailLogEntry[] = [];

  loading = true;
  logLoading = true;
  loadError = '';
  sending = false;

  subject = '';
  emailTitle = '';
  emailText = '';
  senderAlias: SenderAlias = 'contact';

  readonly aliases: { value: SenderAlias; labelKey: string }[] = [
    { value: 'contact', labelKey: 'SEND_EMAIL.ALIAS_CONTACT' },
    { value: 'noreply', labelKey: 'SEND_EMAIL.ALIAS_NOREPLY' },
  ];

  /** Selection lives in a signal so chips can be derived from it. */
  private readonly selectedIds = signal<Set<string>>(new Set());
  readonly sendToAll = signal(false);

  /* Multiselect dropdown state */
  dropdownOpen = false;
  userSearch = '';

  /* Confirmation dialog state */
  confirmOpen = false;

  readonly selectedUsers = computed(() => {
    const ids = this.selectedIds();
    return this.users.filter((user) => ids.has(user.id));
  });

  readonly selectedCount = computed(() => this.selectedIds().size);

  /** Users that can actually receive mail (drives "all" and validation). */
  readonly mailableUsers = computed(() =>
    this.users.filter(
      (user) => user.status !== 'suspended' && this.isValidEmail(user.email),
    ),
  );

  constructor(
    private readonly api: ApiService,
    private readonly notificationService: NotificationService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly authService: AuthService,
    private readonly translate: TranslateService,
    private readonly elementRef: ElementRef,
  ) {}

  /** Close the recipient dropdown when clicking anywhere outside it. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.dropdownOpen) return;
    const target = event.target as Node | null;
    if (target && !this.elementRef.nativeElement.contains(target)) {
      this.closeDropdown();
    }
  }

  ngOnInit(): void {
    this.breadcrumbService.setContext('Send Email');
    void this.loadUsers();
    void this.loadLog();
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
      const current = this.selectedIds();
      this.selectedIds.set(
        new Set(Array.from(current).filter((id) => ids.has(id))),
      );
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : 'Could not load users.';
    } finally {
      this.loading = false;
    }
  }

  async loadLog(): Promise<void> {
    this.logLoading = true;
    try {
      this.log = await this.api.getEmailLog();
    } catch {
      this.log = [];
    } finally {
      this.logLoading = false;
    }
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  /* ── Recipient multiselect ─────────────────────────────── */

  get filteredUsers(): ApiUser[] {
    const query = this.userSearch.trim().toLowerCase();
    if (!query) return this.users;
    return this.users.filter((user) =>
      [user.username, user.email, user.organizationName, user.organizationAcronym]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  isSelected(user: ApiUser): boolean {
    return this.selectedIds().has(user.id);
  }

  toggleUser(user: ApiUser): void {
    const current = new Set(this.selectedIds());
    if (current.has(user.id)) current.delete(user.id);
    else current.add(user.id);
    this.selectedIds.set(current);
    this.sendToAll.set(false);
  }

  removeUser(user: ApiUser): void {
    const current = new Set(this.selectedIds());
    current.delete(user.id);
    this.selectedIds.set(current);
  }

  toggleSendToAll(checked: boolean): void {
    this.sendToAll.set(checked);
    if (checked) {
      this.selectedIds.set(new Set());
      this.userSearch = '';
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
    this.sendToAll.set(false);
  }

  toggleDropdown(): void {
    this.dropdownOpen = !this.dropdownOpen;
  }

  closeDropdown(): void {
    this.dropdownOpen = false;
  }

  userLabel(user: ApiUser): string {
    const org = user.organizationName?.trim();
    return org ? `${user.username} — ${org}` : user.username;
  }

  /* ── Validation & send ─────────────────────────────────── */

  get recipientCount(): number {
    return this.sendToAll()
      ? this.mailableUsers().length
      : this.selectedUsers().length;
  }

  get canSend(): boolean {
    return (
      !this.sending &&
      this.subject.trim().length > 0 &&
      this.emailTitle.trim().length > 0 &&
      this.emailText.trim().length > 0 &&
      this.recipientCount > 0
    );
  }

  openConfirm(): void {
    if (!this.canSend) return;
    this.dropdownOpen = false;
    this.confirmOpen = true;
  }

  closeConfirm(): void {
    if (this.sending) return;
    this.confirmOpen = false;
  }

  async confirmSend(): Promise<void> {
    if (this.sending) return;
    this.sending = true;
    try {
      const recipientIds: string[] | ['all'] = this.sendToAll()
        ? ['all']
        : Array.from(this.selectedIds());
      const result = await this.api.sendAdminEmail({
        subject: this.subject.trim(),
        title: this.emailTitle.trim(),
        text: this.emailText.trim(),
        recipientIds,
        senderAlias: this.senderAlias,
        createdBy: this.authService.currentUserValue?.username ?? '',
      });

      this.notificationService.success(
        this.translate.instant('SEND_EMAIL.SEND_SUCCESS', {
          count: result.sentCount,
        }),
      );
      this.confirmOpen = false;
      this.subject = '';
      this.emailTitle = '';
      this.emailText = '';
      this.clearSelection();
      await this.loadLog();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : this.translate.instant('SEND_EMAIL.SEND_ERROR');
      this.notificationService.error(message);
    } finally {
      this.sending = false;
    }
  }

  formatLogDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
