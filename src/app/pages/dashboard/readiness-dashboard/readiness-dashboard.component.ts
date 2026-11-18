import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiService,
  ReadinessSubmissionSummary,
} from '../../../services/api.service';
import { BreadcrumbService } from '../../../services/breadcrumb.service';

@Component({
  selector: 'app-readiness-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './readiness-dashboard.component.html',
  styleUrl: './readiness-dashboard.component.css',
})
export class ReadinessDashboardComponent implements OnInit, OnDestroy {
  submissions: ReadinessSubmissionSummary[] = [];
  loading = true;
  loadError = '';
  search = '';

  constructor(
    private readonly api: ApiService,
    private readonly breadcrumb: BreadcrumbService,
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

  get filteredSubmissions(): ReadinessSubmissionSummary[] {
    const query = this.search.trim().toLowerCase();
    if (!query) return this.submissions;
    return this.submissions.filter((submission) =>
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
