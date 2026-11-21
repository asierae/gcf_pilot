import { Component, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { ApiService } from "../../../services/api.service";
import { NotificationService } from "../../../services/notification.service";
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
  private translate = inject(TranslateService);

  submissions: AccreditationSubmissionSummary[] = [];
  loading = true;
  loadError = "";
  searchQuery = "";
  typeFilter: TypeFilter = "all";
  showArchived = false;
  selectedIds = new Set<string>();
  sortColumn: keyof AccreditationSubmissionSummary = "submittedAt";
  sortDir: "asc" | "desc" = "desc";
  readonly pageSize = 10;
  currentPage = 1;

  ngOnInit(): void {
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
      if (Boolean(submission.archived) !== this.showArchived) return false;
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

  get archivedCount(): number {
    return this.submissions.filter((submission) => submission.archived).length;
  }

  get visibleIds(): string[] {
    return this.paginatedSubmissions.map((submission) => submission.id);
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
    this.currentPage = 1;
  }

  async setArchive(archived: boolean, id?: string): Promise<void> {
    const ids = id ? [id] : [...this.selectedIds];
    if (!ids.length) return;
    try {
      await this.api.setArchived("accreditation", ids, archived);
      this.selectedIds.clear();
      await this.loadSubmissions();
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not update the archive state.",
      );
    }
  }

  async deleteSelected(): Promise<void> {
    const ids = [...this.selectedIds];
    if (!ids.length) return;
    const message = this.translate.instant("ARCHIVE.CONFIRM_DELETE");
    if (!window.confirm(message)) return;
    try {
      await this.api.deleteAccreditationSubmissions(ids);
      this.selectedIds.clear();
      await this.loadSubmissions();
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not delete the submissions.",
      );
    }
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
