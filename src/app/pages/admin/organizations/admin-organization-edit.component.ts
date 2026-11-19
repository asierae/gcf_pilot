import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import { OrganizationRecord } from "../../../models/organization.model";
import { NotificationService } from "../../../services/notification.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import { map } from "rxjs/operators";

interface OrgForm {
  name: string;
  acronym: string;
  legalAddress: string;
  operationalAddress: string;
  website: string;
  country: string;
  entityType: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  riskScore: number | null;
  riskNotes: string;
  adminNotes: string;
  accreditationStatus: string;
  priorityLevel: string;
}

const ENTITY_TYPES = [
  "Bank / Financial institution",
  "Development finance institution",
  "Government / Public institution",
  "Private company / Investor",
  "NGO / Non-profit",
  "Project developer",
  "Other",
];

const ACCREDITATION_STATUSES = [
  "pending",
  "passed",
  "failed",
  "in_review",
  "accredited",
  "not_accredited",
];

const PRIORITY_LEVELS = ["low", "medium", "high", "critical"];

@Component({
  selector: "app-admin-organization-edit",
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslatePipe],
  templateUrl: "./admin-organization-edit.component.html",
  styleUrl: "./admin-organization-edit.component.css",
})
export class AdminOrganizationEditComponent implements OnInit {
  private api = inject(ApiService);
  private notification = inject(NotificationService);
  private breadcrumb = inject(BreadcrumbService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  orgId = "";
  organization: OrganizationRecord | null = null;
  form: OrgForm = this.emptyForm();

  loading = true;
  saving = false;
  loadError = "";
  saveError = "";

  // Available options (populated from data)
  entityTypes = ENTITY_TYPES;
  accreditationStatuses = ACCREDITATION_STATUSES.map((s) => ({
    value: s,
    label: this.statusLabel(s),
  }));
  priorityLevels = PRIORITY_LEVELS.map((p) => ({
    value: p,
    label: this.priorityLabel(p),
  }));

  constructor() {
    this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get("id")),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((id) => {
        if (id) {
          this.orgId = id;
          void this.loadOrganization(id);
        }
      });

    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.breadcrumb.setContext("ADMIN_ORGANIZATIONS.TITLE");
      });
  }

  ngOnDestroy(): void {
    this.breadcrumb.clearContext();
  }

  async loadOrganization(id: string): Promise<void> {
    this.loading = true;
    this.loadError = "";

    try {
      const org = await this.api.getOrganization(id);
      this.organization = org;
      if (org) {
        this.form = {
          name: org.name || "",
          acronym: org.acronym || "",
          legalAddress: org.legalAddress || "",
          operationalAddress: org.operationalAddress || "",
          website: org.website || "",
          country: org.country || "",
          entityType: org.entityType || "",
          contactName: org.contactName || "",
          contactEmail: org.contactEmail || "",
          contactPhone: org.contactPhone || "",
          riskScore: org.riskScore,
          riskNotes: org.riskNotes || "",
          adminNotes: org.adminNotes || "",
          accreditationStatus: org.accreditationStatus || "",
          priorityLevel: org.priorityLevel || "",
        };
        // Set breadcrumb context for edit page
        this.breadcrumb.setContext(
          this.translate.instant("ADMIN_ORGANIZATION_EDIT.TITLE"),
        );
      }
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "Could not load organization.";
    } finally {
      this.loading = false;
    }
  }

  emptyForm(): OrgForm {
    return {
      name: "",
      acronym: "",
      legalAddress: "",
      operationalAddress: "",
      website: "",
      country: "",
      entityType: "",
      contactName: "",
      contactEmail: "",
      contactPhone: "",
      riskScore: null,
      riskNotes: "",
      adminNotes: "",
      accreditationStatus: "",
      priorityLevel: "",
    };
  }

  async save(): Promise<void> {
    if (this.saving) return;

    this.saving = true;
    this.saveError = "";

    try {
      // Basic fields use PUT /api/organizations/:id
      const basicUpdates: Partial<OrganizationRecord> = {
        name: this.form.name.trim(),
        acronym: this.form.acronym.trim(),
        legalAddress: this.form.legalAddress.trim(),
        operationalAddress: this.form.operationalAddress.trim(),
        website: this.form.website.trim(),
        country: this.form.country.trim(),
        entityType: this.form.entityType,
        contactName: this.form.contactName.trim(),
        contactEmail: this.form.contactEmail.trim(),
        contactPhone: this.form.contactPhone.trim(),
      };

      await this.api.saveOrganization(this.orgId, basicUpdates);

      // Admin-only fields use PATCH /api/admin/organizations/:id
      const adminUpdates: Parameters<typeof this.api.updateOrganizationAdmin>[1] = {
        riskScore: this.form.riskScore,
        riskNotes: this.form.riskNotes.trim(),
        adminNotes: this.form.adminNotes.trim(),
        accreditationStatus: this.form.accreditationStatus,
        priorityLevel: this.form.priorityLevel,
      };

      await this.api.updateOrganizationAdmin(this.orgId, adminUpdates);

      this.notification.success("Organization updated.");

      // Update local copy
      if (this.organization) {
        Object.assign(this.organization, basicUpdates);
        Object.assign(this.organization, adminUpdates);
      }
    } catch (error) {
      this.saveError =
        error instanceof Error ? error.message : "Could not save changes.";
    } finally {
      this.saving = false;
    }
  }

  riskScoreInput(value: string): number | null {
    const num = Number(value);
    if (isNaN(num) || value === "" || value === null) return null;
    return Math.max(0, Math.min(100, num));
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_PENDING",
      passed: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_PASSED",
      failed: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_FAILED",
      in_review: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_IN_REVIEW",
      accredited: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_ACCREDITATED",
      not_accredited: "ADMIN_ORGANIZATION_EDIT.ACCR_STATUS_NOT_ACCREDITED",
    };
    const key = labels[status] || status;
    return this.translate.instant(key);
  }

  priorityLabel(priority: string): string {
    return this.translate.instant(
      `ADMIN_ORGANIZATION_EDIT.PRIORITY_${priority?.toUpperCase() ?? "LOW"}`,
    );
  }

  goBack(): void {
    this.router.navigate(["/admin/organizations"]);
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