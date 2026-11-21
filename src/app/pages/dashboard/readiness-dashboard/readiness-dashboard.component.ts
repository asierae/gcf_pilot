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

  toggleArchivedView(): void {
    this.showArchived = !this.showArchived;
  }

  async setArchive(archived: boolean, id?: string): Promise<void> {
    const ids = id ? [id] : [];
    if (!ids.length) return;
    try {
      await this.api.setArchived('readiness', ids, archived);
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
