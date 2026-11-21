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

@Component({
  selector: 'app-readiness-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './readiness-dashboard.component.html',
  styleUrl: './readiness-dashboard.component.css',
})
export class ReadinessDashboardComponent implements OnInit, OnDestroy {
  submissions: ReadinessSubmissionSummary[] = [];
  loading = true;
  loadError = '';
  search = '';
  showArchived = false;
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
    const query = this.search.trim().toLowerCase();
    const archived = this.submissions.filter(
      (submission) => Boolean(submission.archived) === this.showArchived,
    );
    if (!query) return archived;
    return archived.filter((submission) =>
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
