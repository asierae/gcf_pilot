import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import { NotificationService } from "../../../services/notification.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import { AccreditationSubmissionSummary } from "../../../models/organization.model";

type TypeFilter = "all" | "accreditation" | "prescreening";

@Component({
  selector: "app-accreditation-submissions",
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: "./accreditation-submissions.component.html",
  styleUrl: "./accreditation-submissions.component.css",
})
export class AccreditationSubmissionsComponent implements OnInit {
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  submissions: AccreditationSubmissionSummary[] = [];
  loading = true;
  loadError = "";
  searchQuery = "";
  typeFilter: TypeFilter = "all";
  sortColumn: keyof AccreditationSubmissionSummary = "submittedAt";
  sortDir: "asc" | "desc" = "desc";
  readonly pageSize = 10;
  currentPage = 1;

  ngOnInit(): void {
    this.breadcrumb.setContext("NAV.ACCREDITATION_SUBMISSIONS");
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        this.breadcrumb.setContext("NAV.ACCREDITATION_SUBMISSIONS"),
      );
    void this.loadSubmissions();
  }

  async loadSubmissions(): Promise<void> {
    this.loading = true;
    this.loadError = "";
    try {
      this.submissions = await this.api.listAccreditationSubmissions();
      this.currentPage = 1;
    } catch (error) {
      this.loadError =
        error instanceof Error
          ? error.message
          : "Could not load accreditation submissions.";
      this.notification.error(this.loadError);
    } finally {
      this.loading = false;
    }
  }

  get filteredSubmissions(): AccreditationSubmissionSummary[] {
    const query = this.searchQuery.trim().toLowerCase();
    const filtered = this.submissions.filter((submission) => {
      if (
        this.typeFilter !== "all" &&
        submission.type !== this.typeFilter
      ) {
        return false;
      }
      if (!query) return true;
      return [
        submission.organizationName,
        submission.acronym,
        submission.country,
        submission.contactName,
        submission.contactEmail,
        this.typeLabel(submission.type),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    const column = this.sortColumn;
    const direction = this.sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = String(a[column] ?? "");
      const right = String(b[column] ?? "");
      return left.localeCompare(right, undefined, { sensitivity: "base" }) * direction;
    });
  }

  get paginatedSubmissions(): AccreditationSubmissionSummary[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSubmissions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredSubmissions.length / this.pageSize));
  }

  get pageStart(): number {
    if (!this.filteredSubmissions.length) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get pageEnd(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredSubmissions.length);
  }

  onSearchInput(event: Event): void {
    this.searchQuery = (event.target as HTMLInputElement).value;
    this.currentPage = 1;
  }

  onTypeFilterChange(event: Event): void {
    this.typeFilter = (event.target as HTMLSelectElement).value as TypeFilter;
    this.currentPage = 1;
  }

  sortBy(column: keyof AccreditationSubmissionSummary): void {
    if (this.sortColumn === column) {
      this.sortDir = this.sortDir === "asc" ? "desc" : "asc";
    } else {
      this.sortColumn = column;
      this.sortDir = "asc";
    }
    this.currentPage = 1;
  }

  previousPage(): void {
    if (this.currentPage > 1) this.currentPage -= 1;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage += 1;
  }

  typeLabel(type: AccreditationSubmissionSummary["type"]): string {
    const key =
      type === "accreditation"
        ? "ACCREDITATION_SUBMISSIONS.TYPE_ACCREDITATION"
        : "ACCREDITATION_SUBMISSIONS.TYPE_PRESCREENING";
    return this.translate.instant(key);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: "ACCREDITATION_SUBMISSIONS.STATUS_PENDING",
      passed: "ACCREDITATION_SUBMISSIONS.STATUS_PASSED",
      failed: "ACCREDITATION_SUBMISSIONS.STATUS_FAILED",
      in_review: "ACCREDITATION_SUBMISSIONS.STATUS_IN_REVIEW",
      accredited: "ACCREDITATION_SUBMISSIONS.STATUS_ACCREDITED",
      not_accredited: "ACCREDITATION_SUBMISSIONS.STATUS_NOT_ACCREDITED",
      not_started: "ACCREDITATION_SUBMISSIONS.STATUS_NOT_STARTED",
    };
    const key = map[status.toLowerCase()];
    return key ? this.translate.instant(key) : status;
  }

  formatDate(value: string): string {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}
