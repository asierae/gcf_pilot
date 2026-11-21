import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  ReadinessSubmissionSummary,
} from '../../../services/api.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';
import { NotificationService } from '../../../services/notification.service';
import { TranslatePipe } from '@ngx-translate/core';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';

@Component({
  selector: 'app-readiness-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePickerComponent, TranslatePipe],
  templateUrl: './readiness-dashboard.component.html',
  styleUrl: './readiness-dashboard.component.css',
})
export class ReadinessDashboardComponent implements OnInit, OnDestroy {
  submissions: ReadinessSubmissionSummary[] = [];
  loading = true;
  loadError = '';
  search = '';
  showArchived = false;
  dateFrom = '';
  dateTo = '';
  selectedIds = new Set<string>();

  constructor(
    private readonly api: ApiService,
    private readonly breadcrumb: BreadcrumbService,
    private readonly notification: NotificationService,
  ) {}

  ngOnInit(): void {
    this.breadcrumb.setContext('Readiness submissions');
    void this.load();
  }

  ngOnDestroy(): void {
    this.breadcrumb.clearContext();
  }

  async load(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      this.submissions = await this.api.getReadinessSubmissions();
    } catch (error) {
      this.loadError =
        error instanceof Error
          ? error.message
          : 'Could not load readiness submissions.';
    } finally {
      this.loading = false;
    }
  }

  get archivedCount(): number {
    return this.submissions.filter((submission) => submission.archived).length;
  }

  get visibleIds(): string[] {
    return this.filteredSubmissions.map((submission) => submission.organizationId);
  }

  get allSelected(): boolean {
    return this.visibleIds.length > 0 && this.visibleIds.every((id) => this.selectedIds.has(id));
  }

  get someSelected(): boolean {
    return this.visibleIds.some((id) => this.selectedIds.has(id));
  }

  toggleSelection(id: string, checked: boolean): void {
    if (checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
  }

  toggleSelectAll(checked: boolean): void {
    for (const id of this.visibleIds) {
      if (checked) this.selectedIds.add(id);
      else this.selectedIds.delete(id);
    }
  }

  toggleArchivedView(): void {
    this.showArchived = !this.showArchived;
    this.selectedIds.clear();
  }

  async setArchive(archived: boolean): Promise<void> {
    const ids = [...this.selectedIds];
    if (!ids.length) return;
    try {
      await this.api.setArchived('readiness', ids, archived);
      this.selectedIds.clear();
      await this.load();
    } catch (error) {
      this.notification.error(
        error instanceof Error
          ? error.message
          : 'Could not update the archive state.',
      );
    }
  }

  get filteredSubmissions(): ReadinessSubmissionSummary[] {
    if (this.hasInvalidDateRange) return [];
    const query = this.search.trim().toLowerCase();
    const archived = this.submissions.filter(
      (submission) => Boolean(submission.archived) === this.showArchived,
    );
    const inRange = archived.filter((submission) =>
      this.matchesDateRange(submission.submittedAt),
    );
    if (!query) return inRange;
    return inRange.filter((submission) =>
      [
        submission.organization?.name,
        submission.organization?.acronym,
        submission.organization?.country,
        submission.proposalTitle,
        submission.ndaEmail,
        submission.organizationId,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }

  get hasInvalidDateRange(): boolean {
    return Boolean(this.dateFrom && this.dateTo && this.dateFrom > this.dateTo);
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.search.trim() || this.dateFrom || this.dateTo);
  }

  onDateFromChange(value: string): void {
    this.dateFrom = value;
  }

  onDateToChange(value: string): void {
    this.dateTo = value;
  }

  clearDateFilter(): void {
    this.dateFrom = '';
    this.dateTo = '';
  }

  clearFilters(): void {
    this.search = '';
    this.clearDateFilter();
  }

  private matchesDateRange(iso: string): boolean {
    if (!this.dateFrom && !this.dateTo) return true;
    const submitted = new Date(iso);
    if (Number.isNaN(submitted.getTime())) return false;
    if (this.dateFrom && submitted < this.parseDateStart(this.dateFrom)) {
      return false;
    }
    if (this.dateTo && submitted > this.parseDateEnd(this.dateTo)) {
      return false;
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

  formatDate(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatAmount(value: number | null): string {
    if (value === null || Number.isNaN(value)) return '—';
    return `USD ${value.toLocaleString('en-US')}`;
  }
}
