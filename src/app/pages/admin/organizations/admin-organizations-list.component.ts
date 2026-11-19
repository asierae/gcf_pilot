import { Component, DestroyRef, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TranslatePipe } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import { OrganizationRecord } from "../../../models/organization.model";
import { NotificationService } from "../../../services/notification.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import { TranslateService } from "@ngx-translate/core";

interface OrgRow extends OrganizationRecord {}

@Component({
  selector: "app-admin-organizations-list",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslatePipe],
  templateUrl: "./admin-organizations-list.component.html",
  styleUrl: "./admin-organizations-list.component.css",
})
export class AdminOrganizationsListComponent {
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  organizations: OrgRow[] = [];
  search = "";
  loading = true;
  loadError = "";
  deletingId: string | null = null;

  constructor() {
    this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
  }

  ngOnInit(): void {
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
        this.loadOrganizations();
      });
    this.loadOrganizations();
  }

  ngOnDestroy(): void {
    this.breadcrumb.clearContext();
  }

  async loadOrganizations(): Promise<void> {
    this.loading = true;
    this.loadError = "";

    try {
      this.organizations = await this.api.getOrganizationsAdmin();
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "Could not load organizations.";
    } finally {
      this.loading = false;
    }
  }

  get filteredOrganizations(): OrgRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.organizations;
    return this.organizations.filter(
      (org) =>
        org.name.toLowerCase().includes(q) ||
        (org.acronym ?? "").toLowerCase().includes(q) ||
        org.country.toLowerCase().includes(q) ||
        org.id.toLowerCase().includes(q),
    );
  }

  get countMessage(): string {
    const count = this.filteredOrganizations.length;
    return this.translate.instant("ADMIN_ORGANIZATIONS.COUNT", {
      count,
      plural: count === 1 ? "" : "s",
    });
  }

  riskBand(score: number | null): string {
    if (score === null) return "low";
    if (score >= 75) return "high";
    if (score >= 60) return "elevated";
    if (score >= 40) return "moderate";
    return "low";
  }

  entityLabel(entityType: string): string {
    return entityType || "—";
  }

  accreditationStatusClass(status: string): string {
    if (!status) return "pending";
    return status.replace("_", "-");
  }

  accreditationStatusLabel(status: string): string {
    if (!status) return "—";
    const key = `ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_${status.toUpperCase().replace("-", "_")}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  priorityLabel(priority: string | null): string {
    if (!priority) return "—";
    const key = `ADMIN_ORGANIZATION_EDIT.PRIORITY_${priority.toUpperCase()}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : priority;
  }

  async deleteOrganization(org: OrgRow): Promise<void> {
    if (!confirm(`Delete organization "${org.name}"? This cannot be undone.`)) {
      return;
    }

    this.deletingId = org.id;
    try {
      // Organizations cannot be deleted via API - just show notification
      this.notification.info("Organizations cannot be deleted.");
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not delete organization.",
      );
    } finally {
      this.deletingId = null;
    }
  }

  refresh(): void {
    this.search = "";
    void this.loadOrganizations();
  }

  formatDate(iso?: string): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
}