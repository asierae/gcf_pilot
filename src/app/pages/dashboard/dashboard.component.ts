import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FormSubmission,
  StorageService,
  SUBMISSION_STATUSES,
  SubmissionStatus
} from '../../services/storage.service';
import { NotificationService } from '../../services/notification.service';
import { getSubmissionSummary } from '../../shared/data/stage1-display.config';
import { DatePickerComponent } from '../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePickerComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  submissions: FormSubmission[] = [];
  readonly statusOptions = SUBMISSION_STATUSES;
  selectedIds = new Set<string>();
  statusById: Record<string, SubmissionStatus> = {};
  searchQuery = '';
  dateFrom = '';
  dateTo = '';
  readonly pageSize = 20;
  currentPage = 1;
  loading = true;
  loadError = '';

  constructor(
    private storageService: StorageService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    void this.loadSubmissions();
  }

  async loadSubmissions(): Promise<void> {
    this.loading = true;
    this.loadError = '';

    try {
      const { submissions, statusById } = await this.storageService.loadDashboardData();
      this.submissions = submissions.reverse();
      this.statusById = statusById;
      this.selectedIds = new Set(
        [...this.selectedIds].filter((id) => this.submissions.some((s) => s.id === id))
      );
      this.clampCurrentPage();
    } catch {
      this.loadError = 'Could not load submissions from Firebase.';
      this.notificationService.error(this.loadError);
    } finally {
      this.loading = false;
    }
  }

  get filteredSubmissions(): FormSubmission[] {
    if (this.hasInvalidDateRange) {
      return [];
    }

    let result = this.submissions;

    if (this.dateFrom || this.dateTo) {
      result = result.filter((submission) => this.matchesDateRange(submission));
    }

    const query = this.searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((submission) =>
        this.getSearchableText(submission).includes(query)
      );
    }

    return result;
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.searchQuery.trim() || this.dateFrom || this.dateTo);
  }

  get hasInvalidDateRange(): boolean {
    return Boolean(this.dateFrom && this.dateTo && this.dateFrom > this.dateTo);
  }

  get paginatedSubmissions(): FormSubmission[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSubmissions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSubmissions.length / this.pageSize));
  }

  get pageStart(): number {
    if (!this.filteredSubmissions.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredSubmissions.length);
  }

  get visibleIds(): string[] {
    return this.paginatedSubmissions.map((submission) => submission.id);
  }

  getSummary(submission: FormSubmission) {
    return getSubmissionSummary(submission.data);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatus(submissionId: string): SubmissionStatus {
    return this.statusById[submissionId] ?? 'Pending';
  }

  getStatusClass(status: SubmissionStatus): string {
    return `status-select status-${status.toLowerCase()}`;
  }

  async onStatusChange(submissionId: string, event: Event): Promise<void> {
    const value = (event.target as HTMLSelectElement).value as SubmissionStatus;
    const previous = this.statusById[submissionId] ?? 'Pending';

    this.statusById[submissionId] = value;

    try {
      await this.storageService.setSubmissionStatus(submissionId, value);
    } catch {
      this.statusById[submissionId] = previous;
      this.notificationService.error('Could not update status in Firebase.');
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  onDateFromChange(value: string): void {
    this.dateFrom = value;
    this.currentPage = 1;
  }

  onDateToChange(value: string): void {
    this.dateTo = value;
    this.currentPage = 1;
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.currentPage = 1;
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
  }

  clearAllFilters(): void {
    this.searchQuery = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.currentPage = 1;
  }

  prevPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(1, page), this.totalPages);
  }

  isSelected(submissionId: string): boolean {
    return this.selectedIds.has(submissionId);
  }

  get allSelected(): boolean {
    const visible = this.visibleIds;
    return visible.length > 0 && visible.every((id) => this.selectedIds.has(id));
  }

  get someSelected(): boolean {
    const visible = this.visibleIds;
    const selectedVisible = visible.filter((id) => this.selectedIds.has(id));
    return selectedVisible.length > 0 && selectedVisible.length < visible.length;
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  toggleSelection(submissionId: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedIds.add(submissionId);
    } else {
      this.selectedIds.delete(submissionId);
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    for (const id of this.visibleIds) {
      if (checked) {
        this.selectedIds.add(id);
      } else {
        this.selectedIds.delete(id);
      }
    }
    this.selectedIds = new Set(this.selectedIds);
  }

  async deleteSelected(): Promise<void> {
    if (!this.selectedIds.size) {
      return;
    }

    const count = this.selectedIds.size;
    const confirmed = window.confirm(
      `Delete ${count} submission${count === 1 ? '' : 's'}? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      await this.storageService.deleteStage1Submissions([...this.selectedIds]);
      this.selectedIds = new Set();
      await this.loadSubmissions();
      this.notificationService.success(
        `${count} submission${count === 1 ? '' : 's'} deleted.`
      );
    } catch {
      this.notificationService.error('Could not delete submissions from Firebase.');
    }
  }

  private clampCurrentPage(): void {
    if (this.currentPage > this.totalPages) {
      this.currentPage = this.totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }
  }

  private matchesDateRange(submission: FormSubmission): boolean {
    const submitted = new Date(submission.date);
    if (Number.isNaN(submitted.getTime())) {
      return false;
    }

    if (this.dateFrom) {
      const from = this.parseDateStart(this.dateFrom);
      if (submitted < from) {
        return false;
      }
    }

    if (this.dateTo) {
      const to = this.parseDateEnd(this.dateTo);
      if (submitted > to) {
        return false;
      }
    }

    return true;
  }

  private parseDateStart(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  private parseDateEnd(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  private getSearchableText(submission: FormSubmission): string {
    const summary = this.getSummary(submission);
    return [
      this.formatDate(submission.date),
      summary.applicantName,
      summary.acronym,
      summary.organizationType,
      summary.contactEmail,
      summary.headquarters,
      summary.scope,
      this.getStatus(submission.id)
    ]
      .join(' ')
      .toLowerCase();
  }
}
