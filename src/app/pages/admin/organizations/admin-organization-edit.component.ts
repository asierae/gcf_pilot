import { Component, DestroyRef, inject, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Router, RouterLink, ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { TranslatePipe, TranslateService } from "@ngx-translate/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ApiService } from "../../../services/api.service";
import { NotificationService } from "../../../services/notification.service";
import { BreadcrumbService } from "../../../services/breadcrumb.service";
import {
  OrganizationFileGroup,
  OrganizationFilesBySection,
  OrganizationRecord,
} from "../../../models/organization.model";
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
  auditEnabled: boolean;
  auditGovernance: number | null;
  auditFinancial: number | null;
  auditDelivery: number | null;
  auditClimate: number | null;
  auditTransparency: number | null;
  auditBenchmark: number | null;
  auditConfidence: number | null;
  auditRiskBand: string;
  auditFirm: string;
  auditDate: string;
  auditReportUrl: string;
  auditNotes: string;
}

type AuditFormFields = Pick<
  OrgForm,
  | 'auditEnabled'
  | 'auditGovernance'
  | 'auditFinancial'
  | 'auditDelivery'
  | 'auditClimate'
  | 'auditTransparency'
  | 'auditBenchmark'
  | 'auditConfidence'
  | 'auditRiskBand'
  | 'auditFirm'
  | 'auditDate'
  | 'auditReportUrl'
  | 'auditNotes'
>;

const AUDIT_BANDS = ['low', 'moderate', 'elevated', 'high'];

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

  // Files
  orgFiles: OrganizationFilesBySection[] = [];
  filesLoading = false;
  filesError = "";
  activeTab = "details"; // 'details' | 'files'

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
  auditBands = AUDIT_BANDS;

  async downloadReport(): Promise<void> {
    if (!this.orgId) return;
    try {
      const blob = await this.api.downloadRiskReport(this.orgId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `avera-risk-report-${this.orgId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      this.notification.success(
        this.translate.instant("ADMIN_ORGANIZATION_EDIT.DOWNLOAD_PDF"),
      );
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not generate the report.",
      );
    }
  }

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
          ...this.auditFormFromOrg(org),
        };
        // Set breadcrumb context for edit page
        this.breadcrumb.setContext(
          this.translate.instant("ADMIN_ORGANIZATION_EDIT.TITLE"),
        );
        // Load files
        await this.loadFiles(id);
      }
    } catch (error) {
      this.loadError =
        error instanceof Error ? error.message : "Could not load organization.";
    } finally {
      this.loading = false;
    }
  }

  async loadFiles(organizationId: string): Promise<void> {
    this.filesLoading = true;
    this.filesError = "";
    try {
      this.orgFiles = await this.api.getOrganizationFiles(organizationId);
    } catch (error) {
      this.filesError =
        error instanceof Error ? error.message : "Could not load files.";
    } finally {
      this.filesLoading = false;
    }
  }

  /** Files grouped by origin (readiness → pre-accreditation → accreditation). */
  get fileGroups(): {
    group: OrganizationFileGroup;
    labelKey: string;
    sections: OrganizationFilesBySection[];
  }[] {
    const order: OrganizationFileGroup[] = [
      "readiness",
      "prescreening",
      "accreditation",
      "other",
    ];
    const labelKeys: Record<OrganizationFileGroup, string> = {
      readiness: "ADMIN_ORGANIZATION_EDIT.FILES_GROUP_READINESS",
      prescreening: "ADMIN_ORGANIZATION_EDIT.FILES_GROUP_PRESCREENING",
      accreditation: "ADMIN_ORGANIZATION_EDIT.FILES_GROUP_ACCREDITATION",
      other: "ADMIN_ORGANIZATION_EDIT.FILES_GROUP_OTHER",
    };

    return order
      .map((group) => ({
        group,
        labelKey: labelKeys[group],
        sections: this.orgFiles
          .filter((section) => (section.group ?? "other") === group)
          .sort(
            (a, b) =>
              (a.order ?? 900) - (b.order ?? 900) ||
              a.label.localeCompare(b.label),
          ),
      }))
      .filter((entry) => entry.sections.length > 0);
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
      auditEnabled: false,
      auditGovernance: null,
      auditFinancial: null,
      auditDelivery: null,
      auditClimate: null,
      auditTransparency: null,
      auditBenchmark: null,
      auditConfidence: null,
      auditRiskBand: "",
      auditFirm: "",
      auditDate: "",
      auditReportUrl: "",
      auditNotes: "",
    };
  }

  private auditFormFromOrg(org: OrganizationRecord): AuditFormFields {
    return {
      auditEnabled: org.auditEnabled ?? false,
      auditGovernance: org.auditGovernance ?? null,
      auditFinancial: org.auditFinancial ?? null,
      auditDelivery: org.auditDelivery ?? null,
      auditClimate: org.auditClimate ?? null,
      auditTransparency: org.auditTransparency ?? null,
      auditBenchmark: org.auditBenchmark ?? null,
      auditConfidence: org.auditConfidence ?? null,
      auditRiskBand: org.auditRiskBand ?? "",
      auditFirm: org.auditFirm ?? "",
      auditDate: org.auditDate ? org.auditDate.slice(0, 10) : "",
      auditReportUrl: org.auditReportUrl ?? "",
      auditNotes: org.auditNotes ?? "",
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
        auditEnabled: this.form.auditEnabled,
        auditGovernance: this.form.auditGovernance,
        auditFinancial: this.form.auditFinancial,
        auditDelivery: this.form.auditDelivery,
        auditClimate: this.form.auditClimate,
        auditTransparency: this.form.auditTransparency,
        auditBenchmark: this.form.auditBenchmark,
        auditConfidence: this.form.auditConfidence,
        auditRiskBand: (this.form.auditRiskBand || null) as OrganizationRecord["auditRiskBand"],
        auditFirm: this.form.auditFirm.trim(),
        auditDate: this.form.auditDate || null,
        auditReportUrl: this.form.auditReportUrl.trim(),
        auditNotes: this.form.auditNotes.trim(),
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

  // Delete dialog
  showDeleteDialog = false;
  deleting = false;
  deleteOptions = {
    deleteFiles: true,
    deleteAccreditation: true,
    deleteReadiness: true,
  };

  openDeleteDialog(): void {
    this.showDeleteDialog = true;
    this.deleteOptions = {
      deleteFiles: true,
      deleteAccreditation: true,
      deleteReadiness: true,
    };
  }

  async confirmDelete(): Promise<void> {
    if (this.deleting) return;
    this.deleting = true;

    try {
      await this.api.deleteOrganizationAdmin(this.orgId, this.deleteOptions);
      this.notification.success("Organization deleted.");
      this.router.navigate(["/admin/organizations"]);
    } catch (error) {
      this.notification.error(
        error instanceof Error ? error.message : "Could not delete organization.",
      );
    } finally {
      this.deleting = false;
      this.showDeleteDialog = false;
    }
  }

  cancelDelete(): void {
    this.showDeleteDialog = false;
  }

  getTotalFiles(): number {
    return this.orgFiles.reduce((sum, section) => sum + section.files.length, 0);
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}